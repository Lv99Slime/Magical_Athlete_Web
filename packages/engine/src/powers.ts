import type { Runtime } from "./runtime.ts";
import type {
  RacerInstance,
  PendingDecision,
  ResolutionFrame,
} from "./types.ts";
import { racerName, TRACKS, SCHEDULE } from "./catalog.ts";
type Handler = (c: Runtime, r: RacerInstance, d: any) => void;
interface Ability {
  on: Record<string, Handler>;
  choose?: (
    c: Runtime,
    r: RacerInstance,
    d: PendingDecision,
    option: string,
  ) => void;
}
const own = (r: RacerInstance, d: any) => r.id === d.racerId;
const yesNo = [
  { id: "yes", label: "Use power" },
  { id: "no", label: "Pass" },
];
const otherOptions = (c: Runtime, _r: RacerInstance) => [
  { id: "no", label: "Pass" },
  ...c.active.map((x) => ({ id: x.id, label: racerName(x.racerId) })),
];
function optional(
  c: Runtime,
  r: RacerInstance,
  powerId: string,
  prompt: string,
  options = yesNo,
  context: any = {},
) {
  c.ask(r, "power", prompt, options, { powerId, ...context });
}
function amount(c: Runtime, r: RacerInstance, delta: number) {
  c.s.turn!.amount = (c.s.turn!.amount ?? 0) + delta;
  c.push(c.occurrence(r));
}
function stopPeers(c: Runtime, r: RacerInstance, d: any) {
  const a = c.racer(d.racerId);
  if (a.status !== "active" || a.position !== d.position) return [];
  return c.active.filter(
    (x) =>
      x.id !== a.id &&
      x.position === a.position &&
      !(d.group?.includes(a.id) && d.group?.includes(x.id)),
  );
}
export const powers: Record<string, Ability> = {
  alchemist: {
    on: {
      die: (c, r, d) => {
        if (own(r, d) && [1, 2].includes(d.face))
          optional(c, r, "alchemist", "Use 4 as the main-move amount?");
      },
    },
    choose: (c, r, _d, o) => {
      if (o === "yes") {
        c.s.turn!.amount = 4;
        c.push(c.occurrence(r, "alchemist"));
      }
    },
  },
  blimp: {
    on: {
      turnStart: (c, r, d) => {
        if (own(r, d))
          c.s.turn!.blimpModifier =
            r.position <
            TRACKS.find((t) => t.id === SCHEDULE[c.s.raceNumber - 1].trackId)!
              .secondCornerPosition
              ? 3
              : -1;
      },
      amount: (c, r, d) => {
        if (own(r, d)) amount(c, r, c.s.turn!.blimpModifier ?? 0);
      },
    },
  },
  coach: {
    on: {
      amount: (c, r, d) => {
        if (c.racer(d.racerId).position === r.position) amount(c, r, 1);
      },
    },
  },
  baba_yaga: {
    on: {
      stop: (c, r, d) => {
        const victims: string[] = d.babaTargets?.[r.id] ?? [];
        if (victims.length)
          c.effect(
            r,
            victims.map((id) => ({ kind: "trip", racerId: id })),
          );
      },
    },
  },
  centaur: {
    on: {
      pass: (c, r, d) => {
        if (d.mover === r.id && c.racer(d.passed).status === "active")
          c.effect(r, [c.move(c.racer(d.passed), -2)]);
      },
    },
  },
  copy_cat: { on: {} },
  banana: {
    on: {
      pass: (c, r, d) => {
        if (d.passed === r.id)
          c.effect(r, [{ kind: "trip", racerId: d.mover }]);
      },
    },
  },
  cheerleader: {
    on: {
      beforeMain: (c, r, d) => {
        if (own(r, d))
          optional(
            c,
            r,
            "cheerleader",
            "Move all last-place racers 2, then move yourself 1?",
          );
      },
    },
    choose: (c, r, _d, o) => {
      if (o === "yes") {
        const last = Math.min(...c.active.map((x) => x.position));
        c.effect(r, [
          {
            kind: "group",
            moves: c.active
              .filter((x) => x.position === last)
              .map((x) => ({ id: x.id, delta: 2 })),
          },
          c.move(r, 1),
        ]);
      }
    },
  },
  dicemonger: { on: {} },
  duelist: {
    on: {
      stop: (c, r, d) => {
        const a = c.racer(d.racerId);
        if (a.position !== r.position) return;
        const peers = stopPeers(c, r, d);
        if (!peers.length) return;
        const targets = c.active.filter(
          (x) =>
            x.id !== r.id &&
            x.position === r.position &&
            !(d.group?.includes(r.id) && d.group?.includes(x.id)),
        );
        if (targets.length)
          c.ask(r, "duel", "Challenge a racer sharing your space?", [
            { id: "no", label: "No duel" },
            ...targets.map((x) => ({
              id: x.id,
              label: `Duel ${racerName(x.racerId)}`,
            })),
          ]);
      },
      beforeMain: (c, r, _d) => {
        if (c.active.some((x) => x.id !== r.id && x.position === r.position))
          c.ask(r, "duel", "Challenge a racer before your main move?", [
            { id: "no", label: "No duel" },
            ...c.active
              .filter((x) => x.id !== r.id && x.position === r.position)
              .map((x) => ({
                id: x.id,
                label: `Duel ${racerName(x.racerId)}`,
              })),
          ]);
      },
    },
  },
  genius: {
    on: {
      beforeMain: (c, r, d) => {
        if (own(r, d) && !r.tripped)
          optional(c, r, "genius", "Predict your final main-move die.", [
            { id: "no", label: "No prediction" },
            ...[1, 2, 3, 4, 5, 6].map((n) => ({
              id: String(n),
              label: String(n),
            })),
          ]);
      },
      die: (c, r, d) => {
        if (own(r, d) && d.face === c.s.turn!.prediction) {
          c.s.turn!.extra = true;
          c.push(c.occurrence(r));
        }
      },
    },
    choose: (c, _r, _d, o) => {
      if (o !== "no") c.s.turn!.prediction = Number(o);
    },
  },
  heckler: {
    on: {
      turnEnd: (c, r, d) => {
        if (Math.abs(c.racer(d.racerId).position - d.start) <= 1)
          c.effect(r, [c.move(r, 2)]);
      },
    },
  },
  egg: {
    on: {
      beforeRace: (c, r, d) => {
        const cards = c.s.deck.splice(0, 3);
        c.s.discarded.push(...cards);
        if (cards.length)
          optional(
            c,
            r,
            "egg",
            "Choose one of Egg’s three new powers.",
            [
              { id: "no", label: "Keep Egg" },
              ...cards.map((id) => ({ id, label: racerName(id) })),
            ],
            { visited: d.visited ?? ["egg"] },
          );
      },
    },
    choose: (c, r, d, o) => {
      if (o !== "no") {
        r.powerId = o;
        c.effect(
          r,
          [{ kind: "copySetup", racerId: r.id, visited: d.context.visited }],
          "egg",
        );
      }
    },
  },
  gunk: {
    on: {
      amount: (c, r, d) => {
        if (!own(r, d)) amount(c, r, -1);
      },
    },
  },
  huge_baby: {
    on: {
      stop: (c, r, d) => {
        if (r.position === 0) return;
        const a = c.racer(d.racerId);
        if (a.position !== r.position) return;
        const peers = c.active.filter(
          (x) => x.id !== r.id && x.position === r.position,
        );
        if (!peers.length) return;
        const original = peers.find(
          (x) => x.racerId === "huge_baby" && c.power(x) === "huge_baby",
        );
        if (original && r.racerId !== "huge_baby") {
          c.effect(original, [c.warp(r, r.position - 1)]);
          return;
        }
        c.effect(
          r,
          peers.map((x) => c.warp(x, r.position - 1)),
        );
      },
    },
  },
  flip_flop: { on: {} },
  hare: {
    on: {
      turnStart: (c, r, d) => {
        if (own(r, d))
          c.s.turn!.hareSkip = c.active.every(
            (x) => x.id === r.id || x.position < r.position,
          );
      },
      amount: (c, r, d) => {
        if (own(r, d)) amount(c, r, 2);
      },
    },
  },
  hypnotist: {
    on: {
      beforeMain: (c, r, d) => {
        if (own(r, d))
          optional(
            c,
            r,
            "hypnotist",
            "Warp another racer onto your space?",
            otherOptions(c, r),
          );
      },
    },
    choose: (c, r, _d, o) => {
      if (o !== "no") c.effect(r, [c.warp(c.racer(o), r.position)]);
    },
  },
  inchworm: {
    on: {
      die: (c, r, d) => {
        if (!own(r, d) && d.face === 1) {
          c.s.turn!.skip = true;
          c.effect(r, [c.move(r, 1)]);
        }
      },
    },
  },
  legs: { on: {} },
  mastermind: {
    on: {
      turnStart: (c, r, d) => {
        if (own(r, d) && !r.memory.predicted) {
          r.memory.predicted = true;
          optional(
            c,
            r,
            "mastermind",
            "Predict the winner.",
            c.active.map((x) => ({ id: x.id, label: racerName(x.racerId) })),
          );
        }
      },
    },
    choose: (c, r, _d, o) => {
      r.memory.prediction = o;
      c.log(
        "PREDICTION",
        `${racerName(r.racerId)} predicts ${c.name(o)}.`,
        r.id,
      );
    },
  },
  lackey: {
    on: {
      die: (c, r, d) => {
        if (!own(r, d) && d.face === 6) c.effect(r, [c.move(r, 2)]);
      },
    },
  },
  loveable_loser: {
    on: {
      beforeMain: (c, r, d) => {
        if (
          own(r, d) &&
          c.active.every((x) => x.id === r.id || x.position > r.position)
        ) {
          c.score(r, 1, "Loveable Loser");
          c.push(c.occurrence(r));
        }
      },
    },
  },
  mouth: {
    on: {
      stop: (c, r, d) => {
        if (!own(r, d)) return;
        const peers = stopPeers(c, r, d);
        const population = c.active.filter((x) => x.position === r.position);
        if (peers.length === 1 && population.length === 2) {
          c.log("POWER_TRIGGERED", `${racerName(r.racerId)} — CHOMP`, r.id);
          c.eliminate(peers[0]);
          if (c.s.phase === "race")
            c.push({ kind: "notifyPower", source: r.id, powerId: "mouth" });
        }
      },
    },
  },
  leaptoad: { on: {} },
  magician: { on: {} },
  party_animal: {
    on: {
      beforeMain: (c, r, d) => {
        if (own(r, d))
          c.effect(r, [
            {
              kind: "group",
              moves: c.active
                .filter((x) => x.id !== r.id)
                .map((x) => ({
                  id: x.id,
                  delta: Math.sign(r.position - x.position),
                })),
            },
          ]);
      },
      amount: (c, r, d) => {
        if (own(r, d)) {
          const n = c.active.filter(
            (x) => x.id !== r.id && x.position === r.position,
          ).length;
          if (n) amount(c, r, n);
        }
      },
    },
  },
  rocket_scientist: {
    on: {
      die: (c, r, d) => {
        if (own(r, d))
          optional(
            c,
            r,
            "rocket_scientist",
            "Double your main move and trip afterwards?",
          );
      },
    },
    choose: (c, r, _d, o) => {
      if (o === "yes") {
        c.s.turn!.amount = (c.s.turn!.amount ?? 0) * 2;
        c.trip(r);
        c.push(c.occurrence(r));
      }
    },
  },
  sisyphus: {
    on: {
      beforeRace: (c, r) => {
        c.score(r, 4, "Sisyphus");
        c.push(c.occurrence(r));
      },
      die: (c, r, d) => {
        if (own(r, d) && d.face === 6) {
          c.s.turn!.skip = true;
          c.score(r, -1, "Sisyphus rolled 6");
          c.effect(r, [c.warp(r, 0)]);
        }
      },
    },
  },
  romantic: {
    on: {
      stop: (c, r, d) => {
        const a = c.racer(d.racerId);
        if (
          stopPeers(c, r, d).length === 1 &&
          c.active.filter((x) => x.position === a.position).length === 2
        )
          c.effect(r, [c.move(r, 2)]);
      },
    },
  },
  skipper: {
    on: {
      die: (c, r, d) => {
        if (d.face === 1) {
          const previous = c.s.nextOverride
            ? c.racer(c.s.nextOverride)
            : undefined;
          if (
            r.powerId === "copy_cat" &&
            previous &&
            previous.powerId !== "copy_cat"
          )
            return;
          c.s.nextOverride = r.id;
          c.push(c.occurrence(r));
        }
      },
    },
  },
  scoocher: {
    on: {
      power: (c, r, d) => {
        if (d.source !== r.id) c.effect(r, [c.move(r, 1)]);
      },
    },
  },
  stickler: { on: {} },
  suckerfish: { on: {} },
  third_wheel: {
    on: {
      beforeMain: (c, r, d) => {
        if (!own(r, d)) return;
        const positions = [...new Set(c.active.map((x) => x.position))].filter(
          (p) => c.active.filter((x) => x.position === p).length === 2,
        );
        if (positions.length)
          optional(
            c,
            r,
            "third_wheel",
            "Warp to a space with exactly two racers?",
            [
              { id: "no", label: "Pass" },
              ...positions.map((p) => ({ id: String(p), label: `Space ${p}` })),
            ],
          );
      },
    },
    choose: (c, r, _d, o) => {
      if (o !== "no") c.effect(r, [c.warp(r, Number(o))]);
    },
  },
  twin: {
    on: {
      beforeRace: (c, r, d) => {
        const winners = [
          ...new Set(
            c.s.history.map((x) => x.winner).filter((x): x is string => !!x),
          ),
        ];
        if (winners.length)
          optional(
            c,
            r,
            "twin",
            "Copy a winner from an earlier race?",
            [
              { id: "no", label: "Keep Twin" },
              ...winners.map((id) => ({ id, label: racerName(id) })),
            ],
            { visited: d.visited ?? ["twin"] },
          );
      },
    },
    choose: (c, r, d, o) => {
      if (o !== "no") {
        r.powerId = o;
        c.effect(
          r,
          [{ kind: "copySetup", racerId: r.id, visited: d.context.visited }],
          "twin",
        );
      }
    },
  },
};
export type { Ability, Handler, ResolutionFrame };
