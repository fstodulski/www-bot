import { ElementHandle, Page } from "puppeteer";

export class Subpage {
  public readonly subPage: Page;
  public readonly subPageUrl: string;
  constructor(subPage: Page, subPageUrl: string) {
    this.subPage = subPage;
    this.subPageUrl = subPageUrl;
  }

  public async scrap(): Promise<{ isSold: boolean; buyButton: ElementHandle }> {
    const generali = (await this.agencies).map(async (row) => {
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

    const buyButton: ElementHandle = await generaliRow.$(".purchase_button");
    const isSold = (
      await (
        await (await generaliRow.$$("td"))[3].getProperty("textContent")
      ).jsonValue<string>()
    ).includes("Lead nie jest już dostępny");

    return {
      isSold,
      buyButton,
    };
  }

  public get agencies(): Promise<Array<ElementHandle<Element>>> {
    return this.subPage.$$("#lead_lista_tu > tbody > tr");
  }
}
