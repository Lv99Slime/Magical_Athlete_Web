import type { DomainEvent, PlayerView } from "@magical/engine";
import type { SoundCue } from "./gameAudio";

export interface PlaybackFrame {
  view: PlayerView;
  event: DomainEvent;
  duration: number;
  cue?: SoundCue;
  dicePhase?: "rolling" | "result";
  movingIds?: string[];
}
type Arrival = { id: string; from: number; to: number };

/** Visual snapshots only. Never apply commands, random draws or track triggers here. */
export function buildPlayback(
  previous: PlayerView,
  next: PlayerView,
): PlaybackFrame[] {
  const events = next.events.filter((e) => e.id > previous.eventCounter);
  const frames: PlaybackFrame[] = [];
  const view = structuredClone(previous);
  view.pending = undefined;
  const groups = new Set<string>();
  const add = (
    event: DomainEvent,
    duration: number,
    cue?: SoundCue,
    extra: Partial<PlaybackFrame> = {},
  ) => {
    frames.push({
      view: structuredClone(view),
      event,
      duration,
      cue,
      ...extra,
    });
  };
  for (const event of events) {
    const priorCounter = view.eventCounter;
    view.events.push(event);
    view.eventCounter = event.id;
    const racer = view.racers.find((r) => r.id === event.racerId);
    if (
      event.type === "DIE_ROLLED" &&
      Number.isInteger(event.data?.face) &&
      event.data!.face >= 1 &&
      event.data!.face <= 6
    ) {
      view.events.pop();
      view.eventCounter = priorCounter;
      add(event, 650, "roll", { dicePhase: "rolling" });
      view.events.push(event);
      view.eventCounter = event.id;
      add(event, 550, "result", { dicePhase: "result" });
    } else if (event.type === "MOVE" || event.type === "WARP") {
      if (event.data?.groupId && groups.has(event.data.groupId)) continue;
      if (event.data?.groupId) groups.add(event.data.groupId);
      const arrivals: Arrival[] =
        event.data?.arrivals ??
        (racer &&
        Number.isFinite(event.data?.from) &&
        Number.isFinite(event.data?.to)
          ? [{ id: racer.id, from: event.data!.from, to: event.data!.to }]
          : []);
      // Older logs without structured movement data are never guessed from prose.
      if (!arrivals.length) continue;
      const distance = Math.max(
        ...arrivals.map((a) => Math.abs(a.to - a.from)),
      );
      const steps = event.type === "WARP" ? 1 : distance;
      for (let step = 1; step <= steps; step++) {
        for (const a of arrivals) {
          const r = view.racers.find((r) => r.id === a.id);
          if (r)
            r.position =
              event.type === "WARP"
                ? a.to
                : a.from +
                  Math.sign(a.to - a.from) *
                    Math.max(0, step - (distance - Math.abs(a.to - a.from)));
        }
        add(
          event,
          event.type === "WARP" ? 480 : 180,
          event.type === "WARP" ? "warp" : "step",
          { movingIds: arrivals.map((a) => a.id) },
        );
      }
    } else if (event.type === "POWER_TRIGGERED") {
      add(event, 750, "power");
    } else if (event.type === "RACER_TRIPPED") {
      if (racer) racer.tripped = true;
      add(event, 480, "trip");
    } else if (event.type === "MAIN_MOVE_SKIPPED") {
      if (racer) racer.tripped = false;
      add(event, 400);
    } else if (event.type === "FINISH") {
      if (racer) {
        racer.status = "finished";
        racer.position = 30;
      }
      add(event, 650, "finish");
    } else if (event.type === "RACER_ELIMINATED") {
      if (racer) racer.status = "eliminated";
      add(event, 480);
    } else if (event.type === "POINTS") {
      const owner = view.players.find((p) => p.id === racer?.ownerId);
      if (owner && Number.isFinite(event.data?.amount))
        owner.score += event.data!.amount;
    } else if (
      event.type === "TRACK_SPACE_TRIGGERED" ||
      event.type === "MOVE_CANCELLED"
    ) {
      add(event, 450);
    }
  }
  return frames;
}
