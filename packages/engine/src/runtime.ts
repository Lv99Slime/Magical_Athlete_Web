import { RACERS, SCHEDULE, TRACKS, racerName } from "./catalog.ts";
import type {
  GameState,
  RacerInstance,
  RandomSource,
  ResolutionFrame,
  DecisionOption,
} from "./types.ts";
import { powers } from "./powers.ts";

export class Runtime {
  parentId?: number;
  constructor(
    public s: GameState,
    public rng: RandomSource,
  ) {}
  get active() {
    return this.s.racers.filter((r) => r.status === "active");
  }
  get current() {
    return this.s.racers.find((r) => r.id === this.s.turn?.racerId);
  }
  racer(id: string) {
    const r = this.s.racers.find((r) => r.id === id);
    if (!r) throw new Error("Unknown racer");
    return r;
  }
  name(id: string) {
    return racerName(this.racer(id).racerId);
  }
  random() {
    const n = this.rng();
    if (n < 0 || n >= 1 || !Number.isFinite(n))
      throw new Error("Invalid random outcome");
    this.s.randomOutcomes.push(n);
    return n;
  }
  die(label: string) {
    const face = 1 + Math.floor(this.random() * 6);
    this.log("DIE_ROLLED", `${label} rolled ${face}.`, undefined, { face });
    return face;
  }
  log(
    type: string,
    message: string,
    racerId?: string,
    data?: Record<string, any>,
  ) {
    const e = {
      id: ++this.s.eventCounter,
      type,
      message,
      racerId,
      data,
      parentId: this.parentId,
    };
    this.s.events.push(e);
    return e.id;
  }
  push(...frames: ResolutionFrame[]) {
    this.s.queue.unshift(
      ...frames.map((f) => ({ ...f, parentId: f.parentId ?? this.parentId })),
    );
  }
  score(r: RacerInstance, amount: number, reason: string) {
    const p = this.s.players.find((p) => p.id === r.ownerId)!;
    amount = Math.max(-p.score, amount);
    p.score += amount;
    this.s.ledger.push({
      playerId: p.id,
      amount,
      reason,
      race: this.s.raceNumber,
    });
    this.log(
      "POINTS",
      `${p.name} ${amount >= 0 ? "+" : ""}${amount}: ${reason}.`,
      r.id,
      { amount },
    );
  }
  ask(
    r: RacerInstance,
    kind: string,
    prompt: string,
    options: DecisionOption[],
    context: Record<string, any> = {},
  ) {
    if (!options.length) return;
    this.s.pending = {
      id: `d${++this.s.decisionCounter}`,
      ownerId: r.ownerId,
      kind,
      prompt,
      options,
      context: { racerId: r.id, ...context },
    };
  }
  occurrence(r: RacerInstance, powerId = this.power(r)) {
    this.log(
      "POWER_TRIGGERED",
      `${racerName(r.racerId)} — ${RACERS.find((x) => x.id === powerId)?.powerName ?? powerId}`,
      r.id,
      { powerId },
    );
    return { kind: "notifyPower", source: r.id, powerId };
  }
  effect(r: RacerInstance, frames: ResolutionFrame[], powerId = this.power(r)) {
    const notice = this.occurrence(r, powerId);
    const scope = this.s.eventCounter;
    this.push(
      ...frames.map((f) => ({ ...f, effectScope: scope, parentId: scope })),
      { ...notice, effectScope: scope, parentId: scope },
    );
  }
  move(r: RacerInstance, delta: number, cause = "power"): ResolutionFrame {
    return { kind: "move", racerId: r.id, delta, cause };
  }
  warp(r: RacerInstance, position: number): ResolutionFrame {
    return { kind: "warp", racerId: r.id, position };
  }
  trip(r: RacerInstance) {
    if (r.status !== "active") return;
    r.tripped = true;
    this.log(
      "RACER_TRIPPED",
      `${racerName(r.racerId)} trips; its next main move is skipped.`,
      r.id,
    );
  }
  power(r: RacerInstance, seen: string[] = []): string {
    if (r.status !== "active") return "";
    if (this.s.frozenPowers?.[r.id] !== undefined)
      return this.s.frozenPowers[r.id];
    if (r.powerId !== "copy_cat") return r.powerId;
    if (seen.includes(r.id)) return "";
    const max = Math.max(...this.active.map((x) => x.position));
    const leaders = this.active.filter(
      (x) => x.position === max && x.id !== r.id,
    );
    const selected =
      leaders.find((x) => x.id === r.memory.copySource) ??
      (leaders.length === 1 ? leaders[0] : undefined);
    return selected ? this.power(selected, [...seen, r.id]) : "";
  }
  ordered() {
    const start = this.current
      ? this.s.players.findIndex((p) => p.id === this.current!.ownerId)
      : this.s.starter;
    const ids = this.s.players.map(
      (_, i) => this.s.players[(start + i) % this.s.players.length].id,
    );
    return [...this.active].sort(
      (a, b) =>
        ids.indexOf(a.ownerId) - ids.indexOf(b.ownerId) ||
        this.s.turnOrder.indexOf(a.id) - this.s.turnOrder.indexOf(b.id),
    );
  }
  has(powerId: string) {
    return this.ordered().filter((r) => this.power(r) === powerId);
  }
  trigger(timing: string, data: Record<string, any> = {}) {
    if (timing === "stop") {
      const arriving = this.racer(data.racerId);
      const group = data.group ?? [];
      data = {
        ...data,
        babaTargets: Object.fromEntries(
          this.has("baba_yaga").map((r) => [
            r.id,
            this.active
              .filter(
                (x) =>
                  x.id !== r.id &&
                  x.position === data.position &&
                  r.position === data.position &&
                  (arriving.id === r.id || x.id === arriving.id) &&
                  !(group.includes(r.id) && group.includes(x.id)),
              )
              .map((x) => x.id),
          ]),
        ),
      };
    }
    this.push(
      ...this.ordered().map((r) => ({
        kind: "ability",
        racerId: r.id,
        powerId: this.power(r),
        timing,
        data,
      })),
    );
  }
  resolve() {
    let steps = 0;
    const automaticTurns = new Set<string>();
    while (this.s.queue.length && !this.s.pending && this.s.phase === "race") {
      if (++steps > 20000)
        throw new Error(
          `Resolution safety limit exceeded; game not committed: ${JSON.stringify(this.s.queue.slice(0, 4))}; ${JSON.stringify(this.s.events.slice(-5))}`,
        );
      const f = this.s.queue.shift()!;
      this.parentId = f.parentId;
      if (f.kind === "beginTurn") {
        const key = JSON.stringify([
          this.s.turnIndex,
          this.s.racers.map((r) => [
            r.id,
            r.position,
            r.status,
            r.tripped,
            r.powerId,
            r.memory,
          ]),
          this.s.nextOverride,
        ]);
        if (automaticTurns.has(key)) {
          this.log(
            "UNFINISHABLE_RACE",
            "A forced turn cycle prevents further progress; remaining placement points are unawarded.",
          );
          this.endRace();
          break;
        }
        automaticTurns.add(key);
      }
      if (f.kind === "move" || f.kind === "warp") {
        const {
          effectScope: _scope,
          parentId: _parent,
          ...mechanicalFrame
        } = f;
        // Scope recurrence to one causal chain: independent later uses of the
        // same power must not be mistaken for a loop merely because positions match.
        let causalRoot = f.parentId;
        let ancestor =
          causalRoot === undefined
            ? undefined
            : this.s.events.find((e) => e.id === causalRoot);
        while (ancestor?.parentId !== undefined) {
          causalRoot = ancestor.parentId;
          ancestor = this.s.events.find((e) => e.id === causalRoot);
        }
        const signature = JSON.stringify([
          causalRoot,
          mechanicalFrame,
          this.s.racers.map((r) => [
            r.id,
            r.position,
            r.status,
            r.tripped,
            r.powerId,
            r.memory,
          ]),
          this.s.turn,
          this.s.nextOverride,
          this.s.placements,
          this.s.players.map((p) => p.score === 0),
        ]);
        if (this.s.cycleSeen.includes(signature)) {
          this.log(
            "LOOP_STOPPED",
            "A repeated power cycle completed once and stops here.",
          );
          if (f.effectScope)
            this.s.queue = this.s.queue.filter(
              (q) => q.effectScope !== f.effectScope,
            );
          continue;
        }
        this.s.cycleSeen.push(signature);
      }
      this.step(f);
    }
  }
  step(f: ResolutionFrame) {
    switch (f.kind) {
      case "ability": {
        const r = this.racer(f.racerId);
        if (r.status === "active")
          powers[f.powerId]?.on[f.timing]?.(this, r, f.data);
        break;
      }
      case "trigger":
        this.trigger(f.timing, f.data);
        break;
      case "notifyPower":
        this.trigger("power", { source: f.source, powerId: f.powerId });
        break;
      case "beforeRace":
        this.trigger("beforeRace");
        break;
      case "copySetup": {
        const r = this.racer(f.racerId);
        if (f.visited?.includes(r.powerId)) {
          r.powerId = "";
          this.log("COPY_CYCLE", "Copy cycle stopped.", r.id);
          break;
        }
        this.push({
          kind: "ability",
          racerId: r.id,
          powerId: r.powerId,
          timing: "beforeRace",
          data: { visited: [...(f.visited ?? []), r.powerId] },
        });
        break;
      }
      case "syncCopies": {
        if (this.s.frozenPowers) break;
        for (const r of this.ordered().filter(
          (x) => x.powerId === "copy_cat",
        )) {
          const max = Math.max(...this.active.map((x) => x.position));
          const leaders = this.active.filter(
            (x) => x.position === max && x.id !== r.id,
          );
          if (
            leaders.length > 1 &&
            !leaders.some((x) => x.id === r.memory.copySource)
          ) {
            this.push(f);
            this.ask(
              r,
              "copyLeader",
              "Choose a leading racer to copy.",
              leaders.map((x) => ({ id: x.id, label: racerName(x.racerId) })),
            );
            return;
          }
          if (leaders.length === 1) r.memory.copySource = leaders[0].id;
        }
        break;
      }
      case "beginTurn": {
        if (!this.active.length) {
          this.endRace();
          break;
        }
        let r = this.s.racers.find(
          (x) => x.id === this.s.turnOrder[this.s.turnIndex],
        );
        while (!r || r.status !== "active") {
          this.s.turnIndex = (this.s.turnIndex + 1) % this.s.turnOrder.length;
          r = this.racer(this.s.turnOrder[this.s.turnIndex]);
        }
        this.s.turn = {
          racerId: r.id,
          start: r.position,
          skip: false,
          magicianRerolls: 0,
          dicemongerUsed: false,
          extra: false,
        };
        this.log("TURN_STARTED", `${racerName(r.racerId)} takes a turn.`, r.id);
        this.push(
          { kind: "syncCopies" },
          { kind: "trigger", timing: "turnStart", data: { racerId: r.id } },
          { kind: "trigger", timing: "beforeMain", data: { racerId: r.id } },
          { kind: "mainReady" },
        );
        break;
      }
      case "mainReady": {
        const r = this.current;
        if (!r || r.status !== "active") {
          this.push({ kind: "endTurn" });
          break;
        }
        if (r.tripped || this.s.turn!.hareSkip) {
          const recovering = r.tripped;
          r.tripped = false;
          this.s.turn!.skip = true;
          this.log(
            "MAIN_MOVE_SKIPPED",
            `${racerName(r.racerId)} ${recovering ? "recovers from trip" : "rests alone in the lead"}.`,
            r.id,
          );
          this.push({ kind: "endTurn" });
          break;
        }
        const p = this.power(r);
        if (p === "legs")
          this.ask(r, "mainChoice", "Roll, or JOG for a base move of 5?", [
            { id: "roll", label: "Roll die" },
            { id: "fixed", label: "JOG — move 5" },
          ]);
        else if (p === "flip_flop")
          this.ask(r, "mainChoice", "Roll, or swap positions?", [
            { id: "roll", label: "Roll die" },
            ...this.active
              .filter((x) => x.id !== r.id)
              .map((x) => ({
                id: x.id,
                label: `Swap with ${racerName(x.racerId)}`,
              })),
          ]);
        else
          this.log(
            "AWAITING_ROLL",
            `${racerName(r.racerId)} is ready to roll.`,
            r.id,
          );
        break;
      }
      case "roll": {
        const r = this.current!;
        if (!this.s.frozenPowers)
          this.s.frozenPowers = Object.fromEntries(
            this.active.map((x) => [x.id, this.power(x)]),
          );
        this.s.turn!.face = this.die(racerName(r.racerId));
        this.push(...(f.notice ? [f.notice] : []), { kind: "rerollWindow" });
        break;
      }
      case "rerollWindow": {
        const r = this.current!;
        if (r.status !== "active") {
          this.push({ kind: "endTurn" });
          break;
        }
        const opts = [{ id: "keep", label: `Keep ${this.s.turn!.face}` }];
        if (this.power(r) === "magician" && this.s.turn!.magicianRerolls < 2)
          opts.push({
            id: "magician",
            label: `POOF reroll (${2 - this.s.turn!.magicianRerolls} left)`,
          });
        if (this.has("dicemonger").length && !this.s.turn!.dicemongerUsed)
          opts.push({ id: "dicemonger", label: "DICEY DEALS reroll" });
        if (opts.length === 1) this.push({ kind: "finalizeDie" });
        else this.ask(r, "reroll", "Keep the roll or use a reroll?", opts);
        break;
      }
      case "finalizeDie": {
        const r = this.current!;
        this.s.turn!.amount = this.s.turn!.face;
        this.log(
          "DIE_FINALIZED",
          `${racerName(r.racerId)} keeps ${this.s.turn!.face}.`,
          r.id,
          { face: this.s.turn!.face },
        );
        this.push(
          {
            kind: "trigger",
            timing: "die",
            data: { racerId: r.id, face: this.s.turn!.face },
          },
          { kind: "mainAmount" },
        );
        break;
      }
      case "mainAmount": {
        const r = this.current!;
        if (r.status !== "active" || this.s.turn!.skip) {
          this.push({ kind: "endTurn" });
          break;
        }
        this.push(
          { kind: "trigger", timing: "amount", data: { racerId: r.id } },
          { kind: "mainMove" },
        );
        break;
      }
      case "mainMove": {
        const r = this.current!;
        if (r.status === "active" && !this.s.turn!.skip)
          this.push(
            this.move(r, Math.max(0, this.s.turn!.amount ?? 0), "main"),
            { kind: "endTurn" },
          );
        else this.push({ kind: "endTurn" });
        break;
      }
      case "endTurn": {
        const r = this.current!;
        this.s.frozenPowers = undefined;
        this.push(
          { kind: "syncCopies" },
          {
            kind: "trigger",
            timing: "turnEnd",
            data: { racerId: r.id, start: this.s.turn!.start },
          },
          { kind: "advanceTurn" },
        );
        break;
      }
      case "advanceTurn": {
        const r = this.current!;
        this.log("TURN_ENDED", `${racerName(r.racerId)} ends its turn.`, r.id);
        if (this.s.turn!.extra && r.status === "active")
          this.s.turnIndex = this.s.turnOrder.indexOf(r.id);
        else if (
          this.s.nextOverride &&
          this.racer(this.s.nextOverride).status === "active"
        ) {
          const skipper = this.racer(this.s.nextOverride);
          const same = this.s.turnOrder.filter(
            (id) =>
              this.racer(id).ownerId === skipper.ownerId && id !== skipper.id,
          );
          const owners = this.s.players.map((p) => p.id);
          const si = owners.indexOf(skipper.ownerId);
          const rest = owners
            .slice(si + 1)
            .concat(owners.slice(0, si))
            .flatMap((o) =>
              this.s.turnOrder.filter((id) => this.racer(id).ownerId === o),
            );
          this.s.turnOrder = [skipper.id, ...same, ...rest];
          this.s.turnIndex = 0;
          this.s.nextOverride = undefined;
        } else
          this.s.turnIndex = (this.s.turnIndex + 1) % this.s.turnOrder.length;
        this.s.cycleSeen = [];
        this.push({ kind: "beginTurn" });
        break;
      }
      case "move":
        this.prepareMove(f);
        break;
      case "commitMove":
        this.commitMove(f);
        break;
      case "group": {
        const fish = this.has("suckerfish").find(
          (x) =>
            !f.asked?.includes(x.id) &&
            f.moves.some(
              (m: any) =>
                m.id !== x.id &&
                m.delta !== 0 &&
                this.racer(m.id).position === x.position,
            ),
        );
        if (fish) {
          const carriers = f.moves.filter(
            (m: any) =>
              m.id !== fish.id &&
              m.delta !== 0 &&
              this.racer(m.id).position === fish.position,
          );
          this.ask(
            fish,
            "groupFollow",
            "Follow a racer moving with this group?",
            [
              { id: "no", label: "Stay with own move" },
              ...carriers.map((m: any) => ({
                id: m.id,
                label: `Follow ${this.name(m.id)}`,
              })),
            ],
            { group: { ...f, asked: [...(f.asked ?? []), fish.id] } },
          );
          break;
        }
        this.commitGroup(f);
        break;
      }
      case "warp": {
        const r = this.racer(f.racerId);
        if (r.status !== "active") break;
        const old = r.position;
        r.position = Math.max(0, Math.min(29, f.position));
        this.log(
          "WARP",
          `${this.name(r.id)} warps from ${old} to ${r.position}.`,
          r.id,
          { from: old, to: r.position },
        );
        this.push({
          kind: "arrivals",
          arrivals: [{ id: r.id, from: old, to: r.position }],
          group: [],
        });
        break;
      }
      case "swap": {
        const a = this.racer(f.a),
          b = this.racer(f.b);
        const pa = a.position,
          pb = b.position;
        a.position = pb;
        b.position = pa;
        this.log(
          "WARP",
          `${this.name(a.id)} and ${this.name(b.id)} swap.`,
          a.id,
        );
        this.push({
          kind: "arrivals",
          arrivals: [
            { id: a.id, from: pa, to: pb },
            { id: b.id, from: pb, to: pa },
          ],
          group: [a.id, b.id],
        });
        break;
      }
      case "arrivals": {
        const frames: ResolutionFrame[] = [];
        for (const a of f.arrivals)
          if (this.racer(a.id).status === "active")
            frames.push({ kind: "track", ...a, group: f.group });
        for (const a of f.arrivals)
          if (this.racer(a.id).status === "active")
            frames.push({ kind: "stop", ...a, group: f.group });
        this.push(...frames, { kind: "syncCopies" });
        break;
      }
      case "track": {
        const r = this.racer(f.id);
        if (r.status !== "active" || r.position !== f.to || r.position === 30)
          break;
        const track = TRACKS.find(
          (t) => t.id === SCHEDULE[this.s.raceNumber - 1].trackId,
        )!;
        const space = track.specialSpaces.find(
          (x) => x.position === r.position,
        );
        if (space) {
          this.log(
            "TRACK_SPACE_TRIGGERED",
            `${this.name(r.id)} stops on ${space.type}.`,
            r.id,
          );
          if (space.type === "arrow")
            this.push(this.move(r, space.delta!, "track"));
          if (space.type === "trip") this.trip(r);
          if (space.type === "star") this.score(r, 1, "Star");
        }
        break;
      }
      case "stop": {
        const r = this.racer(f.id);
        if (r.status !== "active" || r.position !== f.to) break;
        this.log(
          "RACER_STOPPED",
          `${this.name(r.id)} stops at ${r.position}.`,
          r.id,
        );
        this.trigger("stop", {
          racerId: r.id,
          position: r.position,
          group: f.group ?? [],
        });
        break;
      }
      case "trip":
        this.trip(this.racer(f.racerId));
        break;
      case "finish":
        this.finish(this.racer(f.racerId));
        break;
      case "duelWindow": {
        const duelists = this.has("duelist");
        for (const r of duelists) {
          const peers = this.active.filter(
            (x) => x.id !== r.id && x.position === r.position,
          );
          if (!peers.length) continue;
          this.ask(r, "duel", "Challenge a racer sharing your space?", [
            { id: "no", label: "No duel" },
            ...peers.map((x) => ({
              id: x.id,
              label: `Duel ${racerName(x.racerId)}`,
            })),
          ]);
          return;
        }
        break;
      }
      default:
        throw new Error(`Unknown resolution frame ${f.kind}`);
    }
  }
  path(r: RacerInstance, delta: number) {
    let pos = r.position;
    let count = 0;
    let skips = 0;
    const leap = this.power(r) === "leaptoad";
    const direction = Math.sign(delta);
    while (count < Math.abs(delta) && pos >= 0 && pos < 30) {
      pos += direction;
      if (pos < 0) {
        pos = 0;
        break;
      }
      if (
        leap &&
        pos < 30 &&
        this.active.some((x) => x.id !== r.id && x.position === pos)
      ) {
        skips++;
      } else count++;
      if (pos === 0 && direction < 0) break;
    }
    // Overshoot beyond Finish is material for Stickler validation.
    if (pos >= 30) pos += Math.abs(delta) - count;
    return { to: pos, skips };
  }
  prepareMove(f: ResolutionFrame) {
    const r = this.racer(f.racerId);
    if (r.status !== "active" || f.delta === 0) return;
    const path = this.path(r, f.delta);
    if (this.has("stickler").some((x) => x.id !== r.id) && path.to > 30) {
      this.log(
        "MOVE_CANCELLED",
        `${this.name(r.id)} would overshoot Finish; ACTUALLY… cancels the move.`,
        r.id,
      );
      return;
    }
    const eligible = this.has("suckerfish").filter(
      (x) =>
        x.id !== r.id && x.position === r.position && !f.asked?.includes(x.id),
    );
    if (eligible.length) {
      const fish = eligible[0];
      this.ask(
        fish,
        "follow",
        `Follow ${this.name(r.id)} for its complete move?`,
        [
          { id: "yes", label: "Follow" },
          { id: "no", label: "Stay" },
        ],
        { move: { ...f, asked: [...(f.asked ?? []), fish.id] }, to: path.to },
      );
      return;
    }
    this.push({ ...f, kind: "commitMove", to: path.to, skips: path.skips });
  }
  commitMove(f: ResolutionFrame) {
    const r = this.racer(f.racerId);
    if (r.status !== "active") return;
    const movers = [
      r,
      ...(f.followers ?? [])
        .map((id: string) => this.racer(id))
        .filter((x: RacerInstance) => x.status === "active"),
    ];
    const before = this.active.map((x) => ({ id: x.id, position: x.position }));
    const arrivals = movers.map((x) => ({
      id: x.id,
      from: x.position,
      to: Math.min(30, f.to),
    }));
    for (const a of arrivals) this.racer(a.id).position = a.to;
    this.log(
      "MOVE",
      `${this.name(r.id)} moves ${f.delta > 0 ? "+" : ""}${f.delta}: ${arrivals[0].from} → ${arrivals[0].to}.`,
      r.id,
      { cause: f.cause, from: arrivals[0].from, to: arrivals[0].to },
    );
    const frames: ResolutionFrame[] = [];
    for (const a of arrivals)
      if (a.to >= 30) frames.push({ kind: "finish", racerId: a.id });
    for (let i = 0; i < f.skips; i++)
      frames.push(this.occurrence(r, "leaptoad"));
    for (const a of arrivals) {
      for (const other of before)
        if (
          !movers.some((x) => x.id === other.id) &&
          a.from < other.position &&
          a.to > other.position
        )
          frames.push({
            kind: "trigger",
            timing: "pass",
            data: { mover: a.id, passed: other.id },
          });
    }
    frames.push({
      kind: "arrivals",
      arrivals: arrivals.filter((a) => a.to < 30),
      group: movers.length > 1 ? movers.map((x) => x.id) : [],
    });
    for (const fish of movers.slice(1))
      frames.push(this.occurrence(fish, "suckerfish"));
    this.push(...frames);
  }
  commitGroup(f: ResolutionFrame) {
    const before = this.active.map((r) => ({ id: r.id, position: r.position }));
    const arrivals: any[] = [];
    const frames: ResolutionFrame[] = [];
    for (const m of f.moves) {
      const r = this.racer(m.id);
      if (r.status !== "active" || m.delta === 0) continue;
      const p = this.path(r, m.delta);
      if (this.has("stickler").some((x) => x.id !== r.id) && p.to > 30)
        continue;
      arrivals.push({ id: r.id, from: r.position, to: Math.min(30, p.to) });
      for (let i = 0; i < p.skips; i++)
        frames.push(this.occurrence(r, "leaptoad"));
    }
    for (const follow of f.followers ?? []) {
      const carrier = arrivals.find((a) => a.id === follow.carrier);
      if (!carrier) continue;
      const fish = this.racer(follow.fish);
      const existing = arrivals.find((a) => a.id === fish.id);
      if (existing) existing.to = carrier.to;
      else arrivals.push({ id: fish.id, from: fish.position, to: carrier.to });
      frames.push(this.occurrence(fish, "suckerfish"));
    }
    for (const a of arrivals) this.racer(a.id).position = a.to;
    const finishes = arrivals
      .filter((a) => a.to >= 30)
      .map((a) => ({ kind: "finish", racerId: a.id }));
    for (const a of arrivals) {
      this.log(
        "MOVE",
        `${this.name(a.id)} moves with the group: ${a.from} → ${a.to}.`,
        a.id,
      );
      for (const b of before)
        if (
          b.id !== a.id &&
          a.from < b.position &&
          a.to > (arrivals.find((x) => x.id === b.id)?.to ?? b.position)
        )
          frames.push({
            kind: "trigger",
            timing: "pass",
            data: { mover: a.id, passed: b.id },
          });
    }
    this.push(...finishes, ...frames, {
      kind: "arrivals",
      arrivals: arrivals.filter((a) => a.to < 30),
      group: arrivals.map((a) => a.id),
    });
  }
  finish(r: RacerInstance) {
    if (r.status !== "active") return;
    const predictors = this.has("mastermind").filter(
      (x) => x.memory.prediction === r.id,
    );
    r.status = "finished";
    r.position = 30;
    this.s.placements.push(r.id);
    const place = this.s.placements.length;
    this.score(
      r,
      place === 1
        ? SCHEDULE[this.s.raceNumber - 1].firstPoints
        : SCHEDULE[this.s.raceNumber - 1].secondPoints,
      place === 1 ? "First place" : "Second place",
    );
    this.log(
      "FINISH",
      `${this.name(r.id)} takes ${place === 1 ? "first" : "second"} place.`,
      r.id,
    );
    if (place === 1 && predictors.length) {
      const m = predictors[0];
      this.s.placements.push(m.id);
      this.score(
        m,
        SCHEDULE[this.s.raceNumber - 1].secondPoints,
        "Mastermind prediction",
      );
      this.log(
        "POWER_TRIGGERED",
        `${this.name(m.id)} predicted the winner and takes second.`,
        m.id,
      );
      this.endRace();
      return;
    }
    if (place >= 2) this.endRace();
  }
  eliminate(r: RacerInstance) {
    r.status = "eliminated";
    r.memory.eliminationOrder = this.s.eventCounter;
    this.log("RACER_ELIMINATED", `${this.name(r.id)} is eliminated.`, r.id);
    if (this.active.length === 1) {
      this.finish(this.active[0]);
      if (this.s.phase === "race") this.endRace();
    } else if (!this.active.length) this.endRace();
  }
  endRace() {
    const gains = Object.fromEntries(
      this.s.players.map((p) => [
        p.id,
        p.score - (this.s.raceStartScores[p.id] ?? 0),
      ]),
    );
    this.s.history.push({
      race: this.s.raceNumber,
      winner: this.s.placements[0]
        ? this.racer(this.s.placements[0]).racerId
        : undefined,
      placements: [...this.s.placements],
      racers: structuredClone(this.s.racers),
      gains,
    });
    this.s.phase = this.s.raceNumber === 4 ? "finished" : "results";
    this.s.queue = [];
    this.s.pending = undefined;
    this.log("RACE_ENDED", `Race ${this.s.raceNumber} ends.`);
  }
  choose(option: string) {
    const d = this.s.pending!;
    const r = this.racer(d.context.racerId);
    this.s.pending = undefined;
    switch (d.kind) {
      case "copyLeader":
        r.memory.copySource = option;
        break;
      case "mainChoice":
        if (option === "roll") this.push({ kind: "roll" });
        else if (option === "fixed") {
          this.s.turn!.amount = 5;
          this.push(this.occurrence(r, "legs"), { kind: "mainAmount" });
        } else
          this.push(
            { kind: "swap", a: r.id, b: option },
            this.occurrence(r, "flip_flop"),
            { kind: "endTurn" },
          );
        break;
      case "reroll":
        if (option === "keep") this.push({ kind: "finalizeDie" });
        else {
          if (option === "magician") {
            this.s.turn!.magicianRerolls++;
            this.push({ kind: "roll", notice: this.occurrence(r, "magician") });
          } else {
            this.s.turn!.dicemongerUsed = true;
            const ds = this.has("dicemonger");
            this.push(
              ...ds.flatMap((x) => [
                ...(x.id === r.id ? [] : [this.move(x, 1)]),
                this.occurrence(x, "dicemonger"),
              ]),
              { kind: "roll" },
            );
          }
        }
        break;
      case "groupFollow": {
        const g = d.context.group;
        if (option !== "no")
          g.followers = [
            ...(g.followers ?? []),
            { fish: r.id, carrier: option },
          ];
        this.push(g);
        break;
      }
      case "follow": {
        const m = d.context.move;
        if (option === "yes") m.followers = [...(m.followers ?? []), r.id];
        this.push(m);
        break;
      }
      case "duel":
        if (option !== "no") {
          const b = this.racer(option);
          const aDie = this.die(this.name(r.id)),
            bDie = this.die(this.name(b.id));
          this.effect(r, [this.move(aDie >= bDie ? r : b, 2)]);
        }
        break;
      default:
        powers[d.context.powerId ?? this.power(r)]?.choose?.(
          this,
          r,
          d,
          option,
        );
        break;
    }
  }
}
