import { expect, test, type Page } from "@playwright/test";
import type { GameState } from "../../packages/engine/src/types";

async function raceFixture(page: Page, magician = false): Promise<GameState> {
  return page.evaluate(
    async ({ modulePath, magician }) => {
      const { createGame, applyCommand, seededRandom } = await import(
        modulePath
      );
      const rng = seededRandom(71);
      let state = createGame(
        { names: ["Alice", "Bob", "Carol"], randomTeams: true },
        rng,
      );
      const ids = ["coach", "gunk", "centaur"];
      for (let i = 0; i < 3; i++) state.players[i].team = [ids[i]];
      for (let i = 0; i < 3; i++)
        state = applyCommand(
          state,
          {
            actorId: state.players[i].id,
            action: { type: "select", racerIds: [ids[i]] },
          },
          rng,
        );
      if (magician) {
        const current = state.racers.find(
          (r: { id: string }) => r.id === state.turn!.racerId,
        )!;
        current.racerId = "magician";
        current.powerId = "magician";
      }
      return state;
    },
    {
      modulePath: `/@fs/${process.cwd().replaceAll("\\", "/")}/packages/engine/src/index.ts`,
      magician,
    },
  );
}
async function loadFixture(page: Page, magician = false) {
  await page.addInitScript(() => {
    localStorage.setItem("magical-locale", "en");
    Object.defineProperty(crypto, "getRandomValues", {
      value: (a: Uint32Array) => {
        a.fill(0x80000000);
        return a;
      },
    });
  });
  await page.goto("/");
  const state = await raceFixture(page, magician);
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("magical-athlete", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("games");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("games", "readwrite");
        tx.objectStore("games").put(value, "local");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, state);
  await page.reload();
  await page.getByRole("button", { name: /Resume saved game/ }).click();
  return state;
}

test("U route has physical corners, continuous positions and a contained mobile scroller", async ({
  page,
}, testInfo) => {
  await loadFixture(page);
  const spaces = page.locator(".u-track .space");
  await expect(spaces).toHaveCount(31);
  const rects = await spaces.evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  expect(rects[1].x).toBeGreaterThan(rects[0].x);
  expect(rects[12].y).toBe(rects[1].y);
  expect(rects[13].x).toBe(rects[12].x);
  expect(rects[15].y).toBeGreaterThan(rects[12].y);
  expect(rects[16].x).toBeLessThan(rects[15].x);
  expect(rects[29].x).toBe(rects[30].x);
  expect(rects[30].y).toBeLessThan(rects[29].y);
  await expect(
    page.getByText("Second corner · 15", { exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .locator(".board-panel")
      .screenshot({ path: "output/screenshots/u-board-desktop.png" });
  }
  await page.setViewportSize({ width: 360, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(
    await page
      .locator(".track-viewport")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBeTruthy();
  await page
    .locator(".track-viewport")
    .evaluate((el) => (el.scrollLeft = el.scrollWidth));
  expect(
    await page.locator(".track-viewport").evaluate((el) => el.scrollLeft),
  ).toBeGreaterThan(0);
  if (testInfo.project.name === "chromium")
    await page
      .locator(".board-panel")
      .screenshot({ path: "output/screenshots/u-board-mobile.png" });
});

test("real die is revealed before tokens move; result persists and reload does not replay", async ({
  page,
}) => {
  const state = await loadFixture(page);
  const current = state.racers.find(
    (r: { id: string }) => r.id === state.turn!.racerId,
  )!;
  const token = page.locator(`.u-track [data-racer-art="${current.racerId}"]`);
  const position = () =>
    token.evaluate((el) =>
      el.closest("[data-position]")!.getAttribute("data-position"),
    );
  const clockTime = new Date("2026-09-26T00:00:00Z");
  await page.clock.install({ time: clockTime });
  await page.clock.pauseAt(new Date(clockTime.getTime() + 1000));
  await page.getByRole("button", { name: "Roll die", exact: true }).click();
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-phase",
    "rolling",
  );
  expect(await position()).toBe("0");
  await expect(
    page.getByRole("button", { name: "Roll die", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(650);
  await expect(page.locator(".dice-cube")).toHaveAttribute("data-face", "4");
  expect(await position()).toBe("0");
  await page.clock.runFor(550);
  await expect.poll(async () => Number(await position())).toBeGreaterThan(0);
  await expect(page.locator(".dice-cube")).toHaveAttribute("data-face", "4");
  await page.reload();
  await page.getByRole("button", { name: /Resume saved game/ }).click();
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-phase",
    "result",
  );
  await expect(page.locator(".dice-cube")).toHaveAttribute("data-face", "4");
});

test("rerolls reveal separately; keeping a die introduces no fake roll", async ({
  page,
}) => {
  await loadFixture(page, true);
  const clockTime = new Date("2026-09-26T00:00:00Z");
  await page.clock.install({ time: clockTime });
  await page.clock.pauseAt(new Date(clockTime.getTime() + 1000));
  await page.getByRole("button", { name: "Roll die", exact: true }).click();
  await page.clock.runFor(1200);
  const handoff = page.getByRole("button", { name: /— reveal/ });
  if (await handoff.count()) await handoff.click();
  const first = await page
    .locator(".dice-reveal")
    .getAttribute("data-event-id");
  await page.getByRole("button", { name: /POOF reroll/ }).click();
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-phase",
    "rolling",
  );
  await page.clock.runFor(1200);
  const second = await page
    .locator(".dice-reveal")
    .getAttribute("data-event-id");
  expect(second).not.toBe(first);
  await page.getByRole("button", { name: "Keep 4", exact: true }).click();
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-event-id",
    second!,
  );
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-phase",
    "result",
  );
});

test("reduced motion skips tumbling and still shows the authoritative result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadFixture(page);
  await page.getByRole("button", { name: "Roll die", exact: true }).click();
  await expect(page.locator(".dice-reveal")).toHaveAttribute(
    "data-phase",
    "result",
  );
  await expect(page.locator(".dice-cube")).toHaveAttribute("data-face", "4");
});
