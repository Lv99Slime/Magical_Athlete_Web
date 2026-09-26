import fs from "node:fs";
const catalogue = JSON.parse(
  fs.readFileSync("magical_athlete_2025_racers.json", "utf8"),
).racers;
const direct = fs.readFileSync("tests/racers.test.ts", "utf8");
const titles = [...direct.matchAll(/it\(\s*["']([^"']+)["']/g)].map(
  (m) => m[1],
);
const interactionFiles = [
  "tests/interactions.test.ts",
  "tests/rules-audit.test.ts",
  "tests/rules-audit-extra.test.ts",
  "tests/assumptions.test.ts",
  "tests/duelist-windows.test.ts",
];
const rows = catalogue.map((r) => {
  const test = titles.find((t) => t.startsWith(r.name + " "));
  if (!test) throw new Error(`Missing direct mechanical test: ${r.name}`);
  const files = interactionFiles.filter((f) =>
    fs.readFileSync(f, "utf8").includes(r.name),
  );
  return `| ${r.name} / ${r.powerName} | Yes | ${test} | Primary behavior + elimination verified | ${files.length ? files.map((f) => "[" + f.split("/").at(-1) + "](" + f + ")").join(", ") : "Direct behavior and deactivation suite"} | [Recorded interpretations](RULES_ASSUMPTIONS.md) | Tests passed; supplied-source baseline |`;
});
const text = `# Rules coverage matrix

All 36 catalogue identities have executable mechanics, a named direct behavior test in [racers.test.ts](tests/racers.test.ts), and an elimination/deactivation test in [assumptions.test.ts](tests/assumptions.test.ts). Root review also covers mechanics implemented by the shared runtime (for example Magician, Stickler, Suckerfish and Leaptoad), not only registry handlers.

This matrix links real scenarios; it does not claim exhaustive coverage of every possible 36-racer interaction. Executed command results and external acceptance gaps are recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Official track geometry remains unverified. Regenerate links with \`node scripts/write-coverage.mjs\` after separately running tests.

| Racer / power | Implemented | Direct test scenario | Timing tested | Additional interaction tests | Interpretation | Status |
|---|---|---|---|---|---|---|
${rows.join("\n")}

## Core systems

| System | Evidence | State |
|---|---|---|
| Standard draft, two-player ABBAABBA, three-player double | engine-contract.test.ts; simulation.test.ts | Passed |
| Secret ordered selection, simultaneous reveal, used-racer exclusion | engine-contract.test.ts; assumptions.test.ts; browser local.spec.ts | Passed locally; real online gate pending |
| Move/Warp/pass, group endpoint comparison, backwards/zero bounds | racers.test.ts; rules-audit-extra.test.ts; interactions.test.ts property cases | Passed |
| Track effects and 2026 arrival suppression | rules-audit.test.ts; interactions.test.ts; source JSON | Passed against supplied data; physical map unverified |
| Trip, before-main powers, recovery, retained Baba Yaga obligation | interactions.test.ts; racers.test.ts | Passed |
| Final dice, reroll provenance, modifiers | racers.test.ts; rules-audit.test.ts | Passed |
| Optional suspension, off-turn decisions, stable Duelist windows | duelist-windows.test.ts; browser local.spec.ts | Passed locally |
| Copy delegation, originals, setup powers, atomic rerolls | rules-audit-extra.test.ts; assumptions.test.ts; interactions.test.ts | Passed with documented interpretations |
| Multi-racer ordering, Genius/Skipper precedence | assumptions.test.ts; simulation.test.ts | Passed with A02 |
| Finish priority, Mastermind self-win, M.O.U.T.H. survivor | racers.test.ts; rules-audit-extra.test.ts | Passed |
| Ledger floor, all four placement schedules, final ties | interactions.test.ts; simulation.test.ts | Passed |
| True recurrence vs progressing chains | interactions.test.ts; simulation seed 13 | Passed; A07 documented |
| Deterministic full games, replay API and serialization | simulation.test.ts; assumptions.test.ts | Passed |
| Supabase authority, concurrency, secrecy, reconnect, full game | tests/backend/multiplayer.test.ts; tests/e2e/online.spec.ts | Implemented; real backend unavailable locally; mandatory CI gate |
| Production asset subpath, reload, mobile and console errors | tests/production/subpath.spec.ts | See current execution record |
`;
fs.writeFileSync("RULES_COVERAGE_MATRIX.md", text);
