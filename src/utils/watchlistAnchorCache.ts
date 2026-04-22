/** 1h 开盘价序列缓存（按基准 bucket），与 AdvancedMonitor 逻辑一致。 */

export type LookbackHourBar = { ts: number; open: number };

export type LookbackCacheRecord = {
  code: string;
  symbol: string;
  bucketKey: string;
  rows: LookbackHourBar[];
  updatedAt: number;
};

const DB_NAME = 'WatchlistAdvMonitorCache';
const STORE = 'anchor1hV1';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'code' });
      }
    };
  });
}

export function getAnchorBucketKey(anchorUtcMs: number): string {
  return `anchor:${anchorUtcMs}`;
}

export function getLookbackCacheCode(
  symbol: string,
  bucketKey: string,
): string {
  return `${symbol}::${bucketKey}`;
}

export async function loadLookbackSeriesCache(
  symbols: string[],
  bucketKey: string,
): Promise<Map<string, LookbackHourBar[]>> {
  const db = await openDb();
  const out = new Map<string, LookbackHourBar[]>();
  await Promise.all(
    symbols.map(
      (symbol) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readonly');
          const store = tx.objectStore(STORE);
          const code = getLookbackCacheCode(symbol, bucketKey);
          const r = store.get(code);
          r.onsuccess = () => {
            const rec = r.result as LookbackCacheRecord | undefined;
            if (!rec?.rows?.length) {
              resolve();
              return;
            }
            const rows = rec.rows
              .map((x) => ({ ts: Number(x.ts), open: Number(x.open) }))
              .filter(
                (x) =>
                  Number.isFinite(x.ts) &&
                  Number.isFinite(x.open) &&
                  x.open > 0,
              )
              .sort((a, b) => a.ts - b.ts);
            if (rows.length > 0) out.set(symbol, rows);
            resolve();
          };
          r.onerror = () => reject(r.error);
        }),
    ),
  );
  return out;
}

export async function saveLookbackSeriesCache(
  symbol: string,
  bucketKey: string,
  rows: LookbackHourBar[],
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const record: LookbackCacheRecord = {
      code: getLookbackCacheCode(symbol, bucketKey),
      symbol,
      bucketKey,
      rows,
      updatedAt: Date.now(),
    };
    const r = store.put(record);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function clearLookbackCacheByBucket(
  bucketKey: string,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const r = store.getAll();
    r.onsuccess = () => {
      const all = (r.result ?? []) as LookbackCacheRecord[];
      const toDelete = all
        .filter((x) => x?.bucketKey === bucketKey)
        .map((x) => x.code);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      if (toDelete.length === 0) return;
      for (const code of toDelete) {
        store.delete(code);
      }
    };
    r.onerror = () => reject(r.error);
  });
}
