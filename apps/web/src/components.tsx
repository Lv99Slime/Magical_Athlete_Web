import { RACERS, SCHEDULE, TRACKS, racerName } from "@magical/engine";
import type { PlayerView } from "@magical/engine";
import { useI18n } from "./i18n";
import { boardCell } from "./boardLayout";
import { useEffect, useRef } from "react";
import type { PlaybackFrame } from "./racePlayback";
import {
  racerLabel,
  racerTranslation,
  zhRacerName,
  eventTypeLabel,
  translateEvent,
} from "./racerTranslations";
export const COLORS = [
  "#f4a2be",
  "#80c4cf",
  "#e8bc5a",
  "#a4b785",
  "#b5a4d8",
  "#e99470",
];
/** Six 3x2 sprite sheets, following the source catalogue's stable ID order. */
export function RacerArt({ id, size = 72 }: { id: string; size?: number }) {
  const index = Math.max(
    0,
    RACERS.findIndex((r) => r.id === id),
  );
  const cell = index % 6;
  return (
    <div
      className="racer-art"
      aria-hidden="true"
      data-racer-art={id}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${import.meta.env.BASE_URL}art/racers-${Math.floor(index / 6)}.webp)`,
        backgroundPosition: `${(cell % 3) * 50}% ${Math.floor(cell / 3) * 100}%`,
      }}
    />
  );
}
export function RacerCard({
  id,
  selected,
  disabled,
  onClick,
  order,
}: {
  id: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  order?: number;
}) {
  const { locale, t } = useI18n();
  const racer = RACERS.find((r) => r.id === id);
  const translated = racerTranslation(id, locale);
  if (!racer)
    return (
      <article className="racer-card">
        <strong>{t("No copied power", "目前沒有複製能力")}</strong>
        <p>
          {t(
            "This racer currently has no eligible external power to copy.",
            "這名賽手目前沒有符合條件的外來能力可以複製。",
          )}
        </p>
      </article>
    );
  const body = (
    <>
      <div className="card-heading">
        <RacerArt id={id} size={112} />
        <span className="card-name">
          {translated?.name ?? racer.name}
          {locale === "zh-Hant" && (
            <small className="english-name">{racer.name}</small>
          )}
        </span>
        {order !== undefined && <span className="order-badge">{order}</span>}
      </div>
      <strong className="power-name">
        {translated?.powerName ?? racer.powerName}
      </strong>
      <p>{translated?.uiSummary ?? racer.uiSummary}</p>
      {disabled && (
        <span className="used-label">{t("Already raced", "已出賽")}</span>
      )}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`racer-card ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <article className="racer-card">{body}</article>
  );
}
export function Board({
  view,
  playback,
}: {
  view: PlayerView;
  playback?: PlaybackFrame;
}) {
  const { locale, t } = useI18n();
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!playback?.movingIds?.length || !viewport.current) return;
    const r = view.racers.find((r) => r.id === playback.movingIds![0]);
    const cell = viewport.current.querySelector<HTMLElement>(
      `[data-position="${r?.position}"]`,
    );
    if (!cell) return;
    const bounds = viewport.current.getBoundingClientRect();
    const target = cell.getBoundingClientRect();
    if (target.left < bounds.left || target.right > bounds.right)
      viewport.current.scrollLeft +=
        target.left - bounds.left - (bounds.width - target.width) / 2;
  }, [playback, view.racers]);
  const schedule = SCHEDULE[Math.max(0, view.raceNumber - 1)];
  const track = TRACKS.find((t) => t.id === schedule.trackId)!;
  const trackLabel = t(
    track.name,
    track.id === "mild_mile" ? "悠閒一哩 · Mild Mile" : "狂野荒野 · Wild Wilds",
  );
  const shortName = (id: string) =>
    locale === "zh-Hant" ? zhRacerName(id) : racerName(id);
  const travel = new Map<string, string>();
  for (const e of view.events)
    if (e.racerId && (e.type === "MOVE" || e.type === "WARP"))
      travel.set(e.racerId, e.type);
  for (const id of playback?.movingIds ?? [])
    travel.set(id, playback!.event.type);
  return (
    <section
      className="board-panel"
      aria-label={t(`${track.name} race board`, `${trackLabel}賽道`)}
    >
      <div className="board-title">
        <h2>{trackLabel}</h2>
        <span>
          {t(
            `First ${schedule.firstPoints} pts · Second ${schedule.secondPoints} pts`,
            `第一名 ${schedule.firstPoints} 分 · 第二名 ${schedule.secondPoints} 分`,
          )}
        </span>
      </div>
      <div
        className="track-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label={t("Scroll the U-shaped race board", "左右捲動 U 型賽道")}
      >
        <div className="track-grid u-track" data-layout="u">
          <div className="track-infield">
            <span className="route-direction">
              {t("Upper straight →", "上排向右 →")}
            </span>
            <strong>{trackLabel}</strong>
            <div className="corner-labels">
              <span>{t("First corner · 12", "第一彎道 · 第 12 格")}</span>
              <span>
                {t(
                  `Second corner · ${track.secondCornerPosition}`,
                  `第二彎道 · 第 ${track.secondCornerPosition} 格`,
                )}
              </span>
            </div>
            <span className="route-direction">
              {t("← Lower straight", "← 下排向左")}
            </span>
          </div>
          {Array.from({ length: 31 }, (_, pos) => {
            const effect = track.specialSpaces.find((s) => s.position === pos);
            const here = view.racers.filter(
              (r) =>
                Math.min(30, r.position) === pos && r.status !== "eliminated",
            );
            return (
              <div
                key={pos}
                data-position={pos}
                style={boardCell(pos)}
                className={`space ${pos === 12 ? "first-corner" : ""} ${pos === track.secondCornerPosition ? "second-corner" : ""} ${pos === 0 ? "start" : ""} ${pos === 30 ? "finish" : ""} ${effect?.type ?? ""}`}
                aria-label={t(
                  `Space ${pos}${effect ? `, ${effect.type}` : ""}`,
                  `第 ${pos} 格${effect ? `，${effect.type === "star" ? "星星" : effect.type === "trip" ? "絆倒" : "箭嘴"}` : ""}`,
                )}
              >
                <span className="space-number">
                  {pos === 0
                    ? t("START", "起點")
                    : pos === 30
                      ? t("FINISH", "終點")
                      : pos}
                </span>
                {effect && (
                  <span className="space-effect">
                    {effect.type === "star"
                      ? t("+1 pt", "+1 分")
                      : effect.type === "trip"
                        ? t("TRIP", "絆倒")
                        : `${effect.delta! > 0 ? "+" : ""}${effect.delta}`}
                  </span>
                )}
                <div className="tokens">
                  {here.map((r) => (
                    <div
                      key={`${r.id}-${r.position}`}
                      data-racer-id={r.id}
                      data-moving={
                        playback?.movingIds?.includes(r.id) || undefined
                      }
                      title={`${racerLabel(r.racerId, locale)} · ${view.players.find((p) => p.id === r.ownerId)?.name}${r.tripped ? t(" · Tripped", " · 已絆倒") : ""}`}
                      className={`token ${travel.get(r.id) === "WARP" ? "warp-arrival" : "move-arrival"} ${view.turn?.racerId === r.id ? "active-token" : ""} ${playback?.event.type === "POWER_TRIGGERED" && playback.event.racerId === r.id ? "power-token" : ""} ${r.tripped ? "tripped" : ""}`}
                      style={{
                        borderColor:
                          COLORS[
                            view.players.findIndex((p) => p.id === r.ownerId)
                          ],
                      }}
                    >
                      <RacerArt id={r.racerId} size={32} />
                      <span>{shortName(r.racerId)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="board-caption">
        {t(
          "Follow the U: right along the top, down through corners 12 and 15, then left to Finish. Scroll sideways on smaller screens.",
          "沿 U 型路線前進：上排向右，經第 12、15 格彎道向下，再沿下排向左到終點。小螢幕可左右滑動。",
        )}
      </p>
      <div className="race-roster">
        {view.racers.map((r) => (
          <div
            key={r.id}
            className={view.turn?.racerId === r.id ? "current-racer" : ""}
          >
            <RacerArt id={r.racerId} size={40} />
            <div>
              <strong>{racerLabel(r.racerId, locale)}</strong>
              <small>
                {view.players.find((p) => p.id === r.ownerId)?.name} ·{" "}
                {r.status === "active"
                  ? t(
                      `Space ${r.position}${r.tripped ? " · Tripped" : ""}`,
                      `第 ${r.position} 格${r.tripped ? " · 已絆倒" : ""}`,
                    )
                  : t(
                      r.status,
                      r.status === "finished" ? "已完成比賽" : "已淘汰",
                    )}
                {r.powerId !== r.racerId
                  ? t(
                      ` · ${racerName(r.powerId)} power`,
                      ` · ${r.powerId ? zhRacerName(r.powerId) : "沒有可複製"}能力`,
                    )
                  : ""}
              </small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
export function Scoreboard({ view }: { view: PlayerView }) {
  const { t } = useI18n();
  return (
    <section className="scoreboard" aria-label={t("Player scores", "玩家分數")}>
      {view.players.map((p, i) => (
        <div
          key={p.id}
          style={{ "--player-color": COLORS[i] } as React.CSSProperties}
        >
          <span>{p.name}</span>
          <strong>
            {p.score}
            <small>{t(" pts", " 分")}</small>
          </strong>
          <small>
            {t(
              `${p.used.length} / ${p.team.length} racers used`,
              `已出賽 ${p.used.length} / ${p.team.length} 名`,
            )}
          </small>
        </div>
      ))}
    </section>
  );
}
export function EventLog({ view }: { view: PlayerView }) {
  const { locale, t } = useI18n();
  return (
    <details className="event-log" open>
      <summary>
        {t("What happened", "賽事紀錄")}{" "}
        <span>
          {t(`${view.events.length} events`, `${view.events.length} 項紀錄`)}
        </span>
      </summary>
      <ol>
        {view.events
          .slice(-80)
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <span className="event-type">
                {eventTypeLabel(e.type, locale)}
              </span>
              <p>{translateEvent(e, locale, view)}</p>
              {e.parentId !== undefined && (
                <small>
                  {t("Caused by: ", "觸發來源：")}
                  {(() => {
                    const parent = view.events.find(
                      (parent) => parent.id === e.parentId,
                    );
                    return parent
                      ? translateEvent(parent, locale, view)
                      : t("an earlier effect", "較早的效果");
                  })()}
                </small>
              )}
            </li>
          ))}
      </ol>
    </details>
  );
}
