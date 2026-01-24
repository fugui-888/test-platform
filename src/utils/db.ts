const DB_NAME = 'KlineDB';
const STORE_NAME = 'klines';
const DB_VERSION = 1;

export interface KlineRecord {
  symbol: string;
  interval: string;
  klines: string[][];
  lastUpdated: number;
}

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveKlineData = async (
  symbol: string,
  interval: string,
  klines: string[][],
) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const id = `${symbol}_${interval}`;
    const record: KlineRecord & { id: string } = {
      id,
      symbol,
      interval,
      klines,
      lastUpdated: Date.now(),
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getKlineData = async (
  symbol: string,
  interval: string,
): Promise<KlineRecord | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const id = `${symbol}_${interval}`;
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const getAllKlineDataByInterval = async (
  interval: string,
): Promise<KlineRecord[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as (KlineRecord & { id: string })[];
      resolve(all.filter((r) => r.interval === interval));
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearKlineData = async () => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearKlineDataByInterval = async (interval: string) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all = request.result as (KlineRecord & { id: string })[];
      const toDelete = all.filter((r) => r.interval === interval);

      let deletedCount = 0;
      if (toDelete.length === 0) {
        resolve();
        return;
      }

      toDelete.forEach((r) => {
        const deleteReq = store.delete(r.id);
        deleteReq.onsuccess = () => {
          deletedCount++;
          if (deletedCount === toDelete.length) {
            resolve();
          }
        };
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    };
    request.onerror = () => reject(request.error);
  });
};
