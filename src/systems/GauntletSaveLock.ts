/** Serialize the synchronous wallet and record writes across same-origin tabs. */
export function withGauntletLock<T>(work: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request('im-gauntlet-save', work);
  // LAN HTTP may lack Web Locks. IndexedDB orders overlapping readwrite transactions
  // across connections. Keep the entire synchronous operation inside its request callback.
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open('im-gauntlet-mutex', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('lock');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('lock', 'readwrite');
      let result: T, error: unknown;
      tx.objectStore('lock').get(0).onsuccess = () => {
        try { result = work(); } catch (e) { error = e; tx.abort(); }
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = () => { db.close(); reject(error ?? tx.error); };
    };
  });
}
