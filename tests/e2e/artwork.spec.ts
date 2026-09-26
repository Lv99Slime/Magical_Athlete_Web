import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const catalogue = JSON.parse(
  readFileSync("magical_athlete_2025_racers.json", "utf8"),
) as {
  racers: Array<{ id: string }>;
};

test("all 36 racers use distinct, decodable sprite cells in catalogue order", async ({
  page,
  request,
}) => {
  const failedArt: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/art/") && response.status() >= 400)
      failedArt.push(response.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "選手圖鑑", exact: true }).click();
  const portraits = page.locator(".library [data-racer-art]");
  await expect(portraits).toHaveCount(36);
  const sprites = await portraits.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      const match = style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);
      return {
        id: element.getAttribute("data-racer-art"),
        url: match?.[1] ?? "",
        position: style.backgroundPosition,
        size: style.backgroundSize,
        width: element.getBoundingClientRect().width,
      };
    }),
  );
  expect(sprites.map((sprite) => sprite.id)).toEqual(
    catalogue.racers.map((racer) => racer.id),
  );
  expect(
    new Set(sprites.map((sprite) => `${sprite.url}|${sprite.position}`)).size,
  ).toBe(36);
  for (const [index, sprite] of sprites.entries()) {
    expect(sprite.url).toMatch(
      new RegExp(`/racers-${Math.floor(index / 6)}\\.[^/]+$`),
    );
    expect(sprite.position).toBe(
      `${(index % 3) * 50}% ${Math.floor((index % 6) / 3) * 100}%`,
    );
    expect(sprite.size).toBe("300% 200%");
    expect(sprite.width).toBeGreaterThan(0);
  }
  const urls = [...new Set(sprites.map((sprite) => sprite.url))];
  expect(urls).toHaveLength(6);
  for (const url of urls) {
    const response = await request.get(url);
    expect(response.ok(), url).toBeTruthy();
    expect(response.headers()["content-type"]).toMatch(/^image\//);
    const dimensions = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, url);
    expect(dimensions.width).toBeGreaterThan(300);
    expect(dimensions.height).toBeGreaterThan(200);
    expect(dimensions.width / dimensions.height).toBeGreaterThan(1.45);
    expect(dimensions.width / dimensions.height).toBeLessThan(1.55);
  }
  expect(failedArt).toEqual([]);
});
