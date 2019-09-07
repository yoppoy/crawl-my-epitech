const dotenv = require('dotenv');
const puppeteer = require('puppeteer');

const verifyLogin = async (page) => {
    if (await page.$x("//p[contains(text(), 'Veuillez vous connecter')]") !== null) {
        let linkHandlers = await page.$x("//a[contains(text(), 'Connexion référent')]");

        console.log("Authenticating...");
        if (linkHandlers.length > 0) {
            await linkHandlers[0].click();
            await page.waitFor(1500);
            await page.$eval('input[id=auth-input-login]', (el, value) => el.value = value, process.env.LOGIN);
            await page.$eval('input[id=auth-input-password]', (el, value) => el.value = value, process.env.PASSWORD);
            await page.click('input[id="auth-input-remind"]');
            await page.mouse.move(535, 264, {steps: 1}); //mouse click on login
            await page.mouse.down();
            await page.mouse.up();
            await page.waitForNavigation();
        } else {
            throw new Error("Link not found");
        }
    } else {
        console.log("-> User already authenticated");
    }
};

const getAllModules = async (page) => {
    let modules;

    await page.goto("https://intra.epitech.eu/module/board/resume");
    let data = await page.$$eval('table tr', tds => tds.map((td) => {
        return td.obj;
    }));
    modules = data.filter(module => module && module.open === '1' && module.status === 'notregistered').map(module => {
        return ({
            title: module.title,
            link: `https://intra.epitech.eu/module/2019/${module.code}/${module.codeinstance}`,
            credits: parseInt(module.credits),
            dateEndRegister: module.end_register,
            dateBegin: module.begin,
            dateEnd: module.end
        })
    });
    return (modules)
};

const tryRegistration = async (page, module) => {
    let message;

    await page.goto(module.link);
    try {
        await page.click('a[class="button register"]');
        await page.waitFor(1000);
        const errorTab = await page.$('div[role="alert"] div[class="messages"]');
        if (errorTab) {
            message = await (await errorTab.getProperty('textContent')).jsonValue();
            console.log(":( -> ", module.title, " - ", message);
        } else {
            await page.waitFor(1000);
            const successNotification = await page.$('div[class="notification info"] span[class="label"]');
            if (successNotification) {
                message = await (await successNotification.getProperty('textContent')).jsonValue();
                console.log("--------");
                console.log("--- :) -> ", message);
                console.log("--------");
            }
        }
    } catch (e) {
        console.log(e.message);
    }
};

const startCrawling = async (page) => {
    const modules = await getAllModules(page);
    const config = require('./config.json');
    let module;

    for (let index = 0; index < modules.length; index++) {
        module = modules[index];
        if (!config || !config.blacklist.includes(module.title))
            await tryRegistration(page, module);
    }
};

(async () => {
    dotenv.config();
    try {
        const browser = await puppeteer.launch({headless: false});
        const page = await browser.newPage();
        await page.goto("https://intra.epitech.eu/");
        await verifyLogin(page);
        await startCrawling(page);
        await browser.close();
    } catch (e) {
        console.log("Error : ", e.message);
    }
})();