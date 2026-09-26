import { expect, test } from "@playwright/test";

test("built assets, invite query, local race and reload work under a project subpath", async ({
  page,
  request,
}, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const assets: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      consoleErrors.push(message.text() + " (" + message.location().url + ")");
  });
  page.on("requestfailed", (req) =>
    failedRequests.push(`${req.url()}: ${req.failure()?.errorText}`),
  );
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (["script", "stylesheet"].includes(response.request().resourceType())) {
      assets.push(url.pathname);
      if (response.status() >= 400)
        failedRequests.push(`${response.status()} ${url.pathname}`);
    }
  });
  // The test server deliberately cannot rescue absolute asset paths with a root fallback.
  expect(
    (await request.get("http://127.0.0.1:4178/assets/missing.js")).status(),
  ).toBe(404);
  const redirected = await request.get(
    "http://127.0.0.1:4178/magical-athlete?room=ABC123",
    { maxRedirects: 0 },
  );
  expect(redirected.status()).toBe(308);
  expect(redirected.headers().location).toBe("/magical-athlete/?room=ABC123");
  await page.goto("./?room=ABC123");
  await expect(
    page.getByRole("heading", { name: "A little magic. A lot of racing." }),
  ).toBeVisible();
  expect(assets.some((path) => path.endsWith(".js"))).toBeTruthy();
  expect(assets.some((path) => path.endsWith(".css"))).toBeTruthy();
  expect(
    assets.every((path) => path.startsWith("/magical-athlete/assets/")),
  ).toBeTruthy();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
  expect((await request.get("./robots.txt")).status()).toBe(200);
  const roomInput = page.getByPlaceholder("ABC123");
  // Configured builds prefill the invite code; unconfigured builds expose no pretend online flow.
  if (await roomInput.count()) await expect(roomInput).toHaveValue("ABC123");
  else
    await expect(
      page.getByText("Online rooms aren’t configured yet"),
    ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("production-home.png"),
    fullPage: true,
  });
  await page.getByLabel("Deal random teams instead of drafting").check();
  await page
    .getByRole("button", { name: "Start local game", exact: true })
    .click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /— reveal/ }).click();
    await page.locator("button.racer-card:not([disabled])").first().click();
    await page.getByRole("button", { name: "Lock in 1 / 1" }).click();
  }
  const curtain = page.getByRole("button", { name: /— reveal/ });
  if (await curtain.count()) await curtain.click();
  await expect(page.getByRole("region", { name: /race board/ })).toBeVisible();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect(page).toHaveURL(/\/magical-athlete\/\?room=ABC123$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("production-race.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: /Resume saved game/ }).click();
  if (await curtain.count()) await curtain.click();
  await expect(page.getByRole("region", { name: /race board/ })).toBeVisible();
  await expect(page).toHaveURL(/\/magical-athlete\/\?room=ABC123$/);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
