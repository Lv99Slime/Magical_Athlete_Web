import { expect, test, type Page } from "@playwright/test";

async function startRace(page: Page) {
  await page.addInitScript(() => localStorage.setItem("magical-locale", "en"));
  await page.goto("/");
  await page.getByLabel("Deal random teams instead of drafting").check();
  await page
    .getByRole("button", { name: "Start local game", exact: true })
    .click();
  for (let player = 0; player < 3; player++) {
    await page.getByRole("button", { name: /— reveal/ }).click();
    await page.locator("button.racer-card:not([disabled])").first().click();
    await page.getByRole("button", { name: "Lock in 1 / 1" }).click();
  }
  const curtain = page.getByRole("button", { name: /— reveal/ });
  if (await curtain.count()) await curtain.click();
  await expect(page.getByRole("region", { name: /race board/ })).toBeVisible();
}

/**
 * Turns the 3D board on. Returns false where the browser has no usable WebGL:
 * the switch is disabled, or the board reports that it fell back to 2D.
 */
async function show3dBoard(page: Page): Promise<boolean> {
  const toggle = page.getByRole("checkbox", { name: "3D board" });
  if (await toggle.isDisabled()) return false;
  // Fast mode draws frames on demand; software WebGL cannot keep up otherwise.
  await page.getByLabel("Fast animations").check();
  await toggle.check();
  const started = page.locator('[data-board="3d"] canvas');
  const fellBack = page.locator("[data-board-fallback]");
  await expect(started.or(fellBack).first()).toBeVisible({ timeout: 30000 });
  return (await fellBack.count()) === 0;
}

test("the board starts in 2D and the 3D choice is remembered", async ({
  page,
}) => {
  await startRace(page);
  const toggle = page.getByRole("checkbox", { name: "3D board" });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator(".u-track")).toBeVisible();
  // Software WebGL in CI is slow; give the canvas time to start.
  test.setTimeout(120000);
  test.skip(!(await show3dBoard(page)), "WebGL is unavailable in this browser");

  const board3d = page.locator('[data-board="3d"]');
  await expect(board3d).toBeVisible();
  await expect(board3d.locator("canvas")).toBeVisible();
  await expect(page.locator(".u-track")).toHaveCount(0);
  await expect(page.getByRole("region", { name: /race board/ })).toBeVisible();
  // The rules-facing controls and the written roster stay as HTML.
  await expect(page.locator(".turn-console")).toBeVisible();
  await expect(page.locator(".race-roster > div")).toHaveCount(3);
  // On touch screens one finger must stay free to scroll the page.
  const touchScreen = await page.evaluate(
    () => window.matchMedia("(pointer: coarse)").matches,
  );
  await expect(board3d.locator('[style*="touch-action: pan-y"]')).toHaveCount(
    touchScreen ? 1 : 0,
  );

  await page.reload();
  await page.getByRole("button", { name: /Resume saved game/ }).click();
  // Fast mode is not remembered; turn it on before the board is shown again.
  await page.getByLabel("Fast animations").check();
  const curtain = page.getByRole("button", { name: /— reveal/ });
  if (await curtain.count()) await curtain.click();
  await expect(page.getByRole("checkbox", { name: "3D board" })).toBeChecked();
  await expect(page.locator('[data-board="3d"] canvas')).toBeVisible();

  await page.getByRole("checkbox", { name: "3D board" }).uncheck();
  await expect(page.locator(".u-track")).toBeVisible();
  await expect(page.locator('[data-board="3d"]')).toHaveCount(0);
});

test("a turn can be played with the 3D board showing", async ({ page }) => {
  await startRace(page);
  test.setTimeout(120000);
  test.skip(!(await show3dBoard(page)), "WebGL is unavailable in this browser");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const rolled = page.locator('.dice-reveal[data-phase="result"]');
  for (let step = 0; step < 12 && !(await rolled.count()); step++) {
    const reveal = page.getByRole("button", { name: /— reveal/ });
    if (await reveal.count()) {
      await reveal.click();
      continue;
    }
    const decision = page.locator(".decision button");
    if (await decision.count()) {
      await decision.first().click();
      continue;
    }
    const roll = page.getByRole("button", { name: "Roll die", exact: true });
    if (await roll.count()) await roll.click();
  }
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-phase",
    "result",
  );
  // A power may hand the next choice to another player, which covers the board.
  const handOff = page.getByRole("button", { name: /— reveal/ });
  if (await handOff.count()) await handOff.click();
  await expect(page.locator('[data-board="3d"] canvas')).toBeVisible({
    timeout: 30000,
  });
  expect(errors).toEqual([]);
});
