import { RACERS, type PlayerView } from "@magical/engine";
import { RacerArt } from "./components";
import { useI18n } from "./i18n";
import {
  eventTypeLabel,
  racerLabel,
  racerTranslation,
  translateEvent,
} from "./racerTranslations";
import type { PlaybackFrame } from "./racePlayback";

export function PlaybackFeedback({
  frame,
  view,
  skip,
}: {
  frame: PlaybackFrame;
  view: PlayerView;
  skip: () => void;
}) {
  const { t, locale } = useI18n();
  if (frame.dicePhase)
    return (
      <div className="dice-playback-controls">
        <button className="quiet" onClick={skip}>
          {t("Skip animation", "略過動畫")}
        </button>
      </div>
    );
  const event = frame.event;
  const racer = view.racers.find((r) => r.id === event.racerId);
  const power = event.type === "POWER_TRIGGERED";
  const definition =
    power && event.data?.powerId
      ? (racerTranslation(event.data.powerId, locale) ??
        RACERS.find((r) => r.id === event.data!.powerId))
      : undefined;
  return (
    <section
      className={`playback-feedback ${power ? "power-spotlight" : ""}`}
      data-playback-type={event.type}
      aria-label={t("Action playback", "行動播放")}
    >
      {racer && <RacerArt id={racer.racerId} size={64} />}
      <div className="playback-copy" role="status" aria-live="polite">
        <small>
          {eventTypeLabel(event.type, locale)}
          {racer
            ? ` · ${view.players.find((p) => p.id === racer.ownerId)?.name}`
            : ""}
        </small>
        <strong>
          {frame.dicePhase === "rolling"
            ? t("Rolling…", "擲骰中…")
            : power && racer
              ? racerLabel(racer.racerId, locale)
              : translateEvent(event, locale, view)}
        </strong>
        {power && <p>{translateEvent(event, locale, view)}</p>}
        {definition && (
          <p className="power-explanation">{definition.uiSummary}</p>
        )}
        {frame.movingIds && (
          <p>
            {frame.movingIds
              .map((id) => {
                const r = view.racers.find((r) => r.id === id)!;
                return `${racerLabel(r.racerId, locale)} · ${t("Space", "第")} ${r.position}${t("", " 格")}`;
              })
              .join(" / ")}
          </p>
        )}
      </div>
      <button className="quiet" onClick={skip}>
        {t("Skip animation", "略過動畫")}
      </button>
    </section>
  );
}
