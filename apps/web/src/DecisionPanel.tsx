import type { CSSProperties } from "react";
import type { PlayerAction, PlayerView } from "@magical/engine";
import { playerColor, racerStatusText, RacerArt } from "./components";
import { useI18n } from "./i18n";
import { racerLabel, translateGameText } from "./racerTranslations";

interface DecisionPanelProps {
  view: PlayerView;
  playerId: string;
  busy: boolean;
  act: (action: PlayerAction) => void;
}

/** Decline-style options are visually secondary; racer targets show who and where they are. */
const DECLINE_IDS = new Set(["no"]);

export function DecisionPanel({
  view,
  playerId,
  busy,
  act,
}: DecisionPanelProps) {
  const { t, locale } = useI18n();
  const pending = view.pending;
  if (!pending || pending.ownerId !== playerId) return null;
  const me = view.players.find((p) => p.id === playerId);
  // Off-turn decisions (for example a Duelist challenge) belong to the owner's own racer.
  const mine = view.racers.filter((r) => r.ownerId === playerId);
  const asker =
    mine.find((r) => r.id === view.turn?.racerId) ??
    mine.find((r) => r.status === "active") ??
    mine[0];
  return (
    <section className="decision" aria-live="polite">
      <div className="decision-heading">
        {asker && <RacerArt id={asker.racerId} size={48} />}
        <div>
          <p className="eyebrow">
            {me?.name}
            {t(" · Power decision", " · 能力選擇")}
          </p>
          <h2>{translateGameText(pending.prompt, locale)}</h2>
        </div>
      </div>
      <div className="decision-options">
        {pending.options.map((o) => {
          const racer = view.racers.find((r) => r.id === o.id);
          const owner = racer
            ? view.players.find((p) => p.id === racer.ownerId)
            : undefined;
          const choose = () =>
            act({ type: "choose", decisionId: pending.id, optionId: o.id });
          if (racer)
            return (
              <button
                key={o.id}
                type="button"
                className="option-racer"
                disabled={busy}
                onClick={choose}
                style={
                  {
                    "--player-color": playerColor(view, racer.ownerId),
                  } as CSSProperties
                }
              >
                <RacerArt id={racer.racerId} size={44} />
                <span className="option-copy">
                  <strong>{racerLabel(racer.racerId, locale)}</strong>
                  <small>
                    {owner?.name} · {racerStatusText(racer, view, locale)}
                  </small>
                </span>
              </button>
            );
          return (
            <button
              key={o.id}
              type="button"
              className={DECLINE_IDS.has(o.id) ? "option-decline" : "option"}
              disabled={busy}
              onClick={choose}
            >
              {translateGameText(o.label, locale)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
