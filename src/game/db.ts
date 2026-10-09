/**
 * RATÓN — db.ts
 * Persistencia con IndexedDB (fallback a localStorage).
 * Guarda: mejor distancia, partidas jugadas, queso total, mejor aura.
 */

export interface SaveData {
  best: number;
  runs: number;
  cheeseTotal: number;
  auraBest: number;
}

const DEFAULTS: SaveData = { best: 0, runs: 0, cheeseTotal: 0, auraBest: 0 };
const DB_NAME = "raton-db";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Carga los datos guardados (con fallback a localStorage) */
export async function loadSave(): Promise<SaveData> {
  try {
    const data = await idbGet<SaveData>("save");
    return { ...DEFAULTS, ...(data ?? {}) };
  } catch {
    try {
      const raw = localStorage.getItem("raton-save");
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* noop */
    }
    return { ...DEFAULTS };
  }
}

/** Guarda los datos (IndexedDB + espejo en localStorage) */
export async function persistSave(data: SaveData): Promise<void> {
  try {
    await idbSet("save", data);
  } catch {
    /* noop */
  }
  try {
    localStorage.setItem("raton-save", JSON.stringify(data));
  } catch {
    /* noop */
  }
}

/** Aplica el resultado de una partida y devuelve el save actualizado */
export function applyRun(
  save: SaveData,
  run: { distance: number; cheese: number; auraMax: number }
): { next: SaveData; isRecord: boolean } {
  const isRecord = run.distance > save.best;
  const next: SaveData = {
    best: isRecord ? Math.floor(run.distance) : save.best,
    runs: save.runs + 1,
    cheeseTotal: save.cheeseTotal + run.cheese,
    auraBest: Math.max(save.auraBest, run.auraMax),
  };
  void persistSave(next);
  return { next, isRecord };
}
