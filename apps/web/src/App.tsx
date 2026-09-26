import { useEffect, useRef, useState } from "react";
import {
  applyCommand,
  createGame,
  projectState,
  RACERS,
  racerName,
  SCHEDULE,
} from "@magical/engine";
import type { GameState, PlayerAction, PlayerView } from "@magical/engine";
import { Board, EventLog, RacerArt, RacerCard, Scoreboard } from "./components";
import { loadGame, saveGame } from "./storage";
import {
  connectOnline,
  onlineConfigured,
  type OnlineClient,
  type RoomView,
  OnlineError,
} from "./online";
function random() {
  const v = new Uint32Array(1);
  crypto.getRandomValues(v);
  return v[0] / 4294967296;
}
function actorFor(s: GameState) {
  return (
    s.pending?.ownerId ??
    (s.phase === "draft"
      ? s.draft.order[s.draft.cursor]
      : s.phase === "selection"
        ? s.players.find((p) => !s.selections[p.id])?.id
        : s.racers.find((r) => r.id === s.turn?.racerId)?.ownerId) ??
    s.players[0].id
  );
}
export function App() {
  const [game, setGame] = useState<GameState>();
  const [saved, setSaved] = useState<GameState>();
  const [screen, setScreen] = useState<"home" | "local" | "online">("home");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [curtain, setCurtain] = useState(true);
  const guideTrigger = useRef<HTMLButtonElement>(null);
  const [client, setClient] = useState<OnlineClient>();
  const [room, setRoom] = useState<RoomView>();
  const [fast, setFast] = useState(false);
  const [library, setLibrary] = useState(false);
  useEffect(() => {
    if (!library) return;
    const previous = guideTrigger.current;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLibrary(false);
      if (event.key === "Tab") {
        const items = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".library button, .library a, .library input",
          ),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [library]);
  useEffect(() => {
    loadGame()
      .then(setSaved)
      .catch(() =>
        setError(
          "Saved games are unavailable in this browser. You can still play.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!client || !room) return;
    return client.subscribe(
      room.id,
      (next) =>
        setRoom((old) =>
          !old || old.id !== next.id || next.version >= old.version
            ? next
            : old,
        ),
      (err) => setError(err.message),
    );
  }, [client, room?.id]);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const persist = (next: GameState) => {
    setGame(next);
    setSaved(next);
    setSaveStatus("Saving…");
    saveGame(next)
      .then(() => setSaveStatus("Saved on this device"))
      .catch(() => setSaveStatus("Could not save — keep this tab open"));
  };
  const localAction = (action: PlayerAction) => {
    if (!game) return;
    try {
      const next = applyCommand(
        game,
        { actorId: actorFor(game), action },
        random,
      );
      persist(next);
      if (
        next.phase === "selection" ||
        (next.pending && next.pending.ownerId !== actorFor(game))
      )
        setCurtain(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Action could not be completed.",
      );
    }
  };
  const openOnline = (create: boolean, nickname: string, code: string) =>
    run(async () => {
      const c = client ?? (await connectOnline());
      setClient(c);
      const r = create
        ? await c.createRoom(nickname)
        : await c.joinRoom(code, nickname);
      setRoom(r);
      localStorage.setItem("magical-room", r.id);
      setScreen("online");
      history.replaceState(null, "", `${location.pathname}?room=${r.code}`);
    });
  const resumeOnline = () =>
    run(async () => {
      const id = localStorage.getItem("magical-room");
      if (!id) return;
      const c = await connectOnline();
      setClient(c);
      const r = await c.getRoom(id);
      setRoom(r);
      setScreen("online");
      history.replaceState(null, "", location.pathname + "?room=" + r.code);
    });
  const sendOnline = (action: Parameters<OnlineClient["send"]>[2]) =>
    run(async () => {
      if (!client || !room) return;
      try {
        const next = await client.send(room.id, room.version, action);
        setRoom((old) => (!old || next.version >= old.version ? next : old));
      } catch (e) {
        if (e instanceof OnlineError && e.code === "STALE_STATE") {
          const next = await client.getRoom(room.id);
          setRoom((old) => (!old || next.version >= old.version ? next : old));
        }
        throw e;
      }
    });
  const actor = game ? actorFor(game) : "";
  const view =
    screen === "local" && game ? projectState(game, actor) : room?.game;
  return (
    <div className={fast ? "app fast" : "app"}>
      <header className="site-header">
        <button
          className="wordmark"
          onClick={() => {
            setScreen("home");
            setError("");
          }}
        >
          MAGICAL
          <br />
          <span>ATHLETE</span>
        </button>
        <div className="header-right">
          <span className="edition">CMYK 2025 · Four races</span>
          <button
            className="quiet"
            ref={guideTrigger}
            onClick={() => setLibrary(true)}
          >
            Racer guide
          </button>
          {screen !== "home" && (
            <label className="fast-toggle">
              <input
                type="checkbox"
                checked={fast}
                onChange={(e) => setFast(e.target.checked)}
              />{" "}
              Fast animations
            </label>
          )}
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button className="quiet" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {screen === "home" ? (
        <Home
          saved={saved}
          busy={busy}
          onResume={() => {
            setGame(saved);
            setCurtain(true);
            setScreen("local");
          }}
          onStart={(names, doubleRacers, randomTeams) => {
            try {
              persist(createGame({ names, doubleRacers, randomTeams }, random));
              setCurtain(true);
              setScreen("local");
            } catch (e) {
              setError(String(e));
            }
          }}
          onOnline={openOnline}
          onResumeOnline={resumeOnline}
        />
      ) : screen === "online" && room && !room.game ? (
        <Lobby room={room} busy={busy} send={sendOnline} />
      ) : view ? (
        <>
          <div className="game-topline">
            <span className="race-stamp">Race {view.raceNumber} / 4</span>
            <h1>
              {view.phase === "draft"
                ? "Build your team"
                : view.phase === "selection"
                  ? "Choose your racers"
                  : view.phase === "finished"
                    ? "Final standings"
                    : view.phase === "results"
                      ? "Race results"
                      : SCHEDULE[view.raceNumber - 1]?.trackId === "wild_wilds"
                        ? "Into the Wild Wilds"
                        : "Race the Mild Mile"}
            </h1>
            <span className="save-status">
              {screen === "local" ? saveStatus : `Room ${room?.code}`}
            </span>
          </div>
          <Scoreboard view={view} />
          {screen === "local" &&
          curtain &&
          (view.phase === "selection" || view.pending) ? (
            <section className="handoff">
              <div className="sealed-card">
                <span>Private choice</span>
                <h2>
                  Pass to {view.players.find((p) => p.id === actor)?.name}
                </h2>
                <p>
                  Everyone else, look away. Reveal your options when you’re
                  ready.
                </p>
                <button className="primary" onClick={() => setCurtain(false)}>
                  I’m {view.players.find((p) => p.id === actor)?.name} — reveal
                </button>
              </div>
            </section>
          ) : (
            <GameScreen
              key={`${view.phase}-${screen === "local" ? actor : room?.playerId}-${view.raceNumber}`}
              view={view}
              playerId={screen === "local" ? actor : room!.playerId}
              busy={busy}
              act={screen === "local" ? localAction : sendOnline}
            />
          )}
        </>
      ) : (
        <p>Loading game…</p>
      )}
      <footer>
        Original artwork · Unofficial private-play implementation · CMYK 2025
        rules with the supplied August 2026 update.
      </footer>
      {library && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="All 36 racers"
            className="library"
          >
            <div className="section-heading">
              <h2>Meet all 36 racers</h2>
              <button autoFocus onClick={() => setLibrary(false)}>
                Close guide
              </button>
            </div>
            <div className="card-grid">
              {RACERS.map((r) => (
                <RacerCard key={r.id} id={r.id} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Home({
  saved,
  busy,
  onResume,
  onStart,
  onOnline,
  onResumeOnline,
}: {
  saved?: GameState;
  busy: boolean;
  onResume: () => void;
  onStart: (names: string[], double: boolean, random: boolean) => void;
  onOnline: (create: boolean, name: string, code: string) => void;
  onResumeOnline: () => void;
}) {
  const [count, setCount] = useState(3);
  const [names, setNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
    "Player 5",
    "Player 6",
  ]);
  const [double, setDouble] = useState(false);
  const [randomTeams, setRandomTeams] = useState(false);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get("room") ?? "",
  );
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">
            36 racers. Four races. One very strange field.
          </p>
          <h1>
            A little magic.
            <br />
            <em>A lot of racing.</em>
          </h1>
          <p className="hero-copy">
            Draft a team of unlikely athletes. Pick your moment, roll the die,
            and let their powers turn the race upside down.
          </p>
          <a href="#local" className="primary link-button">
            Play on this device
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          {["huge_baby", "magician", "suckerfish", "legs"].map((id, i) => (
            <div key={id} className={`hero-racer hero-racer-${i}`}>
              <RacerArt id={id} size={150} />
              <span>{racerName(id)}</span>
            </div>
          ))}
          <span className="hero-sticker">
            2–6
            <br />
            PLAYERS
          </span>
        </div>
      </section>
      <div className="home-panels">
        <section id="local" className="setup-panel">
          <div className="section-heading">
            <h2>At the same table</h2>
            <span>Pass & play</span>
          </div>
          <p>
            One device. Everyone gets a private racer choice before each race.
          </p>
          {saved && (
            <button className="resume" onClick={onResume}>
              Resume saved game · Race {saved.raceNumber} · {saved.phase}
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onStart(
                names.slice(0, count).map((n) => n.trim()),
                count === 2 || double,
                randomTeams,
              );
            }}
          >
            <label>
              Players
              <select
                value={count}
                onChange={(e) => {
                  setCount(Number(e.target.value));
                  setDouble(false);
                }}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <div className="name-inputs">
              {names.slice(0, count).map((name, i) => (
                <label key={i}>
                  Player {i + 1}
                  <input
                    required
                    maxLength={24}
                    value={name}
                    onChange={(e) =>
                      setNames(
                        names.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            {count === 2 ? (
              <p className="help">
                Two-player rules: draft eight racers each and race two at a
                time.
              </p>
            ) : count === 3 ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={double}
                  onChange={(e) => setDouble(e.target.checked)}
                />{" "}
                Two racers per player (optional variant)
              </label>
            ) : null}
            <label className="check">
              <input
                type="checkbox"
                checked={randomTeams}
                onChange={(e) => setRandomTeams(e.target.checked)}
              />{" "}
              Deal random teams instead of drafting
            </label>
            <button className="primary" type="submit">
              Start local game
            </button>
          </form>
        </section>
        <section className="setup-panel online-panel">
          <div className="section-heading">
            <h2>Different tables</h2>
            <span>Online room</span>
          </div>
          <p>
            Create a room, share the code, and race with friends on their own
            devices.
          </p>
          {onlineConfigured ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOnline(false, nickname, code);
              }}
            >
              <label>
                Your nickname
                <input
                  required
                  maxLength={24}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <label>
                Room code
                <input
                  required
                  minLength={6}
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </label>
              <div className="button-row">
                <button disabled={busy} type="submit">
                  Join room
                </button>
                <button
                  disabled={busy || !nickname.trim()}
                  type="button"
                  className="primary"
                  onClick={() => onOnline(true, nickname, "")}
                >
                  Create room
                </button>
              </div>
              {localStorage.getItem("magical-room") && (
                <button
                  type="button"
                  className="quiet"
                  onClick={onResumeOnline}
                  disabled={busy}
                >
                  Reconnect to last room
                </button>
              )}
            </form>
          ) : (
            <div className="online-unavailable">
              <strong>Online rooms aren’t configured yet</strong>
              <p>
                This build needs its Supabase connection before online play is
                available. Local play is ready without a server.
              </p>
            </div>
          )}
          <div className="schedule">
            <h3>The four-race schedule</h3>
            {SCHEDULE.map((s) => (
              <div key={s.race}>
                <span>
                  {s.race}.{" "}
                  {s.trackId === "mild_mile" ? "Mild Mile" : "Wild Wilds"}
                </span>
                <strong>
                  {s.firstPoints} / {s.secondPoints} pts
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
function Lobby({
  room,
  busy,
  send,
}: {
  room: RoomView;
  busy: boolean;
  send: (a: Parameters<OnlineClient["send"]>[2]) => void;
}) {
  const [double, setDouble] = useState(false);
  const [randomTeams, setRandomTeams] = useState(false);
  const [copied, setCopied] = useState(false);
  const me = room.members.find((m) => m.id === room.playerId);
  return (
    <main className="lobby setup-panel">
      <p className="eyebrow">Online room</p>
      <h1>{room.code}</h1>
      <button
        onClick={() => {
          navigator.clipboard
            .writeText(location.href)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? "Link copied" : "Copy invite link"}
      </button>
      <h2>Players · {room.members.length} / 6</h2>
      <ul className="member-list">
        {room.members.map((m) => (
          <li key={m.id}>
            <strong>
              {m.name}
              {m.id === room.playerId ? " (you)" : ""}
            </strong>
            <span>
              {m.id === room.hostId ? "Host · " : ""}
              {m.ready ? "Ready" : "Not ready"}
            </span>
          </li>
        ))}
      </ul>
      <button
        disabled={busy}
        className="primary"
        onClick={() => send({ type: "ready", ready: !me?.ready })}
      >
        {me?.ready ? "Not ready" : "Ready to race"}
      </button>
      {room.playerId === room.hostId && (
        <div className="host-controls">
          {room.members.length === 3 && (
            <label className="check">
              <input
                type="checkbox"
                checked={double}
                onChange={(e) => setDouble(e.target.checked)}
              />{" "}
              Two racers per player
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={randomTeams}
              onChange={(e) => setRandomTeams(e.target.checked)}
            />{" "}
            Random teams instead of drafting
          </label>
          <button
            disabled={
              busy ||
              room.members.length < 2 ||
              !room.members.every((m) => m.ready)
            }
            onClick={() =>
              send({
                type: "start",
                doubleRacers: room.members.length === 2 || double,
                randomTeams,
              })
            }
          >
            Start game
          </button>
        </div>
      )}
      <p className="help">
        Everyone must be ready before the host starts. Reloading on this browser
        reconnects your seat.
      </p>
    </main>
  );
}
export function GameScreen({
  view,
  playerId,
  busy,
  act,
}: {
  view: PlayerView;
  playerId: string;
  busy: boolean;
  act: (action: PlayerAction) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const me = view.players.find((p) => p.id === playerId)!;
  const count = view.config.doubleRacers ? 2 : 1;
  const current = view.racers.find((r) => r.id === view.turn?.racerId);
  const canRoll = view.legalActions.some((a) => a.type === "roll");
  const toggle = (id: string) =>
    setSelected((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id)
        : old.length < count
          ? [...old, id]
          : old,
    );
  const decision =
    view.pending && view.pending.ownerId === playerId ? (
      <section className="decision" aria-live="polite">
        <p className="eyebrow">{me.name} · Power decision</p>
        <h2>{view.pending.prompt}</h2>
        <div className="button-row">
          {view.pending.options.map((o) => (
            <button
              key={o.id}
              disabled={busy}
              onClick={() =>
                act({
                  type: "choose",
                  decisionId: view.pending!.id,
                  optionId: o.id,
                })
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>
    ) : null;
  if (view.phase === "draft") {
    const drafter = view.players.find(
      (p) => p.id === view.draft.order[view.draft.cursor],
    );
    return (
      <main>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              Draft {view.draft.round + 1} / {view.draft.rounds}
            </p>
            <h2>{drafter?.name}, pick a racer</h2>
          </div>
          <span>Snake draft · {me.team.length} recruited by you</span>
        </div>
        {drafter?.id !== playerId && (
          <p role="status">Waiting for {drafter?.name} to choose.</p>
        )}
        <div className="card-grid">
          {view.draft.pool.map((id) => (
            <RacerCard
              key={id}
              id={id}
              onClick={
                drafter?.id === playerId
                  ? () => act({ type: "draft", racerId: id })
                  : undefined
              }
            />
          ))}
        </div>
        <Team view={view} playerId={playerId} />
      </main>
    );
  }
  if (view.phase === "selection")
    return (
      <main>
        {view.selectionReady.includes(playerId) ? (
          <section className="waiting">
            <h2>Your racers are locked in.</h2>
            <p>
              Waiting for everyone’s secret choices. All racers reveal together.
            </p>
          </section>
        ) : (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Private selection · {me.name}</p>
                <h2>
                  Choose {count === 2 ? "two racers" : "one racer"} for race{" "}
                  {view.raceNumber}
                </h2>
                <p>
                  {count === 2
                    ? "Select in turn order: first selected races first. Deselect to change the order."
                    : "Each racer can compete in only one race."}
                </p>
              </div>
              <button
                className="primary"
                disabled={busy || selected.length !== count}
                onClick={() => act({ type: "select", racerIds: selected })}
              >
                Lock in {selected.length} / {count}
              </button>
            </div>
            <div className="card-grid">
              {me.team.map((id) => (
                <RacerCard
                  key={id}
                  id={id}
                  disabled={me.used.includes(id)}
                  selected={selected.includes(id)}
                  order={
                    selected.includes(id) ? selected.indexOf(id) + 1 : undefined
                  }
                  onClick={() => toggle(id)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    );
  if (view.phase === "results" || view.phase === "finished") {
    const winners = view.players.filter(
      (p) => p.score === Math.max(...view.players.map((p) => p.score)),
    );
    return (
      <main className="results">
        <div className="result-banner">
          <p className="eyebrow">
            {view.phase === "finished"
              ? "All four races complete"
              : `Race ${view.raceNumber} complete`}
          </p>
          <h2>
            {view.phase === "finished"
              ? `${winners.map((p) => p.name).join(" & ")} ${winners.length > 1 ? "share the win!" : "wins!"}`
              : "Points on the board."}
          </h2>
          {view.phase === "results" && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => act({ type: "nextRace" })}
            >
              Prepare race {view.raceNumber + 1}
            </button>
          )}
        </div>
        {view.history.map((h) => (
          <section key={h.race} className="history-race">
            <h3>Race {h.race}</h3>
            <div>
              {h.placements.map((id, i) => (
                <p key={`${id}-${i}`}>
                  <strong>{i + 1}.</strong>{" "}
                  {racerName(h.racers.find((r) => r.id === id)?.racerId ?? id)}
                </p>
              ))}
            </div>
            <div className="result-gains">
              {view.players.map((p) => (
                <span key={p.id}>
                  {p.name}: +{h.gains[p.id] ?? 0}
                </span>
              ))}
            </div>
          </section>
        ))}
        <EventLog view={view} />
      </main>
    );
  }
  return (
    <main>
      {decision}
      <div className="race-layout">
        <div>
          <section className="turn-panel" aria-live="polite">
            <div>
              <p className="eyebrow">
                {current
                  ? view.players.find((p) => p.id === current.ownerId)?.name
                  : "Resolving effects"}
              </p>
              <h2>
                {current ? racerName(current.racerId) : "Race in progress"}
              </h2>
              {view.turn?.face !== undefined && (
                <span
                  className="die"
                  aria-label={`Last die result ${view.turn.face}`}
                >
                  {view.turn.face}
                </span>
              )}
            </div>
            {canRoll ? (
              <button
                className="primary roll-button"
                disabled={busy}
                onClick={() => act({ type: "roll" })}
              >
                Take turn
              </button>
            ) : (
              <p>
                {view.pending
                  ? `Waiting for ${view.players.find((p) => p.id === view.pending?.ownerId)?.name} to decide.`
                  : "Waiting for the active player."}
              </p>
            )}
          </section>
          <Board view={view} />
          {view.error && (
            <div className="error" role="alert">
              {view.error}
            </div>
          )}
          <details className="power-reference">
            <summary>Racer powers in this race</summary>
            <div className="card-grid compact">
              {view.racers.map((r) => (
                <RacerCard key={r.id} id={r.powerId} />
              ))}
            </div>
          </details>
        </div>
        <aside>
          <EventLog view={view} />
        </aside>
      </div>
    </main>
  );
}
function Team({ view, playerId }: { view: PlayerView; playerId: string }) {
  const p = view.players.find((x) => x.id === playerId);
  return (
    <details className="team">
      <summary>Your team · {p?.team.length} racers</summary>
      <div className="card-grid compact">
        {p?.team.map((id) => (
          <RacerCard key={id} id={id} />
        ))}
      </div>
    </details>
  );
}
