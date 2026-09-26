import { expect, test, type Page } from "@playwright/test";

const language = (page: Page) =>
  page.getByRole("combobox", { name: "Language / 語言" });
async function expectNoOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    overflowing: Array.from(
      document.querySelectorAll("header, main, section, div, button, select"),
    )
      .filter(
        (element) =>
          element.getBoundingClientRect().right > window.innerWidth + 1,
      )
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
      })),
  }));
  expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.viewport,
  );
}

test("Traditional Chinese is the default and language choice survives reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(language(page)).toHaveValue("zh-Hant");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "一點魔法",
  );
  await expect(
    page.getByRole("button", { name: "開始本機遊戲", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/魔法運動會/);

  await language(page).selectOption("en");
  await expect(
    page.getByRole("button", { name: "Start local game", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(() => localStorage.getItem("magical-locale")),
  ).toBe("en");
  await page.reload();
  await expect(language(page)).toHaveValue("en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little magic.",
  );
  await expect(page).toHaveTitle(/Magical Athlete/);

  await language(page).selectOption("zh-Hant");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(
    page.getByRole("button", { name: "選手圖鑑", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("magical-locale")),
  ).toBe("zh-Hant");
  expect(errors).toEqual([]);
});

test("Chinese guide presents all 36 translated powers and returns keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "選手圖鑑", exact: true });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "認識全部 36 位選手", exact: true }),
  ).toBeVisible();
  const cards = page.locator(".library .racer-card");
  await expect(cards).toHaveCount(36);
  const descriptions = await cards.locator("p").allTextContents();
  expect(descriptions).toHaveLength(36);
  for (const description of descriptions)
    expect(description).toMatch(/[\u3400-\u9fff]/);
  const clippedNames = await cards
    .locator(".card-heading")
    .evaluateAll((headings) =>
      headings
        .filter((heading) => heading.scrollWidth > heading.clientWidth + 1)
        .map((heading) => heading.textContent),
    );
  expect(
    clippedNames,
    "Bilingual racer names must fit inside their guide cards",
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("Chinese mobile setup and ordered choices fit the screen and resume in Chinese", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "開始本機遊戲", exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
  await page
    .getByRole("combobox", { name: "玩家人數", exact: true })
    .selectOption("2");
  await page.getByLabel("隨機分配隊伍，略過選秀", { exact: true }).check();
  await page.getByRole("button", { name: "開始本機遊戲", exact: true }).click();
  await page.getByRole("button", { name: /— 查看選項/ }).click();
  const cards = page.locator("button.racer-card");
  await cards.nth(1).click();
  await cards.nth(0).click();
  await expect(cards.nth(1).locator(".order-badge")).toHaveText("1");
  await expect(cards.nth(0).locator(".order-badge")).toHaveText("2");
  await expectNoOverflow(page);

  await language(page).selectOption("en");
  await expect(
    page.getByRole("button", { name: "Lock in 2 / 2", exact: true }),
  ).toBeEnabled();
  await expect(
    page.locator('button.racer-card[aria-pressed="true"]'),
  ).toHaveCount(2);
  await language(page).selectOption("zh-Hant");
  await page.getByRole("button", { name: "確認 2 / 2", exact: true }).click();
  const handover = page.getByRole("heading", { name: /請交給 / });
  await expect(handover).toBeVisible();
  const nextPlayer = await handover.textContent();
  await expect(page.getByText("已儲存在此裝置", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /繼續存檔 · 賽事/ }).click();
  await expect(page.getByRole("heading", { name: /請交給 / })).toHaveText(
    nextPlayer!,
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expectNoOverflow(page);
});
