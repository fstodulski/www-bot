"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const puppeteer_1 = require("puppeteer");
dotenv_1.config();
const { PASSWORD, LOGIN, MAX_AGE, MAX_PRICE } = process.env;
const systemLeadUrl = "https://www.systemlead.pl/system/wszystkie_leady.php";
const checkedLeads = [];
function initialize() {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer_1.launch({
            headless: false,
        });
        const page = yield browser.newPage();
        yield page.goto("https://www.systemlead.pl/");
        const loginButton = yield page.$("#zaloguj");
        yield page.type("#email", LOGIN);
        yield page.type("#haslo", PASSWORD);
        yield loginButton.click();
        yield page.waitForNavigation();
        const buyLead = () => __awaiter(this, void 0, void 0, function* () {
            // Reset Filters
            yield page.goto(systemLeadUrl);
            yield page.$eval("[name=age-to]", (el) => el.setAttribute("value", ""));
            yield page.$eval("[name=price-to]", (el) => el.setAttribute("value", ""));
            // Fill Filters
            yield page.type("[name=age-to]", String(MAX_AGE));
            yield page.type("[name=price-to]", String(MAX_PRICE));
            // Click for apply button
            (yield page.$("[name=filtr_leady]")).click();
            const tableRows = yield page.$$("#lead_lista > tbody > tr");
            const correctLeadsUrl = yield Promise.all(tableRows.map((row) => __awaiter(this, void 0, void 0, function* () {
                const priceTd = yield row.$(".koszt");
                const age = yield page.evaluate((singleRow) => singleRow.getAttribute("data-wiek"), row);
                const priceValue = yield (yield priceTd.getProperty("textContent")).jsonValue();
                if (parseInt(age) <= parseInt(MAX_AGE) &&
                    parseInt(priceValue) <= parseInt(MAX_PRICE)) {
                    const takeALookButton = yield row.$(".przycisk > a");
                    return yield (yield takeALookButton.getProperty("href")).jsonValue();
                }
            })));
            const leads = correctLeadsUrl.filter((leadUrl) => leadUrl);
            if (leads.length > 0) {
                for (let i = 0; i < leads.length; i += 1) {
                    const url = leads[i];
                    if (!checkedLeads.includes(url)) {
                        const subPage = yield browser.newPage();
                        subPage.on("dialog", (dialog) => __awaiter(this, void 0, void 0, function* () {
                            yield dialog.dismiss();
                            yield subPage.close();
                        }));
                        yield subPage.goto(url);
                        const buyButton = yield subPage.$("#lead_lista_tu > tbody > tr > td > .przycisk");
                        checkedLeads.push(url);
                        if (buyButton) {
                            yield buyButton.click();
                            if (i === leads.length - 1) {
                                setTimeout(() => buyLead(), 500);
                            }
                        }
                        else {
                            yield subPage.close();
                        }
                    }
                    else {
                        setTimeout(() => buyLead(), 200);
                    }
                }
            }
            else {
                setTimeout(() => buyLead(), 200);
            }
        });
        buyLead();
    });
}
initialize();
//# sourceMappingURL=server.js.map