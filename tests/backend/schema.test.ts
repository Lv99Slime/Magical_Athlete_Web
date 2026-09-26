import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const schema = readFileSync("supabase/schema.sql", "utf8");
describe("backend deployment contract", () => {
  it("keeps browser roles away from authority and commits under a row lock", () => {
    expect(schema).toContain(
      "revoke all on public.game_rooms, public.game_members, public.game_commands from anon, authenticated",
    );
    expect(schema).toContain("where id=p_room for update");
    expect(schema).toContain(
      "if r.version<>p_expected then raise exception 'STALE_STATE'",
    );
    expect(schema).toContain("primary key(user_id,command_id)");
  });
  it("has a migration identical to documented schema", () => {
    expect(
      readFileSync("supabase/migrations/20260926000000_initial.sql", "utf8"),
    ).toBe(schema);
  });
});
