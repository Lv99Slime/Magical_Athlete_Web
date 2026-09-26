import { RACERS, racerName } from "@magical/engine";
import type { DomainEvent, PlayerView } from "@magical/engine";
import type { Locale } from "./i18n";

/** Original Traditional Chinese display translations; English identities remain authoritative. */
export const RACER_TRANSLATIONS: Record<
  string,
  { name: string; powerName: string; uiSummary: string }
> = {
  alchemist: {
    name: "鍊金術士",
    powerName: "煉成四步",
    uiSummary:
      "主移動骰點確定為 1 或 2 後，可改用 4 作為主移動的基礎步數。骰點本身不變。",
  },
  blimp: {
    name: "飛船",
    powerName: "吹到飛起",
    uiSummary:
      "回合開始時，若仍在賽道第二個彎角之前，主移動步數 +3；若已到達或越過該彎角，則主移動步數 −1。",
  },
  coach: {
    name: "教練",
    powerName: "加把勁",
    uiSummary:
      "計算主移動步數時，與教練同格的所有賽手均獲得 +1 步，包括教練自己。",
  },
  baba_yaga: {
    name: "芭芭雅嘎",
    powerName: "絆你一腳",
    uiSummary:
      "其他賽手停在芭芭雅嘎所在格，或芭芭雅嘎停在其他賽手所在格時，令對方絆倒。僅因同時抵達而同格，不會觸發。",
  },
  centaur: {
    name: "半人馬",
    powerName: "馬蹄飛踢",
    uiSummary:
      "半人馬在一次移動中超越其他賽手時，被超越的每名賽手各向後移動 2 格，最遠退至起點。",
  },
  copy_cat: {
    name: "模仿貓",
    powerName: "照辦煮碗",
    uiSummary:
      "持續使用目前領先賽手的能力；多人並列領先時，選擇其中一位。不可複製賽前能力，也不可在同一個不可分割的行動中途更換來源。只有自己領先時，沒有可複製的外來能力。",
  },
  banana: {
    name: "香蕉",
    powerName: "蕉你跌倒",
    uiSummary:
      "任何賽手在一次移動中超越香蕉，都會在完整移動結束後絆倒，不會中途停下。",
  },
  cheerleader: {
    name: "啦啦隊長",
    powerName: "加油加油",
    uiSummary:
      "主移動前，可令所有並列最後的賽手向前移動 2 格，然後自己再向前移動 1 格。若自己也是最後，這是兩次獨立移動。",
  },
  dicemonger: {
    name: "骰子商",
    powerName: "骰子交易",
    uiSummary:
      "每名賽手每回合可使用骰子商提供的一次主移動重擲。其他賽手使用這次重擲時，骰子商在對方主移動前向前移動 1 格；魔術師自己的重擲不算。",
  },
  duelist: {
    name: "決鬥家",
    powerName: "來決鬥吧",
    uiSummary:
      "與其他賽手同格時，可挑戰其中一位決鬥。雙方各擲一粒六面骰，較高者向前移動 2 格；平手由決鬥家勝出。不可打斷正在進行的行動；僅因同時抵達而同格，不會觸發決鬥。",
  },
  genius: {
    name: "天才",
    powerName: "神機妙算",
    uiSummary:
      "主移動擲骰前，可預測一個骰點。若最終保留的骰點與預測相同，本回合後立即再獲得一個完整回合。",
  },
  heckler: {
    name: "柴台王",
    powerName: "幸災樂禍",
    uiSummary:
      "任何賽手結束回合時，若與該回合起始位置相距不超過 1 格，柴台王向前移動 2 格。絆倒後原地恢復的回合也計算。",
  },
  egg: {
    name: "蛋蛋",
    powerName: "破殼變身",
    uiSummary:
      "比賽開始前，可從尚未派出的牌堆抽出 3 名新賽手，選擇其中一名的能力供本場使用。保留蛋蛋身份；複製到的賽前能力也會生效。",
  },
  gunk: {
    name: "黏黏怪",
    powerName: "黏住你",
    uiSummary:
      "所有其他賽手的主移動步數 −1，最低為 0。只影響步數，不會改變骰點。",
  },
  huge_baby: {
    name: "巨嬰",
    powerName: "真係好大",
    uiSummary:
      "起點以外，其他賽手不可留在巨嬰所在格。若出現同格，將對方放到巨嬰後面一格；這不算移動，但算在新位置停下。",
  },
  flip_flop: {
    name: "反轉仔",
    powerName: "位置對調",
    uiSummary:
      "可不擲主移動骰，改為與另一名仍在比賽的賽手同時交換位置。交換屬於傳送，不算移動，也不會造成超越。",
  },
  hare: {
    name: "兔子",
    powerName: "自信爆棚",
    uiSummary: "主移動步數 +2；但若回合開始時獨自領先，便跳過該次主移動。",
  },
  hypnotist: {
    name: "催眠師",
    powerName: "過嚟我度",
    uiSummary:
      "主移動前，可將任意一名仍在比賽的賽手傳送到自己所在格，之後仍照常進行主移動。",
  },
  inchworm: {
    name: "尺蠖",
    powerName: "蠕前一步",
    uiSummary:
      "另一名賽手的主移動最終骰點為 1 時，該賽手跳過這次移動，尺蠖則向前移動 1 格。",
  },
  legs: {
    name: "長腿",
    powerName: "慢跑五步",
    uiSummary:
      "可不擲骰，改用 5 作為主移動的基礎步數。這仍是主移動，會受教練、黏黏怪等步數修正影響。",
  },
  mastermind: {
    name: "幕後軍師",
    powerName: "一早知啦",
    uiSummary:
      "幕後軍師在本場的第一個回合開始時，預測冠軍賽手。若猜中，比賽立即結束，幕後軍師獲得第二名。可以預測自己，同時取得第一、二名獎分。",
  },
  lackey: {
    name: "跟班",
    powerName: "遵命大人",
    uiSummary:
      "另一名賽手的主移動最終骰點為 6 時，跟班先向前移動 2 格，然後對方才進行主移動。",
  },
  loveable_loser: {
    name: "可愛包尾王",
    powerName: "好心痛呀",
    uiSummary:
      "主移動前，若自己獨自排在最後，所屬玩家獲得 1 分。每個符合條件的回合只計一次。",
  },
  mouth: {
    name: "大嘴怪",
    powerName: "一口吞",
    uiSummary:
      "大嘴怪停在一個原本恰有另一名賽手的格子時，淘汰對方。僅因同時抵達而同格不觸發。若只剩一名賽手，比賽立即結束，由其取得下一個可獲得的名次。",
  },
  leaptoad: {
    name: "跳跳蟾蜍",
    powerName: "跳過你",
    uiSummary:
      "任何移動中，有其他賽手佔據的格子都不計入步數，向前或向後移動皆適用。每跳過一個被佔據的格子，各算一次能力發動。",
  },
  magician: {
    name: "魔術師",
    powerName: "變走重擲",
    uiSummary:
      "主移動骰最多可用自己的能力重擲兩次，最終必須使用最後保留的骰點。骰子商提供的重擲另行計算。",
  },
  party_animal: {
    name: "派對動物",
    powerName: "全場吸引力",
    uiSummary:
      "主移動前，所有其他仍在比賽的賽手同時向自己移動 1 格；已同格者不移動。位置效果處理完後，每名與自己同格的其他賽手，令自己的主移動步數 +1。",
  },
  rocket_scientist: {
    name: "火箭科學家",
    powerName: "轟上天",
    uiSummary:
      "看到主移動最終骰點後，可將該基礎步數加倍；若使用，自己會絆倒。這次移動照常完成，下一次主移動才跳過。",
  },
  sisyphus: {
    name: "薛西弗斯",
    powerName: "繼續碌落去",
    uiSummary:
      "賽前獲得 4 分。自己的主移動最終骰點為 6 時，改為傳送回起點，並失去 1 分（分數不低於 0），不再進行該次主移動。",
  },
  romantic: {
    name: "浪漫家",
    powerName: "啊！愛情",
    uiSummary:
      "任何賽手有效地停在一個恰有另一名賽手的格子時，浪漫家向前移動 2 格。兩名賽手僅因同時抵達而組成一對，不會觸發。",
  },
  skipper: {
    name: "船長",
    powerName: "下個到我",
    uiSummary:
      "任何賽手的主移動最終骰點為 1 時，船長成為目前回合結束後的下一位行動賽手；之後依所屬玩家的賽手順序及順時針次序繼續。自己擲到 1 也會觸發。",
  },
  scoocher: {
    name: "挪挪仔",
    powerName: "挪一挪",
    uiSummary:
      "另一名賽手的能力每實際發動一次，挪挪仔便向前移動 1 格。按每次能力發動計算，而不是每回合只計一次。",
  },
  stickler: {
    name: "較真王",
    powerName: "其實呢……",
    uiSummary:
      "較真王仍在比賽時，其他賽手必須以剛好到達終點的步數移動才可衝線；若會超出終點，整次移動取消。所有移動來源均適用，較真王自己不受限制。",
  },
  suckerfish: {
    name: "吸盤魚",
    powerName: "跟實你",
    uiSummary:
      "同格的另一名賽手開始移動時，可選擇跟隨，與對方同時抵達完整移動的終點；不可中途停下，也可以藉此衝線。傳送不觸發跟隨。",
  },
  third_wheel: {
    name: "電燈膽",
    powerName: "插埋一腳",
    uiSummary:
      "主移動前，可傳送到目前恰好有兩名賽手的任意格子，然後仍照常進行主移動。",
  },
  twin: {
    name: "雙胞胎",
    powerName: "贏家再現",
    uiSummary:
      "賽前可選擇本局較早場次的冠軍，使用其能力參加本場。保留雙胞胎身份，複製到的賽前能力也會生效；第一場沒有可選來源。",
  },
};

export function zhRacerName(id: string, bilingual = false): string {
  const name = RACER_TRANSLATIONS[id]?.name;
  const english = racerName(id);
  return name ? (bilingual ? `${name} · ${english}` : name) : english;
}
export function racerLabel(id: string, locale: Locale): string {
  return locale === "zh-Hant" ? zhRacerName(id, true) : racerName(id);
}
export function racerTranslation(id: string, locale: Locale) {
  const original = RACERS.find((r) => r.id === id);
  return locale === "zh-Hant" ? (RACER_TRANSLATIONS[id] ?? original) : original;
}

const TEXT: Record<string, string> = {
  "Use power": "使用能力",
  Pass: "略過",
  "No duel": "不決鬥",
  "No prediction": "不預測",
  "Keep Egg": "保留蛋蛋能力",
  "Keep Twin": "保留雙胞胎能力",
  "Roll die": "擲骰",
  "JOG — move 5": "慢跑五步 — 基礎步數 5",
  "DICEY DEALS reroll": "使用骰子商的重擲",
  Follow: "跟隨",
  Stay: "留在原位",
  "Stay with own move": "照自己的移動行動",
  "Use 4 as the main-move amount?": "主移動的基礎步數改為 4？",
  "Move all last-place racers 2, then move yourself 1?":
    "讓所有並列最後的賽手前進 2 格，然後自己再前進 1 格？",
  "Challenge a racer sharing your space?": "挑戰一名與你同格的賽手？",
  "Challenge a racer before your main move?":
    "在主移動開始前挑戰一名同格賽手？",
  "Predict your final main-move die.": "預測主移動最終保留的骰點。",
  "Choose one of Egg’s three new powers.": "從蛋蛋抽到的三個新能力中選擇一個。",
  "Warp another racer onto your space?": "將一名賽手傳送到你所在格？",
  "Warp any racer onto your space?": "將任意一名賽手傳送到你所在格？",
  "Predict the winner.": "預測本場冠軍。",
  "Double your main move and trip afterwards?":
    "主移動基礎步數加倍，並在之後絆倒？",
  "Warp to a space with exactly two racers?": "傳送到恰好有兩名賽手的格子？",
  "Copy a winner from an earlier race?": "複製較早場次的冠軍能力？",
  "Choose a leading racer to copy.": "選擇一名領先賽手來複製能力。",
  "Roll, or JOG for a base move of 5?":
    "擲骰，還是使用「慢跑五步」，以 5 為基礎步數？",
  "Roll, or swap positions?": "擲骰，還是交換位置？",
  "Keep the roll or use a reroll?": "保留骰點，還是使用重擲？",
  "Follow a racer moving with this group?": "跟隨這組同時移動中的一名賽手？",
  "Waiting for another player": "等待另一位玩家決定",
  "Copy cycle stopped.": "已停止循環複製。",
  "A repeated power cycle completed once and stops here.":
    "重複的能力循環已完整發生一次，於此停止。",
  "A forced turn cycle prevents further progress; remaining placement points are unawarded.":
    "強制回合形成無法繼續前進的循環；本場結束，餘下名次獎分不予頒發。",
  "First place": "第一名",
  "Second place": "第二名",
  Star: "星星格",
  "Loveable Loser": "可愛包尾王",
  Sisyphus: "薛西弗斯",
  "Sisyphus rolled 6": "薛西弗斯擲到 6",
  "Mastermind prediction": "幕後軍師預測成功",
  "Illegal action or wrong player": "這個行動不合法，或不是這位玩家的行動。",
  "This saved game requires its original engine version.":
    "這個存檔需要原本版本的遊戲引擎。",
  "Double-racer mode requires two or three players":
    "雙賽手模式只適用於兩位或三位玩家。",
  "Roll-off could not resolve": "擲骰決定先後未能完成，請重試。",
};

function translatedNames(text: string): string {
  let result = text;
  for (const racer of [...RACERS].sort(
    (a, b) => b.name.length - a.name.length,
  )) {
    result = result.replaceAll(
      racer.name,
      RACER_TRANSLATIONS[racer.id]?.name ?? racer.name,
    );
    result = result.replaceAll(
      racer.powerName,
      RACER_TRANSLATIONS[racer.id]?.powerName ?? racer.powerName,
    );
  }
  return result;
}

/** English engine records stay replay-compatible; only rendered text is translated. */
export function translateGameText(text: string, locale: Locale): string {
  if (locale === "en") return text;
  if (TEXT[text]) return TEXT[text];
  const patterns: [RegExp, (...args: string[]) => string][] = [
    [/^Keep (\d+)$/, (_, n) => `保留 ${n}`],
    [/^POOF reroll \((\d+) left\)$/, (_, n) => `變走重擲（剩餘 ${n} 次）`],
    [/^Space (\d+)$/, (_, n) => `第 ${n} 格`],
    [/^Swap with (.+)$/, (_, name) => `與${name}交換位置`],
    [/^Duel (.+)$/, (_, name) => `挑戰${name}`],
    [
      /^Follow (.+) for its complete move\?$/,
      (_, name) => `跟隨${name}完成整次移動？`,
    ],
    [/^Follow (.+)$/, (_, name) => `跟隨${name}`],
    [/^(.+) rolled (\d+)\.$/, (_, name, n) => `${name}擲出 ${n}。`],
    [/^Draft (\d+) begins\.$/, (_, n) => `第 ${n} 輪選角開始。`],
    [/^(.+) drafts (.+)\.$/, (_, player, name) => `${player}選擇了${name}。`],
    [
      /^Race (\d+): (.+)\.$/,
      (_, n, track) =>
        `第 ${n} 場：${track === "Mild Mile" ? "悠閒一哩" : track === "Wild Wilds" ? "狂野荒野" : track}。`,
    ],
    [/^Race (\d+) ends\.$/, (_, n) => `第 ${n} 場結束。`],
    [/^(.+) takes a turn\.$/, (_, name) => `${name}開始回合。`],
    [/^(.+) ends its turn\.$/, (_, name) => `${name}結束回合。`],
    [/^(.+) is ready to roll\.$/, (_, name) => `${name}可以擲骰了。`],
    [/^(.+) keeps (\d+)\.$/, (_, name, n) => `${name}保留骰點 ${n}。`],
    [
      /^(.+) trips; its next main move is skipped\.$/,
      (_, name) => `${name}絆倒，下一次主移動將會跳過。`,
    ],
    [
      /^(.+) recovers from trip\.$/,
      (_, name) => `${name}從絆倒狀態恢復，本次主移動跳過。`,
    ],
    [
      /^(.+) rests alone in the lead\.$/,
      (_, name) => `${name}獨自領先，休息並跳過本次主移動。`,
    ],
    [
      /^(.+) warps from (\d+) to (\d+)\.$/,
      (_, name, a, b) => `${name}從第 ${a} 格傳送至第 ${b} 格。`,
    ],
    [/^(.+) and (.+) swap\.$/, (_, a, b) => `${a}與${b}同時交換位置。`],
    [
      /^(.+) moves ([+-]?\d+): (\d+) → (\d+)\.$/,
      (_, name, delta, a, b) => `${name}移動 ${delta} 格：${a} → ${b}。`,
    ],
    [
      /^(.+) moves with the group: (\d+) → (\d+)\.$/,
      (_, name, a, b) => `${name}隨組別同時移動：${a} → ${b}。`,
    ],
    [/^(.+) stops at (\d+)\.$/, (_, name, n) => `${name}停在第 ${n} 格。`],
    [
      /^(.+) stops on (star|trip|arrow)\.$/,
      (_, name, type) =>
        `${name}停在${({ star: "星星", trip: "絆倒", arrow: "箭嘴" } as Record<string, string>)[type]}格。`,
    ],
    [
      /^(.+) would overshoot Finish; ACTUALLY… cancels the move\.$/,
      (_, name) => `${name}這次會超出終點；「其實呢……」取消整次移動。`,
    ],
    [
      /^(.+) takes (first|second) place\.$/,
      (_, name, place) =>
        `${name}獲得${place === "first" ? "第一" : "第二"}名。`,
    ],
    [/^(.+) is eliminated\.$/, (_, name) => `${name}被淘汰。`],
    [
      /^(.+) predicts (.+)\.$/,
      (_, name, target) => `${name}預測${target}勝出。`,
    ],
    [
      /^(.+) predicted the winner and takes second\.$/,
      (_, name) => `${name}成功預測冠軍，取得第二名。`,
    ],
    [
      /^(.+) ([+-]?\d+): (.+)\.$/,
      (_, name, amount, reason) =>
        `${name} ${amount} 分：${TEXT[reason] ?? reason}。`,
    ],
  ];
  for (const [pattern, replace] of patterns) {
    const match = text.match(pattern);
    if (match) return translatedNames(replace(...match));
  }
  return translatedNames(text);
}

const EVENT_TYPES: Record<string, string> = {
  DIE_ROLLED: "擲骰",
  DIE_FINALIZED: "骰點確定",
  DRAFT_STARTED: "開始選角",
  RACER_DRAFTED: "完成選角",
  RACE_STARTED: "比賽開始",
  RACE_ENDED: "比賽結束",
  TURN_STARTED: "回合開始",
  TURN_ENDED: "回合結束",
  AWAITING_ROLL: "等待擲骰",
  MAIN_MOVE_SKIPPED: "跳過主移動",
  POWER_TRIGGERED: "能力發動",
  MOVE: "移動",
  WARP: "傳送",
  RACER_STOPPED: "停下",
  RACER_TRIPPED: "絆倒",
  TRACK_SPACE_TRIGGERED: "賽道效果",
  MOVE_CANCELLED: "取消移動",
  FINISH: "衝線",
  RACER_ELIMINATED: "淘汰",
  POINTS: "得分變化",
  PREDICTION: "預測",
  LOOP_STOPPED: "停止循環",
  COPY_CYCLE: "複製循環",
  UNFINISHABLE_RACE: "比賽無法繼續",
};
export function eventTypeLabel(type: string, locale: Locale): string {
  return locale === "zh-Hant"
    ? (EVENT_TYPES[type] ?? type)
    : type.toLowerCase().replaceAll("_", " ");
}
export function translateEvent(
  event: DomainEvent,
  locale: Locale,
  view?: PlayerView,
): string {
  if (locale === "en") return event.message;
  // Player-authored nicknames are never translated, even when they match a racer name.
  if (event.type === "RACER_DRAFTED") {
    const match = event.message.match(/^(.+) drafts (.+)\.$/);
    if (match) return `${match[1]}選擇了${translatedNames(match[2])}。`;
  }
  if (event.type === "POINTS") {
    const match = event.message.match(/^(.+) ([+-]?\d+): (.+)\.$/);
    if (match)
      return `${match[1]} ${match[2]} 分：${translateGameText(match[3], locale)}。`;
  }
  if (event.type === "DIE_ROLLED") {
    const match = event.message.match(/^(.+) rolled (\d+)\.$/);
    if (match)
      return `${view?.players.some((p) => p.name === match[1]) ? match[1] : translatedNames(match[1])}擲出 ${match[2]}。`;
  }
  return translateGameText(event.message, locale);
}
