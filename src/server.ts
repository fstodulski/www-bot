import { config } from "dotenv";
import { ElementHandle, launch } from "puppeteer";

config();

const debounce = (func: any, wait: number) => {
  let timeout: any;

  return function executedFunction(...args: any) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const { PASSWORD, LOGIN, MAX_AGE, MAX_PRICE } = process.env;
const systemLeadUrl = "https://www.systemlead.pl/system/wszystkie_leady.php";

const checkedLeads: Array<string> = [];

async function initialize() {
  const browser = await launch({
    headless: false,
  });

  const page = await browser.newPage();
  await page.goto("https://www.systemlead.pl/");

  const loginButton = await page.$("#zaloguj");

  await page.type("#email", LOGIN);
  await page.type("#haslo", PASSWORD);

  await loginButton.click();
  await page.waitForNavigation();
  await page.goto(systemLeadUrl);

  const setFiltersValue = async () => {
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

  const buyLead = async () => {
    await page.goto(systemLeadUrl);

    // Reset Filters
    await setFiltersValue();

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

        if (!checkedLeads.includes(url)) {
          const subPage = await browser.newPage();

          subPage.on("dialog", async (dialog) => {
            await dialog.accept();
            await subPage.close();
          });

          await subPage.goto(url);

          const agencies = await subPage.$$("#lead_lista_tu > tbody > tr");

          const generali = agencies.map(async (row) => {
            const td = await row.$$("td");
            const agencyName = await (
              await td[1].getProperty("textContent")
            ).jsonValue<string>();

            if (agencyName.includes("GENERALI")) {
              return row;
            } else {
              return undefined;
            }
          });

          const [generaliRow] = (await Promise.all(generali)).filter(
            (res) => res !== undefined
          );
          console.log(await generaliRow.getProperty("innerHTML"));

          const buyButton: ElementHandle = await generaliRow.$(
            ".purchase_button"
          );

          checkedLeads.push(url);

          if (buyButton) {
            await buyButton.click();
          } else {
            await subPage.close();
          }
        } else {
          setTimeout(async () => await buyLead(), 200);
        }

        if (i === leads.length - 1) {
          await buyLead();
        }
      }
    } else {
      setTimeout(async () => await buyLead(), 200);
    }
  };

  await buyLead();
}

initialize();
