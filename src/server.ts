import { config } from "dotenv";
import { ElementHandle, launch } from "puppeteer";

config();
const { PASSWORD, LOGIN, MAX_AGE, MAX_PRICE } = process.env;
const systemLeadUrl = "https://www.systemlead.pl/system/wszystkie_leady.php";

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

  const buyLead = async () => {
    // Reset Filters

    await page.goto(systemLeadUrl);
    await page.$eval("[name=age-to]", (el: Element) =>
      el.setAttribute("value", "")
    );
    await page.$eval("[name=price-to]", (el: Element) =>
      el.setAttribute("value", "")
    );

    // Fill Filters
    await page.type("[name=age-to]", String(MAX_AGE));
    await page.type("[name=price-to]", String(MAX_PRICE));

    // Click for apply button
    (await page.$("[name=filtr_leady]")).click();

    const tableRows = await page.$$("#lead_lista > tbody > tr");

    const correctLeadsUrl: Array<string> = await Promise.all(
      tableRows.map(async (row): Promise<string> => {
        const priceTd = await row.$(".koszt");
        const age: string = await page.evaluate(
          (singleRow) => singleRow.getAttribute("data-wiek"),
          row
        );
        const priceValue: string = await (
          await priceTd.getProperty("textContent")
        ).jsonValue();

        if (
          parseInt(age) <= parseInt(MAX_AGE) &&
          parseInt(priceValue) <= parseInt(MAX_PRICE)
        ) {
          const takeALookButton = await row.$(".przycisk > a");

          return await (await takeALookButton.getProperty("href")).jsonValue();
        }
      })
    );

    const leads: Array<string> = correctLeadsUrl.filter((leadUrl) => leadUrl);

    if (leads.length > 0) {
      for (let i = 0; i < leads.length; i += 1) {
        const url = leads[i];

        const subPage = await browser.newPage();

        subPage.on("dialog", async (dialog) => {
          // await dialog.accept();
          // subPage.close();
        });

        await subPage.goto(url);

        const buyButton: ElementHandle = await subPage.$(
          "#lead_lista_tu > tbody > tr > td > .przycisk"
        );

        if (buyButton) {
          buyButton.click();

          if (i === leads.length - 1) {
            setTimeout(() => buyLead(), 500);
          }
        } else {
          subPage.close();
        }
      }
    } else {
      setTimeout(() => buyLead(), 200);
    }
  };

  buyLead();
}

initialize();
