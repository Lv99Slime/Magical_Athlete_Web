import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RoomView } from "../../apps/web/src/online";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const enabled = Boolean(url && key);
// These are real network/DB tests, deliberately skipped without a running backend.
describe.skipIf(!enabled)("authoritative Supabase multiplayer", () => {
  let host: SupabaseClient,
    guest: SupabaseClient,
    outsider: SupabaseClient,
    room: RoomView;
  let paced = false;
  const lastRequest = new Map<SupabaseClient, number>();
  async function user() {
    const client = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInAnonymously();
    if (error) throw error;
    return client;
  }
  async function api(client: SupabaseClient, path: string, body?: unknown) {
    if (paced) {
      // Stay below the production 120 authenticated requests/user/minute limit.
      const wait = Math.max(
        0,
        (lastRequest.get(client) ?? 0) + 750 - Date.now(),
      );
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest.set(client, Date.now());
    }
    const session = (await client.auth.getSession()).data.session!;
    const response = await fetch(`${url}/functions/v1/game${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: key!,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  const get = (client = host) => api(client, `/rooms/${room.id}`);
  const send = (
    client: SupabaseClient,
    action: unknown,
    expectedVersion = room.version,
    commandId = crypto.randomUUID(),
  ) =>
    api(client, `/rooms/${room.id}/actions`, {
      action,
      expectedVersion,
      commandId,
    });
  beforeAll(async () => {
    [host, guest, outsider] = await Promise.all([user(), user(), user()]);
    const created = await api(host, "/rooms", {
      nickname: "Host",
      commandId: crypto.randomUUID(),
    });
    expect(created.status).toBe(200);
    room = created.body;
  });
  it("authenticates requests and prevents canonical state / privileged RPC access", async () => {
    expect(
      (await fetch(`${url}/functions/v1/game/rooms/${room.id}`)).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${url}/functions/v1/game/rooms/${room.id}`, {
          headers: { Authorization: "Bearer forged.jwt.token", apikey: key! },
        })
      ).status,
    ).toBe(401);
    expect((await get(outsider)).status).toBe(403);
    for (const table of ["game_rooms", "game_members", "game_commands"]) {
      const result = await host.from(table).select("*");
      expect(result.error).toBeTruthy();
    }
    const write = await host
      .from("game_rooms")
      .update({ state: { forged: true } })
      .eq("id", room.id);
    expect(write.error).toBeTruthy();
    const rpc = await host.rpc("game_commit", {
      p_user: (await host.auth.getUser()).data.user!.id,
      p_command: crypto.randomUUID(),
      p_digest: "fake",
      p_room: room.id,
      p_expected: room.version,
      p_state: {},
      p_events: [],
      p_action: {},
      p_random: [],
    });
    expect(rpc.error).toBeTruthy();
  });
  it("joins one seat per identity and reconnects without changing seats", async () => {
    const first = await api(guest, "/rooms/join", {
      code: room.code,
      nickname: "Guest",
      commandId: crypto.randomUUID(),
    });
    expect(first.status).toBe(200);
    expect(first.body.playerId).toBe("p1");
    const second = await api(guest, "/rooms/join", {
      code: room.code,
      nickname: "Other name",
      commandId: crypto.randomUUID(),
    });
    expect(second.status).toBe(200);
    expect(second.body.members).toHaveLength(2);
    expect(second.body.playerId).toBe("p1");
    room = (await get()).body;
    const clone = createClient(url!, key!, { auth: { persistSession: false } });
    await clone.auth.setSession((await guest.auth.getSession()).data.session!);
    expect((await get(clone)).body.playerId).toBe("p1");
  });
  it("serializes competing commands and makes retries idempotent", async () => {
    const commandId = crypto.randomUUID(),
      version = room.version;
    const body = {
      commandId,
      expectedVersion: version,
      action: { type: "ready", ready: true },
    };
    const results = await Promise.all([
      api(host, `/rooms/${room.id}/actions`, body),
      api(host, `/rooms/${room.id}/actions`, body),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    room = (await get()).body;
    expect(room.version).toBe(version + 1);
    expect(
      (await send(host, { type: "ready", ready: false }, version, commandId))
        .status,
    ).toBe(409);
    const races = await Promise.all([
      send(host, { type: "ready", ready: false }),
      send(guest, { type: "ready", ready: true }),
    ]);
    expect(races.map((r) => r.status).sort()).toEqual([200, 409]);
    room = (await get()).body;
  });
  it("broadcasts version-only invalidation privately and gates start on host/readiness", async () => {
    expect((await send(guest, { type: "start" })).status).toBe(403);
    room = (await send(host, { type: "ready", ready: false })).body;
    expect((await send(host, { type: "start" })).status).toBe(422);
    const notifications: any[] = [];
    const channel = host
      .channel(`room:${room.id}`, { config: { private: true } })
      .on("broadcast", { event: "changed" }, (message) =>
        notifications.push(message.payload),
      );
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Private subscription timed out")),
        6000,
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR") {
          clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
    room = (await send(host, { type: "ready", ready: true })).body;
    room = (await send(guest, { type: "ready", ready: true })).body;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifications.length).toBeGreaterThan(0);
    for (const payload of notifications)
      expect(Object.keys(payload).sort()).toEqual(["roomId", "version"]);
    await host.removeChannel(channel);
    const started = await send(host, { type: "start", randomTeams: true });
    expect(started.status).toBe(200);
    room = started.body;
    expect(room.game?.phase).toBe("selection");
  });
  it("keeps selections private until simultaneous reveal and never leaks RNG/deck", async () => {
    const hostView = (await get()).body as RoomView;
    const ids = hostView
      .game!.players.find((p) => p.id === "p0")!
      .team.slice(0, 2);
    room = (await send(host, { type: "select", racerIds: ids })).body;
    const other = (await get(guest)).body as RoomView;
    expect(other.game!.selections.p0 ?? []).toEqual([]);
    for (const forbidden of [
      "deck",
      "discarded",
      "queue",
      "cycleSeen",
      "randomOutcomes",
    ])
      expect(other.game).not.toHaveProperty(forbidden);
    expect(JSON.stringify(other)).not.toContain("refresh_token");
    const guestIds = other
      .game!.players.find((p) => p.id === "p1")!
      .team.slice(0, 2);
    const revealed = await send(guest, { type: "select", racerIds: guestIds });
    expect(revealed.status).toBe(200);
    room = revealed.body;
    expect(room.game!.phase).toBe("race");
    const before = room.version;
    expect((await send(outsider, { type: "roll" })).status).toBe(403);
    expect(
      (await send(host, { type: "roll", actorId: "p1", face: 6 })).status,
    ).toBe(400);
    expect((await get()).body.version).toBe(before);
  });
  it("completes four authoritative races using each decision owner’s projected legal actions", async () => {
    paced = true;
    room = (await get()).body;
    const clients: Record<string, SupabaseClient> = { p0: host, p1: guest };
    for (
      let commands = 0;
      commands < 1000 && room.game!.phase !== "finished";
      commands++
    ) {
      const game = room.game!;
      const actor =
        game.phase === "selection"
          ? game.players.find((p) => !game.selectionReady.includes(p.id))?.id
          : game.phase === "draft"
            ? game.draft.order[game.draft.cursor]
            : game.phase === "results"
              ? "p0"
              : (game.pending?.ownerId ??
                game.racers.find((r) => r.id === game.turn?.racerId)?.ownerId);
      expect(actor, `No action owner in ${game.phase}`).toBeTruthy();
      if (room.playerId !== actor) {
        const refreshed = await get(clients[actor!]);
        expect(refreshed.status).toBe(200);
        room = refreshed.body;
      }
      const actions = room.game!.legalActions;
      expect(
        actions.length,
        `No legal actions for ${actor} at version ${room.version}`,
      ).toBeGreaterThan(0);
      const action =
        actions.find(
          (a) =>
            a.type === "choose" &&
            ["no", "keep", "stay", "decline"].includes(a.optionId),
        ) ?? actions[0];
      const version = room.version;
      const result = await send(clients[actor!], action);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      room = result.body;
      expect(room.version).toBe(version + 1);
      expect(room.game!.error).toBeUndefined();
    }
    expect(room.game!.phase).toBe("finished");
    expect(room.game!.history).toHaveLength(4);
    const first = (await get(host)).body as RoomView;
    const second = (await get(guest)).body as RoomView;
    expect(first.version).toBe(second.version);
    expect(first.game!.players.map((p) => p.score)).toEqual(
      second.game!.players.map((p) => p.score),
    );
    expect(first.game!.history).toEqual(second.game!.history);
  }, 720000);
});
