// Crash/refresh recovery for the browser editor.
//
// Project payloads can contain multi-megabyte SVG markup, embedded raster data URLs,
// and undo snapshots.  They therefore belong in IndexedDB, never localStorage.  The
// observer is event-driven: document mutations schedule one idle write, and a later
// mutation replaces that pending write.  There is no timer or DOM polling loop.

const DB_NAME = "hector-vector-recovery";
const DB_VERSION = 1;
const STORE = "drafts";
const ACTIVE_KEY = "active";

let dbPromise = null;
let captureSnapshot = null;
let observer = null;
let idleHandle = null;
let frameHandle = null;
let writeChain = Promise.resolve();

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Could not open recovery storage."));
    });
  }
  return dbPromise;
}

function putSnapshot(snapshot) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(snapshot, ACTIVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not save the recovery draft."));
    tx.onabort = () => reject(tx.error || new Error("Recovery draft write was aborted."));
  }));
}

function enqueueSnapshot(snapshot) {
  if (!snapshot) return Promise.resolve(false);
  // Keep writes ordered.  A failed/quota-limited write must not permanently poison
  // the chain; the next real edit gets another chance to persist.
  writeChain = writeChain.catch(() => {}).then(() => putSnapshot(snapshot));
  return writeChain.then(() => true, () => false);
}

function cancelScheduledWrite() {
  if (idleHandle != null && "cancelIdleCallback" in window) cancelIdleCallback(idleHandle);
  if (frameHandle != null) cancelAnimationFrame(frameHandle);
  idleHandle = null;
  frameHandle = null;
}

function runScheduledWrite() {
  idleHandle = null;
  frameHandle = null;
  if (!captureSnapshot) return;
  let snapshot = null;
  try { snapshot = captureSnapshot(); } catch { return; }
  enqueueSnapshot(snapshot);
}

export function scheduleRecovery() {
  if (!captureSnapshot) return;
  cancelScheduledWrite();
  if ("requestIdleCallback" in window) {
    idleHandle = requestIdleCallback(runScheduledWrite, { timeout: 1200 });
  } else {
    // Safari has no requestIdleCallback.  One animation-frame callback still coalesces
    // a burst of synchronous DOM mutations without introducing a timer or polling.
    frameHandle = requestAnimationFrame(runScheduledWrite);
  }
}

export function saveRecoveryNow() {
  cancelScheduledWrite();
  if (!captureSnapshot) return Promise.resolve(false);
  let snapshot = null;
  try { snapshot = captureSnapshot(); } catch { return Promise.resolve(false); }
  return enqueueSnapshot(snapshot);
}

function isEditorChrome(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  return !!(el && el.closest && el.closest("g.hv-overlay, g.hv-guideslayer, g.hv-preview"));
}

export function configureRecovery({ capture, root }) {
  captureSnapshot = capture;
  if (observer) observer.disconnect();
  observer = new MutationObserver((records) => {
    if (records.some((record) => !isEditorChrome(record.target))) scheduleRecovery();
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
}

export async function loadRecovery() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(ACTIVE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("Could not read the recovery draft."));
    });
  } catch {
    return null;
  }
}

export function isReloadNavigation() {
  const nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  return !!nav && nav.type === "reload";
}

