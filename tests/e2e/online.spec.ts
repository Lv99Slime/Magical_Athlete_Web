import { expect, test } from "@playwright/test";
import type { RoomView } from "../../apps/web/src/online";

const configured = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
test("two browser identities create, join, privately select, reveal and reconnect", async ({
  browser,
}) => {
  test.skip(
    !configured,
    "Online browser checks run in the dedicated real-backend CI job.",
  );
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  for (const context of [hostContext, guestContext]) {
    await context.addInitScript(() => localStorage.setItem("magical-locale", "en"));
  }
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const guestSnapshots: RoomView[] = [];
  const pageErrors: string[] = [];
  for (const page of [host, guest])
    page.on("pageerror", (error) => pageErrors.push(error.message));
  guest.on("response", async (response) => {
    if (response.url().includes("/functions/v1/game/rooms/") && response.ok()) {
      try {
        const body = await response.json();
        if (body.game && body.playerId) guestSnapshots.push(body);
      } catch {
        /* Ignore a response cancelled by reload. */
      }
    }
  });
  try {
    await host.goto("/");
    await host.getByLabel("Your nickname").fill("Online Host");
    await host
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    const code = host.locator(".lobby h1");
    await expect(code).toHaveText(/^[A-Z0-9]{6}$/);
    await guest.goto(`/?room=${await code.textContent()}`);
    await guest.getByLabel("Your nickname").fill("Online Guest");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(
      guest.getByRole("heading", { name: "Players · 2 / 6" }),
    ).toBeVisible();
    await expect(
      host.getByRole("heading", { name: "Players · 2 / 6" }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Ready to race", exact: true })
      .click();
    await expect(
      guest.locator(".member-list li").filter({ hasText: "Online Host" }),
    ).toContainText("Ready");
    await guest
      .getByRole("button", { name: "Ready to race", exact: true })
      .click();
    await host.getByLabel("Random teams instead of drafting").check();
    await expect(
      host.getByRole("button", { name: "Start game", exact: true }),
    ).toBeEnabled();
    await host.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(
      host.getByRole("heading", { name: "Choose your racers", exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Choose your racers", exact: true }),
    ).toBeVisible();
    const hostCards = host.locator("button.racer-card");
    await hostCards.nth(0).click();
    await hostCards.nth(1).click();
    await host
      .getByRole("button", { name: "Lock in 2 / 2", exact: true })
      .click();
    await expect(
      host.getByRole("heading", { name: "Your racers are locked in." }),
    ).toBeVisible();
    await expect
      .poll(() =>
        guestSnapshots.some(
          (r) =>
            r.game?.phase === "selection" &&
            r.game.selectionReady.includes("p0"),
        ),
      )
      .toBeTruthy();
    const privateView = guestSnapshots
      .filter(
        (r) =>
          r.game?.phase === "selection" && r.game.selectionReady.includes("p0"),
      )
      .at(-1)!;
    expect(privateView.playerId).toBe("p1");
    expect(privateView.game!.selections.p0 ?? []).toEqual([]);
    expect(privateView.game).not.toHaveProperty("randomOutcomes");
    expect(privateView.game).not.toHaveProperty("deck");
    await expect(
      guest.getByRole("heading", { name: "Choose two racers for race 1" }),
    ).toBeVisible();
    const guestCards = guest.locator("button.racer-card");
    await guestCards.nth(0).click();
    await guestCards.nth(1).click();
    await guest
      .getByRole("button", { name: "Lock in 2 / 2", exact: true })
      .click();
    for (const page of [host, guest])
      await expect(
        page.getByRole("region", { name: /race board/ }),
      ).toBeVisible();
    await guest.reload();
    await guest
      .getByRole("button", { name: "Reconnect to last room", exact: true })
      .click();
    await expect(
      guest.getByRole("region", { name: /race board/ }),
    ).toBeVisible();
    await expect.poll(() => guestSnapshots.at(-1)?.playerId).toBe("p1");
    expect(guestSnapshots.at(-1)?.members).toHaveLength(2);
    expect(pageErrors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
