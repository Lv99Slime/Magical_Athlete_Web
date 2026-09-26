// Run on a Docker-enabled CI runner with Supabase CLI on PATH.
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} exited ${result.status}`);
  return result;
};
let server;
try {
  run("supabase", ["start"]);
  run("supabase", ["db", "reset"]);
  run(process.execPath, ["supabase/scripts/bundle-engine.mjs"]);
  const status = run("supabase", ["status", "-o", "env"], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  }).stdout;
  const get = (name) =>
    status.match(new RegExp(`^${name}="([^"]+)"`, "m"))?.[1];
  const url = get("API_URL"),
    key = get("ANON_KEY");
  if (!url || !key)
    throw new Error("Supabase CLI did not return local API_URL / ANON_KEY");
  server = spawn("supabase", ["functions", "serve", "game"], {
    stdio: "inherit",
    windowsHide: true,
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await globalThis.fetch(
        `${url}/functions/v1/game/rooms/test`,
      );
      if (response.status === 401) {
        ready = true;
        break;
      }
    } catch {
      /* The local Edge runtime may still be starting. */
    }
    await delay(1000);
  }
  if (!ready) throw new Error("Authenticated game endpoint did not start");
  run(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/backend"],
    {
      env: {
        ...process.env,
        SUPABASE_TEST_URL: url,
        SUPABASE_TEST_PUBLISHABLE_KEY: key,
      },
    },
  );
  run(process.execPath, [
    "node_modules/playwright/cli.js",
    "install",
    "--with-deps",
    "chromium",
  ]);
  run(
    process.execPath,
    [
      "node_modules/playwright/cli.js",
      "test",
      "--config=playwright.online.config.ts",
    ],
    {
      env: {
        ...process.env,
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      },
    },
  );
} finally {
  server?.kill();
  spawnSync("supabase", ["stop", "--no-backup"], {
    stdio: "inherit",
    windowsHide: true,
  });
}
