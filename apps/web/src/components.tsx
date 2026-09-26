import { RACERS, SCHEDULE, TRACKS, racerName } from "@magical/engine";
import type { PlayerView } from "@magical/engine";
export const COLORS = [
  "#f4a2be",
  "#80c4cf",
  "#e8bc5a",
  "#a4b785",
  "#b5a4d8",
  "#e99470",
];
export function RacerArt({ id, size = 72 }: { id: string; size?: number }) {
  const n = Math.max(
    0,
    RACERS.findIndex((r) => r.id === id),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill={COLORS[n % COLORS.length]} />
      <g stroke="#25241f" strokeWidth="3" strokeLinejoin="round">
        <path
          d={
            n % 3 === 0
              ? "M22 68 L31 26 L64 19 L80 65 L62 79 Z"
              : n % 3 === 1
                ? "M24 61 Q10 18 46 23 Q85 8 79 58 L70 76 L30 79 Z"
                : "M20 68 L20 38 Q47 8 76 33 L85 69 L56 82 Z"
          }
          fill="#EDE4CF"
        />
        <path
          d={`M32 28 L${24 + (n % 12)} 12 M66 24 L${70 + (n % 13)} 10`}
          fill="none"
        />
        <ellipse cx="39" cy="46" rx="4" ry={5 + (n % 4)} fill="#25241f" />
        <ellipse cx="63" cy="46" rx="4" ry={5 + (n % 4)} fill="#25241f" />
        <path d={n % 2 ? "M40 64 Q50 72 64 59" : "M37 64 L62 64"} fill="none" />
        <path d="M35 77 L30 90 L19 90 M65 77 L73 90 L84 90" fill="none" />
      </g>
      <circle cx="77" cy="80" r="12" fill="#25241f" />
      <text
        x="77"
        y="84"
        textAnchor="middle"
        fill="#EDE4CF"
        fontSize="11"
        fontFamily="Courier New"
      >
        {n + 1}
      </text>
    </svg>
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
  const racer = RACERS.find((r) => r.id === id);
  if (!racer)
    return (
      <article className="racer-card">
        <strong>No copied power</strong>
        <p>This racer currently has no eligible external power to copy.</p>
      </article>
    );
  const body = (
    <>
      <div className="card-heading">
        <RacerArt id={id} />
        <span className="card-name">{racer.name}</span>
        {order !== undefined && <span className="order-badge">{order}</span>}
      </div>
      <strong className="power-name">{racer.powerName}</strong>
      <p>{racer.uiSummary}</p>
      {disabled && <span className="used-label">Already raced</span>}
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
export function Board({ view }: { view: PlayerView }) {
  const schedule = SCHEDULE[Math.max(0, view.raceNumber - 1)];
  const track = TRACKS.find((t) => t.id === schedule.trackId)!;
  const travel = new Map<string, string>();
  for (const e of view.events)
    if (e.racerId && (e.type === "MOVE" || e.type === "WARP"))
      travel.set(e.racerId, e.type);
  return (
    <section className="board-panel" aria-label={`${track.name} race board`}>
      <div className="board-title">
        <h2>{track.name}</h2>
        <span>
          First {schedule.firstPoints} pts · Second {schedule.secondPoints} pts
        </span>
      </div>
      <div className="track-grid">
        {Array.from({ length: 32 }, (_, visual) => {
          const row = Math.floor(visual / 8);
          const col = visual % 8;
          const pos = row % 2 === 0 ? row * 8 + col : row * 8 + 7 - col;
          if (pos > 30)
            return (
              <div key={visual} className="track-spacer" aria-hidden="true" />
            );
          const effect = track.specialSpaces.find((s) => s.position === pos);
          const here = view.racers.filter(
            (r) =>
              Math.min(30, r.position) === pos && r.status !== "eliminated",
          );
          return (
            <div
              key={visual}
              className={`space ${pos === 0 ? "start" : ""} ${pos === 30 ? "finish" : ""} ${effect?.type ?? ""}`}
              aria-label={`Space ${pos}${effect ? `, ${effect.type}` : ""}`}
            >
              <span className="space-number">
                {pos === 0 ? "START" : pos === 30 ? "FINISH" : pos}
              </span>
              {effect && (
                <span className="space-effect">
                  {effect.type === "star"
                    ? "+1 pt"
                    : effect.type === "trip"
                      ? "TRIP"
                      : `${effect.delta! > 0 ? "+" : ""}${effect.delta}`}
                </span>
              )}
              <div className="tokens">
                {here.map((r) => (
                  <div
                    key={`${r.id}-${r.position}`}
                    title={`${racerName(r.racerId)} · ${view.players.find((p) => p.id === r.ownerId)?.name}${r.tripped ? " · Tripped" : ""}`}
                    className={`token ${travel.get(r.id) === "WARP" ? "warp-arrival" : "move-arrival"} ${view.turn?.racerId === r.id ? "active-token" : ""} ${r.tripped ? "tripped" : ""}`}
                    style={{
                      borderColor:
                        COLORS[
                          view.players.findIndex((p) => p.id === r.ownerId)
                        ],
                    }}
                  >
                    <RacerArt id={r.racerId} size={32} />
                    <span>{racerName(r.racerId)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="board-caption">
        Follow the numbered spaces. A racer’s position and status are also
        listed below.
      </p>
      <div className="race-roster">
        {view.racers.map((r) => (
          <div
            key={r.id}
            className={view.turn?.racerId === r.id ? "current-racer" : ""}
          >
            <RacerArt id={r.racerId} size={40} />
            <div>
              <strong>{racerName(r.racerId)}</strong>
              <small>
                {view.players.find((p) => p.id === r.ownerId)?.name} ·{" "}
                {r.status === "active"
                  ? `Space ${r.position}${r.tripped ? " · Tripped" : ""}`
                  : r.status}
                {r.powerId !== r.racerId
                  ? ` · ${racerName(r.powerId)} power`
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
  return (
    <section className="scoreboard" aria-label="Player scores">
      {view.players.map((p, i) => (
        <div
          key={p.id}
          style={{ "--player-color": COLORS[i] } as React.CSSProperties}
        >
          <span>{p.name}</span>
          <strong>
            {p.score}
            <small> pts</small>
          </strong>
          <small>
            {p.used.length} / {p.team.length} racers used
          </small>
        </div>
      ))}
    </section>
  );
}
export function EventLog({ view }: { view: PlayerView }) {
  return (
    <details className="event-log" open>
      <summary>
        What happened <span>{view.events.length} events</span>
      </summary>
      <ol>
        {view.events
          .slice(-80)
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <span className="event-type">
                {e.type.toLowerCase().replaceAll("_", " ")}
              </span>
              <p>{e.message}</p>
              {e.parentId !== undefined && (
                <small>
                  Caused by:{" "}
                  {view.events.find((parent) => parent.id === e.parentId)
                    ?.message ?? "an earlier effect"}
                </small>
              )}
            </li>
          ))}
      </ol>
    </details>
  );
}
