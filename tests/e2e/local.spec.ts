import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("magical-locale", "en"));
});

test("draft, secret selection, race turn and durable resume", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start local game", exact: true })
    .click();
  for (let i = 0; i < 12; i++)
    await page.locator("button.racer-card").first().click();
  await expect(page.getByRole("heading", { name: /Pass to/ })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /— reveal/ }).click();
    await page.locator("button.racer-card:not([disabled])").first().click();
    await page.getByRole("button", { name: "Lock in 1 / 1" }).click();
  }
  const setupCurtain = page.getByRole("button", { name: /— reveal/ });
  if (await setupCurtain.count()) await setupCurtain.click();
  await expect(page.getByRole("region", { name: /race board/ })).toBeVisible();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Resume saved game/ }).click();
  const curtain = page.getByRole("button", { name: /— reveal/ });
  if (await curtain.count()) await curtain.click();
  await expect(page.getByRole("region", { name: /race board/ })).toBeVisible();
});

test("all racers are readable and guide closes with Escape", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Racer guide" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".library .racer-card")).toHaveCount(36);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Racer guide" })).toBeFocused();
});

test("two-player ordered selection and small-screen layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Players", exact: true })
    .selectOption("2");
  await page.getByLabel("Deal random teams instead of drafting").check();
  await page
    .getByRole("button", { name: "Start local game", exact: true })
    .click();
  await page.getByRole("button", { name: /— reveal/ }).click();
  const cards = page.locator("button.racer-card");
  await cards.nth(1).click();
  await cards.nth(0).click();
  await expect(cards.nth(1).locator(".order-badge")).toHaveText("1");
  await expect(cards.nth(0).locator(".order-badge")).toHaveText("2");
  await expect(
    page.getByRole("button", { name: "Lock in 2 / 2" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("complete all four races through visible player choices", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    let seed = 1751;
    Object.defineProperty(crypto, "getRandomValues", {
      value: (a: Uint32Array) => {
        for (let i = 0; i < a.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          a[i] = seed;
        }
        return a;
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Deal random teams instead of drafting").check();
  await page
    .getByRole("button", { name: "Start local game", exact: true })
    .click();
  await page.getByLabel("Fast animations").check();
  for (let actions = 0; actions < 1200; actions++) {
    if (
      await page
        .getByRole("heading", { name: "Final standings", exact: true })
        .count()
    )
      break;
    const reveal = page.getByRole("button", { name: /— reveal/ });
    if (await reveal.count()) {
      await reveal.click();
      continue;
    }
    const lock = page.getByRole("button", { name: /Lock in/ });
    if (await lock.count()) {
      await page.locator("button.racer-card:not([disabled])").first().click();
      await lock.click();
      continue;
    }
    const decision = page.locator(".decision button");
    if (await decision.count()) {
      await decision.first().click();
      continue;
    }
    const next = page.getByRole("button", { name: /Prepare race/ });
    if (await next.count()) {
      await next.click();
      continue;
    }
    await page.getByRole("button", { name: "Roll die", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Final standings", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-race")).toHaveCount(4);
});
