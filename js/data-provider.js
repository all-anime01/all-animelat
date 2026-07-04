// ============================================================================
//  PROVEEDOR DE DATOS DEL CATÁLOGO  —  All-Anime
// ----------------------------------------------------------------------------
//  Entrega el arreglo `animeData` (mismo formato que database.js) leyéndolo
//  desde Firestore, con caché en IndexedDB e invalidación por versión.
//
//  · Si Firebase no está configurado o falla → usa database.js (fallback).
//  · Estrategia "stale-while-revalidate": sirve la caché al instante y
//    comprueba en segundo plano si el catálogo cambió (para el próximo load).
//  · Costo típico: ~1 lectura por carga; una recarga completa (118 docs)
//    solo cuando el admin sube/edita algo (cambia meta/catalog.version).
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Fallback perezoso: database.js solo se descarga si Firestore no responde
let _bundled = null;
async function getBundled() {
  if (!_bundled) {
    const mod = await import("./database.js");
    _bundled = mod.animeData;
  }
  return _bundled;
}

// ---- Mini-caché en IndexedDB (sin el límite de ~5MB de localStorage) --------
const IDB_NAME = "allanime-cache";
const IDB_STORE = "kv";

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const dbi = await openIdb();
    return await new Promise((resolve, reject) => {
      const r = dbi.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const dbi = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = dbi.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { /* la caché es opcional */ }
}

// ---- Lectura de la versión del catálogo (documento diminuto) ---------------
async function getRemoteVersion() {
  const snap = await getDoc(doc(db, "meta", "catalog"));
  return snap.exists() ? snap.data().version || null : null;
}

// ---- Descarga completa del catálogo y lo guarda en caché -------------------
async function fetchFresh() {
  if (!FIREBASE_CONFIGURED) return { data: await getBundled(), version: null };
  try {
    const version = await getRemoteVersion();
    const snap = await getDocs(collection(db, "animes"));
    if (snap.empty) return { data: await getBundled(), version: null };
    const data = snap.docs.map((d) => d.data());
    await idbSet("catalog", { version, data, ts: Date.now() });
    return { data, version };
  } catch (e) {
    console.warn("[data-provider] Firestore no disponible; usando database.js", e);
    return { data: await getBundled(), version: null };
  }
}

// ---- Revalidación en segundo plano (no bloquea el render) ------------------
async function revalidate(cachedVersion) {
  if (!FIREBASE_CONFIGURED) return;
  try {
    const remote = await getRemoteVersion();
    if (remote && remote !== cachedVersion) {
      await fetchFresh(); // actualiza IndexedDB para la próxima carga
    }
  } catch (e) { /* silencioso */ }
}

/**
 * Devuelve una promesa con el arreglo animeData (con episodios).
 * Uso: getAnimeData().then(animeData => { ... })
 */
export async function getAnimeData() {
  const cached = await idbGet("catalog");
  if (cached && Array.isArray(cached.data) && cached.data.length) {
    revalidate(cached.version); // fire-and-forget
    return cached.data;
  }
  const fresh = await fetchFresh();
  return fresh.data;
}

/** Obtiene un anime completo por id (Firestore → caché → fallback). */
export async function getAnimeById(id) {
  const all = await getAnimeData();
  return all.find((a) => a.id === id) || null;
}

/** Fuerza recarga del catálogo desde Firestore (ignora la caché). */
export async function refreshCatalog() {
  const fresh = await fetchFresh();
  return fresh.data;
}
