import { expect, test } from "@playwright/test";

// Two software-WebGL pages at once starve each other, so run these in turn.
test.describe.configure({ mode: "serial" });

test("3D style sample opens on demand and the game stays the default", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("magical-locale", "en"));
  await page.goto("/?lab=paper3d");
  // The lazy 3D chunk can be slow to arrive on a busy machine.
  await expect(page.getByText("Pop-up paper book")).toBeVisible({
    timeout: 30000,
  });
  // Devices without WebGL get the written fallback instead of a canvas.
  await expect(
    page.locator(".paper-lab canvas, .paper-lab-fallback").first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to the game" }).click();
  await expect(
    page.getByRole("button", { name: "Start local game", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".paper-lab")).toHaveCount(0);
});

test("the sample plays each pawn animation without errors", async ({
  page,
}) => {
  // Software WebGL manages only a few frames a second, so this test owns the
  // clock: the page draws a frame only when the test steps time forward.
  test.setTimeout(120000);
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem("magical-locale", "en"));
  await page.goto("/?lab=paper3d");
  await expect(page.getByText("Pop-up paper book")).toBeVisible({
    timeout: 30000,
  });
  const demo = page.getByRole("group", { name: "Animation demo" });
  test.skip(!(await demo.count()), "WebGL is unavailable in this browser");
  await expect(page.locator(".paper-lab canvas")).toBeVisible({
    timeout: 30000,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.clock.pauseAt(Date.now() + 1000);
  const demos = ["Hop", "Warp", "Trip", "Trip", "Finish"];
  for (const [index, name] of demos.entries()) {
    await demo.getByRole("button", { name, exact: true }).click();
    // Each step runs the timers that are due and draws one frame.
    await expect(async () => {
      await page.clock.fastForward(150);
      await expect(demo).toHaveAttribute(
        "data-demo-played",
        String(index + 1),
        { timeout: 250 },
      );
    }).toPass({ timeout: 60000 });
  }
  await expect(demo).toHaveAttribute("data-demo-finished", "true");
  // Let the finish celebration and its confetti play out.
  for (let step = 0; step < 12; step++) await page.clock.fastForward(150);
  await demo.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(demo).toHaveAttribute("data-demo-finished", "false");
  await expect(page.locator(".paper-lab canvas")).toBeVisible();
  expect(errors).toEqual([]);
});
