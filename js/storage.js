// storage.js — the only file that touches localStorage. Every access is wrapped so
// private browsing, a full quota, or a corrupted value degrade to "nothing stored"
// and the calculator behaves exactly as it does with no storage at all.
//
// Documents carry v: 1. Another version, or unparseable text, reads as absent —
// never migrated, never deleted (a newer build may read it later).

const VERSION = 1;
const KEYS = { prefs: 'printcalc.prefs', last: 'printcalc.last', history: 'printcalc.history' };
const UNITS = ['in', 'mm'];

/** The real localStorage, or null when merely touching it throws (some private modes). */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function probe(store) {
  try {
    store.setItem('printcalc.probe', '1');
    store.removeItem('printcalc.probe');
    return true;
  } catch {
    return false;
  }
}

/** @param store  anything with getItem/setItem/removeItem, or null. */
export function createStorage(store) {
  const read = (key) => {
    try {
      const raw = store.getItem(key);
      if (raw === null || raw === undefined) return null;
      const doc = JSON.parse(raw);
      return doc && typeof doc === 'object' && doc.v === VERSION ? doc : null;
    } catch {
      return null;
    }
  };
  const write = (key, doc) => {
    try {
      store.setItem(key, JSON.stringify({ v: VERSION, ...doc }));
    } catch {
      // Nowhere to write, or no room: the in-memory state is still correct.
    }
  };
  const remove = (key) => {
    try {
      store.removeItem(key);
    } catch {
      // Nothing to remove, or nowhere to remove it from.
    }
  };

  return {
    available: probe(store),
    loadPrefs() {
      const doc = read(KEYS.prefs);
      return doc && UNITS.includes(doc.unit) && typeof doc.resume === 'boolean' ? { unit: doc.unit, resume: doc.resume } : null;
    },
    savePrefs: (prefs) => write(KEYS.prefs, { unit: prefs.unit, resume: prefs.resume }),
    loadLast() {
      const doc = read(KEYS.last);
      return doc && UNITS.includes(doc.unit) && doc.job && typeof doc.job === 'object' ? { unit: doc.unit, job: doc.job } : null;
    },
    saveLast: (unit, job) => write(KEYS.last, { unit, job }),
    clearLast: () => remove(KEYS.last),
    loadHistory() {
      const doc = read(KEYS.history);
      if (!doc || !Array.isArray(doc.entries)) return [];
      return doc.entries.filter((e) => e && typeof e === 'object' && UNITS.includes(e.unit) && e.job && typeof e.job === 'object' && Number.isFinite(e.at));
    },
    saveHistory: (entries) => write(KEYS.history, { entries }),
  };
}
