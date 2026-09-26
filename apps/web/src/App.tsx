import { useI18n, translateUiMessage, phaseLabel } from "./i18n";
import { racerLabel, translateGameText } from "./racerTranslations";
import { useEffect, useRef, useState, useMemo } from "react";
import { DiceReveal, useDicePresentation } from "./dicePresentation";
import {
  applyCommand,
  createGame,
  projectState,
  RACERS,
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
  const { t, locale, setLocale } = useI18n();

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
  const liveActor = game ? actorFor(game) : "";
  const liveView = useMemo(
    () =>
      screen === "local" && game
        ? projectState(game, liveActor)
        : screen === "online"
          ? room?.game
          : undefined,
    [screen, game, liveActor, room?.game],
  );
  const presentation = useDicePresentation(
    liveView ?? undefined,
    screen === "local" ? liveActor : (room?.playerId ?? ""),
    fast,
  );
  const view = presentation.view;
  const actor = presentation.viewer;
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
          <label className="language-toggle">
            <span>{t("Language", "語言")}</span>
            <select
              aria-label="Language / 語言"
              value={locale}
              onChange={(e) => setLocale(e.target.value as "en" | "zh-Hant")}
            >
              <option value="zh-Hant">繁體中文</option>
              <option value="en">English</option>
            </select>
          </label>
          <span className="edition">
            {t("CMYK 2025 · Four races", "CMYK 2025 · 四場比賽")}
          </span>
          <button
            className="quiet"
            ref={guideTrigger}
            onClick={() => setLibrary(true)}
          >
            {t("Racer guide", "選手圖鑑")}
          </button>
          {screen !== "home" && (
            <label className="fast-toggle">
              <input
                type="checkbox"
                checked={fast}
                onChange={(e) => setFast(e.target.checked)}
              />{" "}
              {t("Fast animations", "快速動畫")}
            </label>
          )}
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {translateGameText(translateUiMessage(error, locale), locale)}
          <button className="quiet" onClick={() => setError("")}>
            {t("Dismiss", "關閉訊息")}
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
            <span className="race-stamp">
              {t("Race ", "賽事 ")}
              {view.raceNumber} / 4
            </span>
            <h1>
              {view.phase === "draft"
                ? t("Build your team", "組建你的隊伍")
                : view.phase === "selection"
                  ? t("Choose your racers", "選擇你的選手")
                  : view.phase === "finished"
                    ? t("Final standings", "最終排名")
                    : view.phase === "results"
                      ? t("Race results", "本場賽果")
                      : SCHEDULE[view.raceNumber - 1]?.trackId === "wild_wilds"
                        ? t("Into the Wild Wilds", "闖進狂野荒野")
                        : t("Race the Mild Mile", "馳騁悠閒一哩")}
            </h1>
            <span className="save-status">
              {screen === "local"
                ? translateUiMessage(saveStatus, locale)
                : t(`Room ${room?.code}`, `房間 ${room?.code}`)}
            </span>
          </div>
          <Scoreboard view={view} />
          {presentation.dice && (
            <DiceReveal
              dice={presentation.dice}
              view={view}
              playing={presentation.playing}
            />
          )}
          {screen === "local" &&
          curtain &&
          !presentation.playing &&
          (view.phase === "selection" || view.pending) ? (
            <section className="handoff">
              <div className="sealed-card">
                <span>{t("Private choice", "秘密選擇")}</span>
                <h2>
                  {t("Pass to ", "請交給 ")}
                  {view.players.find((p) => p.id === actor)?.name}
                </h2>
                <p>
                  {t(
                    "Everyone else, look away. Reveal your options when you’re ready.",
                    "其他玩家請先避開畫面。準備好後，就可以查看你的選項。",
                  )}
                </p>
                <button className="primary" onClick={() => setCurtain(false)}>
                  {t("I’m ", "我是 ")}
                  {view.players.find((p) => p.id === actor)?.name}{" "}
                  {t("— reveal", "— 查看選項")}
                </button>
              </div>
            </section>
          ) : (
            <GameScreen
              key={`${view.phase}-${screen === "local" ? actor : room?.playerId}-${view.raceNumber}`}
              view={view}
              playerId={screen === "local" ? actor : room!.playerId}
              busy={busy || presentation.playing}
              act={screen === "local" ? localAction : sendOnline}
            />
          )}
        </>
      ) : (
        <p>{t("Loading game…", "正在載入遊戲…")}</p>
      )}
      <footer>
        {t(
          "Original artwork · Unofficial private-play implementation · CMYK 2025 rules with the supplied August 2026 update.",
          "原創美術 · 非官方私人遊玩版本 · 依據 CMYK 2025 規則及所提供的 2026 年 8 月更新。",
        )}
      </footer>
      {library && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("All 36 racers", "全部 36 位選手")}
            className="library"
          >
            <div className="section-heading">
              <h2>{t("Meet all 36 racers", "認識全部 36 位選手")}</h2>
              <button autoFocus onClick={() => setLibrary(false)}>
                {t("Close guide", "關閉圖鑑")}
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
  const { t, locale } = useI18n();

  const [count, setCount] = useState(3);
  const [names, setNames] = useState(() =>
    Array.from({ length: 6 }, (_, i) => t(`Player ${i + 1}`, `玩家 ${i + 1}`)),
  );
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
            {t(
              "36 racers. Four races. One very strange field.",
              "36 位選手，四場比賽，一場奇想競速。",
            )}
          </p>
          <h1>
            {t("A little magic.", "一點魔法，")}
            <br />
            <em>{t("A lot of racing.", "無限競速。")}</em>
          </h1>
          <p className="hero-copy">
            {t(
              "Draft a team of unlikely athletes. Pick your moment, roll the die, and let their powers turn the race upside down.",
              "招募一隊意想不到的運動員。選好時機、擲出骰子，讓他們的能力扭轉賽局。",
            )}
          </p>
          <a href="#local" className="primary link-button">
            {t("Play on this device", "在此裝置遊玩")}
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          {["huge_baby", "magician", "suckerfish", "legs"].map((id, i) => (
            <div key={id} className={`hero-racer hero-racer-${i}`}>
              <RacerArt id={id} size={150} />
              <span>{racerLabel(id, locale)}</span>
            </div>
          ))}
          <span className="hero-sticker">
            2–6
            <br />
            {t("PLAYERS", "位玩家")}
          </span>
        </div>
      </section>
      <div className="home-panels">
        <section id="local" className="setup-panel">
          <div className="section-heading">
            <h2>{t("At the same table", "同枱對戰")}</h2>
            <span>{t("Pass & play", "輪流傳機")}</span>
          </div>
          <p>
            {t(
              "One device. Everyone gets a private racer choice before each race.",
              "共用一部裝置，每場比賽前由各人秘密選擇自己的選手。",
            )}
          </p>
          {saved && (
            <button className="resume" onClick={onResume}>
              {t("Resume saved game · Race ", "繼續存檔 · 賽事 ")}
              {saved.raceNumber} · {phaseLabel(saved.phase, locale)}
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
              {t("Players", "玩家人數")}
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
                  {t("Player ", "玩家 ")}
                  {i + 1}
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
                {t(
                  "Two-player rules: draft eight racers each and race two at a time.",
                  "雙人規則：每人招募八位選手，每場派出兩位選手。",
                )}
              </p>
            ) : count === 3 ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={double}
                  onChange={(e) => setDouble(e.target.checked)}
                />{" "}
                {t(
                  "Two racers per player (optional variant)",
                  "每人派出兩位選手（可選變體）",
                )}
              </label>
            ) : null}
            <label className="check">
              <input
                type="checkbox"
                checked={randomTeams}
                onChange={(e) => setRandomTeams(e.target.checked)}
              />{" "}
              {t(
                "Deal random teams instead of drafting",
                "隨機分配隊伍，略過選秀",
              )}
            </label>
            <button className="primary" type="submit">
              {t("Start local game", "開始本機遊戲")}
            </button>
          </form>
        </section>
        <section className="setup-panel online-panel">
          <div className="section-heading">
            <h2>{t("Different tables", "異地同樂")}</h2>
            <span>{t("Online room", "線上房間")}</span>
          </div>
          <p>
            {t(
              "Create a room, share the code, and race with friends on their own devices.",
              "建立房間、分享房號，朋友就可以用各自的裝置一起競賽。",
            )}
          </p>
          {onlineConfigured ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onOnline(false, nickname, code);
              }}
            >
              <label>
                {t("Your nickname", "你的暱稱")}
                <input
                  required
                  maxLength={24}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <label>
                {t("Room code", "房間代碼")}
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
                  {t("Join room", "加入房間")}
                </button>
                <button
                  disabled={busy || !nickname.trim()}
                  type="button"
                  className="primary"
                  onClick={() => onOnline(true, nickname, "")}
                >
                  {t("Create room", "建立房間")}
                </button>
              </div>
              {localStorage.getItem("magical-room") && (
                <button
                  type="button"
                  className="quiet"
                  onClick={onResumeOnline}
                  disabled={busy}
                >
                  {t("Reconnect to last room", "重新連接上次房間")}
                </button>
              )}
            </form>
          ) : (
            <div className="online-unavailable">
              <strong>
                {t("Online rooms aren’t configured yet", "線上房間尚未設定")}
              </strong>
              <p>
                {t(
                  "This build needs its Supabase connection before online play is available. Local play is ready without a server.",
                  "設定 Supabase 連線後即可開啟線上遊玩。本機遊戲毋須伺服器。",
                )}
              </p>
            </div>
          )}
          <div className="schedule">
            <h3>{t("The four-race schedule", "四場比賽安排")}</h3>
            {SCHEDULE.map((s) => (
              <div key={s.race}>
                <span>
                  {s.race}.{" "}
                  {s.trackId === "mild_mile"
                    ? t("Mild Mile", "悠閒一哩")
                    : t("Wild Wilds", "狂野荒野")}
                </span>
                <strong>
                  {s.firstPoints} / {s.secondPoints} {t("pts", "分")}
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
  const { t } = useI18n();

  const [double, setDouble] = useState(false);
  const [randomTeams, setRandomTeams] = useState(false);
  const [copied, setCopied] = useState(false);
  const me = room.members.find((m) => m.id === room.playerId);
  return (
    <main className="lobby setup-panel">
      <p className="eyebrow">{t("Online room", "線上房間")}</p>
      <h1>{room.code}</h1>
      <button
        onClick={() => {
          navigator.clipboard
            .writeText(location.href)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied
          ? t("Link copied", "已複製連結")
          : t("Copy invite link", "複製邀請連結")}
      </button>
      <h2>
        {t("Players · ", "玩家 · ")}
        {room.members.length} / 6
      </h2>
      <ul className="member-list">
        {room.members.map((m) => (
          <li key={m.id}>
            <strong>
              {m.name}
              {m.id === room.playerId ? t(" (you)", "（你）") : ""}
            </strong>
            <span>
              {m.id === room.hostId ? t("Host · ", "房主 · ") : ""}
              {m.ready ? t("Ready", "已準備") : t("Not ready", "未準備")}
            </span>
          </li>
        ))}
      </ul>
      <button
        disabled={busy}
        className="primary"
        onClick={() => send({ type: "ready", ready: !me?.ready })}
      >
        {me?.ready ? t("Not ready", "未準備") : t("Ready to race", "準備好了")}
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
              {t("Two racers per player", "每人派出兩位選手")}
            </label>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={randomTeams}
              onChange={(e) => setRandomTeams(e.target.checked)}
            />{" "}
            {t("Random teams instead of drafting", "隨機分配隊伍，略過選秀")}
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
            {t("Start game", "開始遊戲")}
          </button>
        </div>
      )}
      <p className="help">
        {t(
          "Everyone must be ready before the host starts. Reloading on this browser reconnects your seat.",
          "所有玩家準備就緒後，房主就可以開始遊戲。使用同一瀏覽器重新載入，即可回到原有座位。",
        )}
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
  const { t, locale } = useI18n();

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
        <p className="eyebrow">
          {me.name}
          {t(" · Power decision", " · 能力選擇")}
        </p>
        <h2>{translateGameText(view.pending.prompt, locale)}</h2>
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
              {translateGameText(o.label, locale)}
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
              {t("Draft ", "選秀 ")}
              {view.draft.round + 1} / {view.draft.rounds}
            </p>
            <h2>
              {drafter?.name}
              {t(", pick a racer", "，請選擇一位選手")}
            </h2>
          </div>
          <span>
            {t("Snake draft · ", "蛇形選秀 · ")}
            {me.team.length} {t("recruited by you", "位已加入你的隊伍")}
          </span>
        </div>
        {drafter?.id !== playerId && (
          <p role="status">
            {t("Waiting for ", "等待 ")}
            {drafter?.name} {t("to choose.", "作出選擇。")}
          </p>
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
            <h2>{t("Your racers are locked in.", "已確認你的選手。")}</h2>
            <p>
              {t(
                "Waiting for everyone’s secret choices. All racers reveal together.",
                "等待所有玩家完成秘密選擇，選手將同時公開。",
              )}
            </p>
          </section>
        ) : (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {t("Private selection · ", "秘密選擇 · ")}
                  {me.name}
                </p>
                <h2>
                  {t(
                    `Choose ${count === 2 ? "two racers" : "one racer"} for race ${view.raceNumber}`,
                    `為第 ${view.raceNumber} 場比賽選擇${count === 2 ? "兩位" : "一位"}選手`,
                  )}
                </h2>
                <p>
                  {count === 2
                    ? t(
                        "Select in turn order: first selected races first. Deselect to change the order.",
                        "依回合次序選擇：先選的選手先行動。取消選擇即可重新排序。",
                      )
                    : t(
                        "Each racer can compete in only one race.",
                        "每位選手只能參與其中一場比賽。",
                      )}
                </p>
              </div>
              <button
                className="primary"
                disabled={busy || selected.length !== count}
                onClick={() => act({ type: "select", racerIds: selected })}
              >
                {t("Lock in ", "確認 ")}
                {selected.length} / {count}
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
              ? t("All four races complete", "四場比賽全部完成")
              : t(
                  `Race ${view.raceNumber} complete`,
                  `第 ${view.raceNumber} 場比賽完成`,
                )}
          </p>
          <h2>
            {view.phase === "finished"
              ? t(
                  `${winners.map((p) => p.name).join(" & ")} ${winners.length > 1 ? "share the win!" : "wins!"}`,
                  `${winners.map((p) => p.name).join("、")}${winners.length > 1 ? "並列冠軍！" : "獲勝！"}`,
                )
              : t("Points on the board.", "本場得分已結算。")}
          </h2>
          {view.phase === "results" && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => act({ type: "nextRace" })}
            >
              {t("Prepare race ", "準備下一場 · 賽事 ")}
              {view.raceNumber + 1}
            </button>
          )}
        </div>
        {view.history.map((h) => (
          <section key={h.race} className="history-race">
            <h3>
              {t("Race ", "賽事 ")}
              {h.race}
            </h3>
            <div>
              {h.placements.map((id, i) => (
                <p key={`${id}-${i}`}>
                  <strong>{i + 1}.</strong>{" "}
                  {racerLabel(
                    h.racers.find((r) => r.id === id)?.racerId ?? id,
                    locale,
                  )}
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
                  : t("Resolving effects", "正在處理效果")}
              </p>
              <h2>
                {current
                  ? racerLabel(current.racerId, locale)
                  : t("Race in progress", "比賽進行中")}
              </h2>
            </div>
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
                      `Waiting for ${view.players.find((p) => p.id === view.pending?.ownerId)?.name} to decide.`,
                      `等待 ${view.players.find((p) => p.id === view.pending?.ownerId)?.name} 作出選擇。`,
                    )
                  : t("Waiting for the active player.", "等待目前玩家操作。")}
              </p>
            )}
          </section>
          <Board view={view} />
          {view.error && (
            <div className="error" role="alert">
              {translateGameText(
                translateUiMessage(view.error, locale),
                locale,
              )}
            </div>
          )}
          <details className="power-reference">
            <summary>{t("Racer powers in this race", "本場選手能力")}</summary>
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
  const { t } = useI18n();

  const p = view.players.find((x) => x.id === playerId);
  return (
    <details className="team">
      <summary>
        {t("Your team · ", "你的隊伍 · ")}
        {p?.team.length} {t("racers", "位選手")}
      </summary>
      <div className="card-grid compact">
        {p?.team.map((id) => (
          <RacerCard key={id} id={id} />
        ))}
      </div>
    </details>
  );
}
