import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  PlayerAction,
  PlayerView,
} from "../../../packages/engine/src/types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
export const onlineConfigured = Boolean(url && key);
export interface RoomMember {
  id: string;
  name: string;
  ready: boolean;
}
export interface RoomView {
  id: string;
  code: string;
  version: number;
  hostId: string;
  playerId: string;
  members: RoomMember[];
  game: PlayerView | null;
}
export type OnlineAction =
  | PlayerAction
  | { type: "ready"; ready: boolean }
  | { type: "start"; doubleRacers?: boolean; randomTeams?: boolean };
export interface OnlineClient {
  createRoom(nickname: string): Promise<RoomView>;
  joinRoom(code: string, nickname: string): Promise<RoomView>;
  getRoom(roomId: string): Promise<RoomView>;
  send(
    roomId: string,
    expectedVersion: number,
    action: OnlineAction,
  ): Promise<RoomView>;
  subscribe(
    roomId: string,
    onChange: (room: RoomView) => void,
    onError?: (error: Error) => void,
  ): () => void;
}
export class OnlineError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(
      code === "STALE_STATE"
        ? "The room changed. Refreshing; please choose again."
        : code.replaceAll("_", " ").toLowerCase(),
    );
  }
}
let connecting: Promise<OnlineClient> | undefined;
export function connectOnline(): Promise<OnlineClient> {
  if (!onlineConfigured)
    return Promise.reject(
      new Error("Online rooms are not configured. Local play is available."),
    );
  return (connecting ??= initialize().catch((error) => {
    connecting = undefined;
    throw error;
  }));
}
async function initialize(): Promise<OnlineClient> {
  const supabase = createClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const signed = await supabase.auth.signInAnonymously();
    if (signed.error) throw signed.error;
  }
  return makeClient(supabase);
}
function makeClient(supabase: SupabaseClient): OnlineClient {
  async function request(path: string, body?: unknown): Promise<RoomView> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session)
        throw new Error(
          "Your player session is unavailable. Return home to reconnect.",
        );
      let response: Response;
      try {
        response = await fetch(`${url}/functions/v1/game${path}`, {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            apikey: key!,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
      } catch (error) {
        if (attempt === 0) continue;
        throw error;
      }
      if (response.status >= 500 && attempt === 0) continue;
      const result = await response.json();
      if (!response.ok)
        throw new OnlineError(
          result.error ?? "CONNECTION_FAILED",
          response.status,
        );
      return result as RoomView;
    }
    throw new Error("Unable to connect. Please retry.");
  }
  return {
    createRoom: (nickname) =>
      request("/rooms", { nickname, commandId: crypto.randomUUID() }),
    joinRoom: (code, nickname) =>
      request("/rooms/join", {
        code: code.trim().toUpperCase(),
        nickname,
        commandId: crypto.randomUUID(),
      }),
    getRoom: (roomId) => request(`/rooms/${roomId}`),
    send: (roomId, expectedVersion, action) =>
      request(`/rooms/${roomId}/actions`, {
        commandId: crypto.randomUUID(),
        expectedVersion,
        action,
      }),
    subscribe(roomId, onChange, onError) {
      let stopped = false,
        loading = false,
        again = false,
        version = -1;
      const refresh = async () => {
        if (stopped) return;
        if (loading) {
          again = true;
          return;
        }
        loading = true;
        try {
          const room = await request(`/rooms/${roomId}`);
          if (!stopped && room.version >= version) {
            version = room.version;
            onChange(room);
          }
        } catch (error) {
          if (!stopped)
            onError?.(
              error instanceof Error
                ? error
                : new Error("Connection interrupted"),
            );
        } finally {
          loading = false;
          if (again && !stopped) {
            again = false;
            void refresh();
          }
        }
      };
      const channel = supabase
        .channel(`room:${roomId}`, { config: { private: true } })
        .on("broadcast", { event: "changed" }, () => {
          void refresh();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void refresh();
        });
      const visible = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      window.addEventListener("focus", visible);
      document.addEventListener("visibilitychange", visible);
      const timer = window.setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, 15000);
      void refresh();
      return () => {
        stopped = true;
        clearInterval(timer);
        window.removeEventListener("focus", visible);
        document.removeEventListener("visibilitychange", visible);
        void supabase.removeChannel(channel);
      };
    },
  };
}
