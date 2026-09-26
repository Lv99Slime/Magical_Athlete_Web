import type { GameState } from "@magical/engine";
const STORE = "games";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("magical-athlete", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadGame(): Promise<GameState | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE);
    const req = tx.objectStore(STORE).get("local");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function writeGame(state: GameState): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, "local");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Serialize saves so a slower database open cannot replace a newer snapshot.
let pendingSave: Promise<void> = Promise.resolve();
export function saveGame(state: GameState): Promise<void> {
  pendingSave = pendingSave.catch(() => {}).then(() => writeGame(state));
  return pendingSave;
}
