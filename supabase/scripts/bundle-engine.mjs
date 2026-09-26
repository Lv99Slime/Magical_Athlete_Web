import { build } from "esbuild";
await build({
  entryPoints: ["packages/engine/src/index.ts"],
  outfile: "supabase/functions/_shared/engine.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
});
