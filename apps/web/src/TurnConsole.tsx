import type { CSSProperties } from "react";
import type { PlayerAction, PlayerView } from "@magical/engine";
import { playerColor, racerStatusText, RacerArt } from "./components";
import { DiceReveal, type DiceDisplay } from "./dicePresentation";
import { PlaybackFeedback } from "./PlaybackFeedback";
import type { PlaybackFrame } from "./racePlayback";
import { useI18n } from "./i18n";
import { racerLabel } from "./racerTranslations";

interface TurnConsoleProps {
  view: PlayerView;
  dice?: DiceDisplay;
  frame?: PlaybackFrame;
  playing: boolean;
  skip: () => void;
  busy: boolean;
  /** False while the pass-and-play curtain hides the active player's controls. */
  canAct: boolean;
  act: (action: PlayerAction) => void;
}

/** Pre-race roll-offs share the DIE_ROLLED event type; only dice rolled inside this race are shown. */
export function diceForThisRace(view: PlayerView, dice?: DiceDisplay) {
  if (!dice) return undefined;
  const start = view.events
    .slice()
    .reverse()
    .find((e) => e.type === "RACE_STARTED");
  return !start || dice.event.id > start.id ? dice : undefined;
}

/** One compact strip: whose turn, their racer, the die and the single action that is needed now. */
export function TurnConsole({
  view,
  dice,
  frame,
  playing,
  skip,
  busy,
  canAct,
  act,
}: TurnConsoleProps) {
  const { t, locale } = useI18n();
  const current = view.racers.find((r) => r.id === view.turn?.racerId);
  const owner = view.players.find((p) => p.id === current?.ownerId);
  const canRoll = canAct && view.legalActions.some((a) => a.type === "roll");
  const liveDice = diceForThisRace(view, dice);
  const pendingOwner = view.players.find(
    (p) => p.id === view.pending?.ownerId,
  );
  const style = {
    "--player-color": owner ? playerColor(view, owner.id) : "transparent",
  } as CSSProperties;
  return (
    <section
      className={`turn-console ${canRoll ? "your-roll" : ""}`}
      aria-live="polite"
      style={style}
    >
      <div className="console-main">
        <div className="console-racer">
          {current && <RacerArt id={current.racerId} size={64} />}
          <div className="console-who">
            <p className="eyebrow">
              {owner?.name ?? t("Resolving effects", "正在處理效果")}
            </p>
            <h2>
              {current
                ? racerLabel(current.racerId, locale)
                : t("Race in progress", "比賽進行中")}
            </h2>
            {current && <small>{racerStatusText(current, view, locale)}</small>}
          </div>
        </div>
        <div className="console-dice">
          {liveDice ? (
            <DiceReveal dice={liveDice} view={view} playing={playing} />
          ) : (
            <div className="dice-idle" aria-hidden="true">
              <div className="dice-cube-idle">?</div>
              <small>{t("No roll yet", "尚未擲骰")}</small>
            </div>
          )}
        </div>
        <div className="console-action">
          {canRoll ? (
            <button
              className="primary roll-button"
              disabled={busy}
              onClick={() => act({ type: "roll" })}
            >
              {t("Roll die", "擲骰子")}
            </button>
          ) : (
            <p>
              {view.pending
                ? t(
                    `Waiting for ${pendingOwner?.name} to decide.`,
                    `等待 ${pendingOwner?.name} 作出選擇。`,
                  )
                : playing
                  ? t("Resolving…", "結算中…")
                  : t("Waiting for the active player.", "等待目前玩家操作。")}
            </p>
          )}
        </div>
      </div>
      {frame && <PlaybackFeedback frame={frame} view={view} skip={skip} />}
    </section>
  );
}
