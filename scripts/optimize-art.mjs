// Encode the generated PNGs for delivery without changing their composition.
// Keep original generated files under output/art-source for future re-encoding.
import { chromium } from "playwright";
import { Buffer } from "node:buffer";
import console from "node:console";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await mkdir("output/art-source", { recursive: true });
  for (const name of [
    "race-world",
    ...Array.from({ length: 6 }, (_, i) => `racers-${i}`),
  ]) {
    const source = await readFile(`apps/web/public/art/${name}.png`).catch(() =>
      readFile(`output/art-source/${name}.png`),
    );
    await writeFile(`output/art-source/${name}.png`, source);
    const encoded = await page.evaluate(
      async (data) => {
        const img = new globalThis.Image();
        img.src = data;
        await img.decode();
        const canvas = globalThis.document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        return canvas.toDataURL("image/webp", 0.9);
      },
      `data:image/png;base64,${source.toString("base64")}`,
    );
    if (!encoded.startsWith("data:image/webp;"))
      throw new Error("WebP encoder unavailable");
    const bytes = Buffer.from(encoded.split(",")[1], "base64");
    await writeFile(`apps/web/public/art/${name}.webp`, bytes);
    console.log(`${name}: ${source.length} -> ${bytes.length} bytes`);
  }
} finally {
  await browser.close();
}
