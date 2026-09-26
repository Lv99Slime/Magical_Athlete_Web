import { useLayoutEffect, useEffect, useRef, useState } from "react";
import type { DomainEvent, PlayerView } from "@magical/engine";
import { useI18n } from "./i18n";
import { translateEvent } from "./racerTranslations";

export type DiceDisplay = { event: DomainEvent; phase: "rolling" | "result" };
type Snapshot = { view?: PlayerView; viewer: string };
type Presentation = Snapshot & { dice?: DiceDisplay; playing: boolean };
type Job = Snapshot & { rolls: DomainEvent[] };

export function newDiceEvents(previous: PlayerView, next: PlayerView) {
  return next.events.filter(
    (e) =>
      e.id > previous.eventCounter &&
      e.type === "DIE_ROLLED" &&
      Number.isInteger(e.data?.face) &&
      e.data!.face >= 1 &&
      e.data!.face <= 6,
  );
}

/** Canonical state saves immediately; only the projected UI waits for the real dice reveal. */
export function useDicePresentation(
  live: PlayerView | undefined,
  viewer: string,
  fast: boolean,
) {
  const [display, setDisplay] = useState<Presentation>({
    view: live,
    viewer,
    playing: false,
  });
  const previous = useRef<PlayerView | undefined>(undefined);
  const jobs = useRef<Job[]>([]);
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastDie = useRef<DiceDisplay | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    const prior = previous.current;
    previous.current = live;
    const instant =
      fast || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (
      !live ||
      !prior ||
      live.version < prior.version ||
      live.raceNumber !== prior.raceNumber ||
      instant
    ) {
      clearTimeout(timer.current);
      jobs.current = [];
      running.current = false;
      const latest =
        live?.phase === "race"
          ? [...live.events]
              .reverse()
              .find((e) => e.type === "DIE_ROLLED" && e.data?.face)
          : undefined;
      lastDie.current = latest ? { event: latest, phase: "result" } : undefined;
      setDisplay({ view: live, viewer, dice: lastDie.current, playing: false });
      return;
    }
    if (prior === live) return;
    const rolls = prior.phase === "race" ? newDiceEvents(prior, live) : [];
    jobs.current.push({ view: live, viewer, rolls });
    if (running.current) return;
    const pump = () => {
      const job = jobs.current.shift();
      if (!job) {
        running.current = false;
        return;
      }
      running.current = true;
      let index = 0;
      const revealNext = () => {
        const event = job.rolls[index++];
        if (!event) {
          setDisplay({
            view: job.view,
            viewer: job.viewer,
            dice: lastDie.current,
            playing: jobs.current.length > 0,
          });
          pump();
          return;
        }
        setDisplay((old) => ({
          ...old,
          dice: { event, phase: "rolling" },
          playing: true,
        }));
        timer.current = setTimeout(() => {
          lastDie.current = { event, phase: "result" };
          setDisplay((old) => ({
            ...old,
            dice: lastDie.current,
            playing: true,
          }));
          timer.current = setTimeout(revealNext, 550);
        }, 650);
      };
      revealNext();
    };
    pump();
  }, [live, viewer, fast]);
  return display;
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
export function DiceReveal({
  dice,
  view,
  playing,
}: {
  dice: DiceDisplay;
  view: PlayerView;
  playing: boolean;
}) {
  const { t, locale } = useI18n();
  const rolling = dice.phase === "rolling";
  const face = dice.event.data!.face as number;
  return (
    <section
      className={`dice-reveal ${rolling ? "is-rolling" : ""}`}
      data-phase={dice.phase}
      data-event-id={dice.event.id}
      aria-label={t("Dice result", "骰子結果")}
    >
      <div
        className="dice-cube"
        role="img"
        aria-label={
          rolling
            ? t("Rolling die", "正在擲骰")
            : t(`Die result ${face}`, `骰子點數：${face}`)
        }
        data-face={rolling ? undefined : face}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <i
            key={i}
            className={
              (PIPS[rolling ? 5 : face] ?? []).includes(i)
                ? "pip visible"
                : "pip"
            }
          />
        ))}
      </div>
      <div role="status" aria-live="polite">
        <strong>
          {rolling
            ? t("Rolling…", "擲骰中…")
            : translateEvent(dice.event, locale, view)}
        </strong>
        <p>
          {rolling
            ? t("The die is rolling.", "骰子正在滾動。")
            : playing
              ? t("Result revealed — resolving next.", "骰點已揭示，即將結算。")
              : t(
                  "Last roll · movement may be modified by powers.",
                  "上次擲骰結果 · 實際步數可能受能力影響。",
                )}
        </p>
      </div>
    </section>
  );
}
