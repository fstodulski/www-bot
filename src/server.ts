import { config } from "dotenv";
import { launch, Page } from "puppeteer";
import { Subpage } from "./subpage";

config();

const { PASSWORD, LOGIN, MAX_AGE, MAX_PRICE } = process.env;
const systemLeadUrl = "https://www.systemlead.pl/system/wszystkie_leady.php";

const checkedLeads: Array<string> = [];

const login = async (page: Page): Promise<void> => {
  await page.goto("https://www.systemlead.pl/");

  const loginButton = await page.$("#zaloguj");

  await page.type("#email", LOGIN);
  await page.type("#haslo", PASSWORD);

  await loginButton.click();
};

const setFiltersValue = async (page: Page) => {
  await page.select(".pagination-size", "100");
  await page.$eval(
    "[name=age-to]",
    (el: Element, value: string) => el.setAttribute("value", value),
    MAX_AGE
  );
  await page.$eval(
    "[name=price-to]",
    (el: Element, value: string) => el.setAttribute("value", value),
    MAX_PRICE
  );
};

async function initialize() {
  const browser = await launch({
    headless: false,
    defaultViewport: {
      width: 1640,
      height: 900,
    },
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();

  await login(page);

  await page.waitForNavigation();
  await page.goto(systemLeadUrl);
  // Reset Filters
  await setFiltersValue(page);

  const buyLead = async () => {
    // Click for apply button
    const filterBtn = await page.$(".filtruj");
    await filterBtn.click();

    await page.waitForSelector("#lead_lista > tbody > .lead-row");

    const leadList = await page.$("#lead_lista");

    const tableBody = await leadList.$("tbody");

    const tableRows = await tableBody.$$(".lead-row");

    const correctLeadsUrl: Array<string> = await Promise.all(
      tableRows.map(async (row): Promise<string> => {
        const priceSpan = await row.$(".cena");

        const priceValue: string = await (
          await priceSpan.getProperty("textContent")
        ).jsonValue();

        if (row) {
          if (parseInt(priceValue) <= parseInt(MAX_PRICE)) {
            const takeALookButton = await row.$(".przycisk > a");

            return await (
              await takeALookButton.getProperty("href")
            ).jsonValue();
          }
        } else {
          throw Error("Cant find Row");
        }
      })
    );

    const leads: Array<string> = correctLeadsUrl.filter((leadUrl) => leadUrl);

    if (leads.length > 0) {
      for (let i = 0; i < leads.length; i += 1) {
        const url = leads[i];

        console.log(url, checkedLeads);
        if (!checkedLeads.includes(url)) {
          const subPage = await browser.newPage();

          subPage.on("dialog", async (dialog) => {
            await dialog.accept();
            await subPage.close();
          });

          await subPage.goto(url);

          const leadPage = new Subpage(subPage, url);

          const scrap = async () => {
            const { isSold, buyButton } = await leadPage.scrap();

            if (!isSold) {
              await scrap();
            }

            if (isSold || !buyButton) {
              await subPage.close();
            }

            if (buyButton) {
              await buyButton.click();
            }
          };

          await scrap();

          checkedLeads.push(url);
        } else {
          await buyLead();
        }

        if (i === leads.length - 1) {
          await buyLead();
        }
      }
    }
  };

  await buyLead();
}

initialize();
