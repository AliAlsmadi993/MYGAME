// تخزين الأصوات الحقيقية على جهاز اللاعب (IndexedDB): ملفات مستوردة وتسجيلات من الاستوديو.
// كل سجل: { id, kind: 'file' | 'pcm', data: ArrayBuffer | Float32Array, sampleRate?, name? }
const DB = 'salwa-audio';
const STORE = 'sounds';

function open() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => res(r?.result);
    t.onerror = () => rej(t.error);
  });
}

export const soundStore = {
  put: (rec) => tx('readwrite', (s) => s.put(rec)),
  all: () => tx('readonly', (s) => s.getAll()).then((r) => r || []).catch(() => []),
  del: (id) => tx('readwrite', (s) => s.delete(id)),
  async delPrefix(prefix) {
    const all = await soundStore.all();
    await tx('readwrite', (s) => all.filter((r) => r.id.startsWith(prefix)).forEach((r) => s.delete(r.id)));
  },
};
