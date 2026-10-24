// A small IndexedDB store for things too big for localStorage: autosaved documents and recent files.

const DB_NAME = 'oi1';
export type StoreName = 'kv' | 'recent';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('recent', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error); };
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', s => s.get(key) as IDBRequest<T | undefined>),
  set: (store: StoreName, value: unknown, key?: string) => run<IDBValidKey>(store, 'readwrite', s => s.put(value, key)).then(() => {}),
  delete: (store: StoreName, key: string) => run<undefined>(store, 'readwrite', s => s.delete(key)).then(() => {}),
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', s => s.getAll() as IDBRequest<T[]>),
  /** Deletes every key that starts with `prefix`. */
  deletePrefix: (store: StoreName, prefix: string) =>
    run<undefined>(store, 'readwrite', s => { s.delete(IDBKeyRange.bound(prefix, `${prefix}￿`)); }).then(() => {}),
};
