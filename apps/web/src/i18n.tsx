import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
export type Locale = "en" | "zh-Hant";
export const LOCALE_STORAGE_KEY = "magical-locale";
export function initialLocale(): Locale {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) === "en" ? "en" : "zh-Hant";
  } catch {
    return "zh-Hant";
  }
}
export function translate(
  locale: Locale,
  english: string,
  traditionalChinese: string,
) {
  return locale === "zh-Hant" ? traditionalChinese : english;
}
const Context = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (english: string, traditionalChinese: string) => string;
} | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const setLocale = (next: Locale) => {
    updateLocale(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* The language still works when browser storage is unavailable. */
    }
  };
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "zh-Hant"
        ? "魔法運動會 — 與朋友一起競賽"
        : "Magical Athlete — Race with friends";
  }, [locale]);
  return (
    <Context.Provider
      value={{ locale, setLocale, t: (en, zh) => translate(locale, en, zh) }}
    >
      {children}
    </Context.Provider>
  );
}
export function useI18n() {
  const context = useContext(Context);
  if (!context) throw new Error("I18nProvider is required");
  return context;
}
const UI_MESSAGES: Record<string, string> = {
  "Double-racer mode requires two or three players":
    "雙選手模式只適用於兩位或三位玩家。",
  "This saved game requires its original engine version.":
    "此存檔需要使用原有遊戲版本開啟。",
  "Illegal action or wrong player": "目前不能進行此操作，或尚未輪到這位玩家。",
  "Roll-off could not resolve": "未能透過擲骰決定先後次序，請重新開始遊戲。",
  "bad nickname": "請輸入 1 至 30 個字的暱稱。",
  "bad room code": "請輸入六位英文字母或數字的房間代碼。",
  "database error": "暫時未能連接遊戲資料庫，請稍後再試。",
  "not member": "你尚未加入此房間。",
  unauthenticated: "未能驗證玩家身分，請重新連線。",
  "not found": "找不到所要求的房間或資源。",
  "game started": "遊戲已經開始，不能再更改準備狀態。",
  "host only": "只有房主可以開始遊戲。",
  "not ready": "需要至少兩位玩家，並等待所有人準備就緒。",
  "game not started": "房主尚未開始遊戲。",
  "engine error": "遊戲規則處理發生錯誤。請保留目前畫面及事件紀錄。",
  "server error": "伺服器暫時出現錯誤，請稍後再試。",
  "room create failed": "未能建立房間，請再試一次。",
  "command reused": "此操作識別碼已被使用，請重新載入房間。",
  "bad action": "此操作資料不正確，請重新選擇。",
  "bad command id": "操作識別碼不正確，請重新載入房間。",
  "bad version": "房間版本不正確，請重新載入房間。",
  "bad json": "未能讀取操作資料，請重新載入頁面。",
  "request too large": "操作資料過大，請重新載入頁面。",
  "method not allowed": "此連線方法不受支援，請重新載入頁面。",
  "Failed to execute 'writeText' on 'Clipboard': Write permission denied.":
    "未獲剪貼簿權限，請自行複製瀏覽器中的房間網址。",
  "Saving…": "儲存中…",
  "Saved on this device": "已儲存在此裝置",
  "Could not save — keep this tab open": "無法儲存，請保持此分頁開啟",
  "Saved games are unavailable in this browser. You can still play.":
    "此瀏覽器無法讀取存檔，你仍可開始新遊戲。",
  "Something went wrong. Please try again.": "發生錯誤，請再試一次。",
  "Action could not be completed.": "未能完成操作，請再試一次。",
  "The room changed. Refreshing; please choose again.":
    "房間狀態已更新。正在重新整理，請重新選擇。",
  "Online rooms are not configured. Local play is available.":
    "線上房間尚未設定，你可以使用本機遊戲。",
  "Your player session is unavailable. Return home to reconnect.":
    "未能讀取你的玩家身分，請返回主頁重新連線。",
  "Unable to connect. Please retry.": "無法連線，請再試一次。",
  "Connection interrupted": "連線中斷",
  "Failed to fetch": "網絡連線失敗，請檢查連線後再試。",
  "illegal action": "此操作不符合目前遊戲規則。",
  "room not found": "找不到此房間。",
  "not a member": "你尚未加入此房間。",
  unauthorized: "玩家身分驗證失敗，請重新連線。",
  "connection failed": "連線失敗，請再試一次。",
  "room full": "房間已滿。",
  "game already started": "遊戲已經開始。",
  "not host": "只有房主可以開始遊戲。",
  "players not ready": "請等待所有玩家準備就緒。",
  "invalid input": "輸入資料不正確，請檢查後再試。",
  "rate limited": "操作太頻密，請稍候再試。",
};
export function translateUiMessage(message: string, locale: Locale) {
  if (locale === "en") return message;
  return (
    UI_MESSAGES[message] ??
    UI_MESSAGES[message.replace(/^Error: /, "")] ??
    message
  );
}
export function phaseLabel(phase: string, locale: Locale) {
  if (locale === "en") return phase;
  return (
    (
      {
        draft: "選秀",
        selection: "選擇選手",
        race: "比賽中",
        results: "賽果",
        finished: "已完成",
      } as Record<string, string>
    )[phase] ?? phase
  );
}
