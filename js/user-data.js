// ============================================================================
//  DATOS DEL USUARIO  —  All-Anime
//  Favoritos (animes y episodios) y calificación con estrellas, en Firestore.
//  Todo por usuario y dinámico (las calificaciones se agregan entre todos).
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { observeAuth } from "./auth.js";
import { episodeId as makeEpId } from "./catalog-utils.js";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, orderBy, limit,
  serverTimestamp, runTransaction, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
// Guarda/actualiza el perfil público mínimo del usuario (email, nombre) para que
// el panel admin pueda encontrarlo por correo (p. ej. para quitarle la publicidad).
async function upsertProfile(u) {
  if (!u) return;
  try {
    await setDoc(doc(db, "users", u.uid), {
      email: u.email || "", emailLower: (u.email || "").toLowerCase(),
      displayName: u.displayName || "", photoURL: u.photoURL || "", lastSeen: serverTimestamp(),
    }, { merge: true });
  } catch (e) { /* no crítico */ }
}
export const userReady = new Promise((resolve) => {
  if (!FIREBASE_CONFIGURED) { resolve(null); return; }
  let first = true;
  try {
    observeAuth((u) => { currentUser = u; if (u) upsertProfile(u); if (first) { first = false; resolve(u); } });
  } catch (e) { resolve(null); }
});

export function getUser() { return currentUser; }
export function isLoggedIn() { return !!currentUser; }
export { makeEpId };

// ---- FAVORITOS: ANIMES ------------------------------------------------------
function favAnimeRef(uid, id) { return doc(db, "users", uid, "favAnimes", id); }

export async function isFavAnime(id) {
  await userReady;
  if (!currentUser) return false;
  try { return (await getDoc(favAnimeRef(currentUser.uid, id))).exists(); } catch { return false; }
}
// Alterna favorito. Devuelve true si quedó como favorito.
export async function toggleFavAnime(anime) {
  if (!currentUser) throw new Error("login");
  const ref = favAnimeRef(currentUser.uid, anime.id);
  if ((await getDoc(ref)).exists()) { await deleteDoc(ref); return false; }
  await setDoc(ref, {
    id: anime.id, title: anime.title, img: anime.img || "", imgMobile: anime.imgMobile || "",
    year: anime.year || "", type: anime.type || "", quality: anime.quality || "",
    genres: anime.genres || [], rating: anime.rating || 0, seasons: anime.seasons || 1,
    description: anime.description || "", at: serverTimestamp(),
  });
  return true;
}
export async function listFavAnimes() {
  await userReady;
  if (!currentUser) return [];
  const snap = await getDocs(collection(db, "users", currentUser.uid, "favAnimes"));
  return snap.docs.map((d) => d.data()).sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
}

// ---- FAVORITOS: EPISODIOS ---------------------------------------------------
function favEpRef(uid, epId) { return doc(db, "users", uid, "favEpisodes", epId); }

export async function isFavEpisode(anime, episode) {
  await userReady;
  if (!currentUser) return false;
  try { return (await getDoc(favEpRef(currentUser.uid, makeEpId(anime.id, episode)))).exists(); } catch { return false; }
}
export async function toggleFavEpisode(anime, episode) {
  if (!currentUser) throw new Error("login");
  const epId = makeEpId(anime.id, episode);
  const ref = favEpRef(currentUser.uid, epId);
  if ((await getDoc(ref)).exists()) { await deleteDoc(ref); return false; }
  await setDoc(ref, {
    epId, animeId: anime.id, animeTitle: anime.title,
    season: episode.season, number: episode.number, title: episode.title || "",
    img: episode.img || anime.img || "", language: episode.language || "",
    duration: episode.duration || "", releaseDate: episode.releaseDate || "",
    videoUrl: episode.videoUrl || "", at: serverTimestamp(),
  });
  return true;
}
export async function listFavEpisodes() {
  await userReady;
  if (!currentUser) return [];
  const snap = await getDocs(collection(db, "users", currentUser.uid, "favEpisodes"));
  return snap.docs.map((d) => d.data()).sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0));
}

// ---- HISTORIAL / SEGUIR VIENDO (sincronizado entre dispositivos) -----------
function historyRef(uid, epId) { return doc(db, "users", uid, "history", epId); }

// Registra que el usuario abrió/vio un episodio (actualiza la fecha).
export async function recordHistory(anime, episode) {
  await userReady;
  if (!currentUser) return;
  const epId = makeEpId(anime.id, episode);
  try {
    const ref = historyRef(currentUser.uid, epId);
    const existed = (await getDoc(ref)).exists();
    await setDoc(ref, {
      epId, animeId: anime.id, animeTitle: anime.title,
      img: episode.img || anime.img || "", season: episode.season, number: episode.number,
      title: episode.title || "", language: episode.language || "",
      videoUrl: episode.videoUrl || "", at: serverTimestamp(),
    }, { merge: true });
    // Primera vez que ve este episodio → suma a la popularidad pública del
    // anime Y al contador de vistas del episodio (para "episodios más vistos").
    if (!existed) {
      await setDoc(doc(db, "animeStats", anime.id), { viewCount: increment(1) }, { merge: true });
      await setDoc(doc(db, "episodeStats", epId), {
        viewCount: increment(1),
        animeId: anime.id, animeTitle: anime.title,
        season: episode.season, number: episode.number,
        title: episode.title || "", img: episode.img || anime.img || "",
      }, { merge: true });
    }
  } catch (e) { /* no crítico */ }
}

// Actualiza el progreso de reproducción de un episodio (para "seguir viendo").
// No reordena el historial (no toca `at`) para evitar escrituras excesivas.
export async function updateHistoryProgress(anime, episode, data) {
  await userReady;
  if (!currentUser) return;
  const epId = makeEpId(anime.id, episode);
  try {
    await setDoc(historyRef(currentUser.uid, epId), {
      progress: Math.max(0, Math.min(1, data.progress || 0)),
      positionSeconds: Math.round(data.positionSeconds || 0),
      durationSeconds: Math.round(data.durationSeconds || 0),
    }, { merge: true });
  } catch (e) { /* no crítico */ }
}

// Animes más vistos por la comunidad (para "favoritos del público" y Top 10).
export async function getPopularAnimes(max = 20) {
  try {
    const q = query(collection(db, "animeStats"), orderBy("viewCount", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, viewCount: d.data().viewCount || 0 })).filter((x) => x.viewCount > 0);
  } catch (e) { return []; }
}

// Lista el historial (más reciente primero). Sirve para "seguir viendo" e historial.
export async function listHistory(max = 60) {
  await userReady;
  if (!currentUser) return [];
  try {
    const q = query(collection(db, "users", currentUser.uid, "history"), orderBy("at", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data());
  } catch (e) { return []; }
}

// ---- CALIFICACIÓN CON ESTRELLAS (agregada entre todos) ----------------------
// animeStats/{id} = { ratingSum, ratingCount }  →  promedio = sum / count
function animeStatsRef(id) { return doc(db, "animeStats", id); }
function myRatingRef(uid, id) { return doc(db, "users", uid, "ratings", id); }

// Convierte "5.7K" / "1.2K" / "500" a número.
export function parseCount(v) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim().toUpperCase().replace(",", ".");
  const m = s.match(/^([\d.]+)\s*([KM])?$/);
  if (!m) return 0;
  let n = parseFloat(m[1]) || 0;
  if (m[2] === "K") n *= 1000;
  if (m[2] === "M") n *= 1e6;
  return Math.round(n);
}

// Estado de calificación. Mezcla la base existente del anime (seedAvg con
// seedCount votos) con los votos nuevos guardados en Firestore.
export async function getRatingState(animeId, seedAvg = 0, seedCount = 0) {
  await userReady;
  let fsSum = 0, fsCount = 0, mine = 0;
  seedAvg = Number(seedAvg) || 0;
  seedCount = parseCount(seedCount);
  try {
    const s = await getDoc(animeStatsRef(animeId));
    if (s.exists()) { fsSum = s.data().ratingSum || 0; fsCount = s.data().ratingCount || 0; }
    if (currentUser) {
      const r = await getDoc(myRatingRef(currentUser.uid, animeId));
      if (r.exists()) mine = r.data().stars || 0;
    }
  } catch (e) { /* silencioso */ }
  const totalCount = seedCount + fsCount;
  const totalSum = seedAvg * seedCount + fsSum;
  return { avg: totalCount ? totalSum / totalCount : seedAvg, count: totalCount, mine };
}

// Guarda/actualiza la calificación (1-5) del usuario. Devuelve el nuevo estado.
export async function setRating(animeId, stars) {
  if (!currentUser) throw new Error("login");
  stars = Math.max(1, Math.min(5, Math.round(stars)));
  const statRef = animeStatsRef(animeId);
  const rRef = myRatingRef(currentUser.uid, animeId);
  await runTransaction(db, async (tx) => {
    const [sSnap, rSnap] = [await tx.get(statRef), await tx.get(rRef)];
    let sum = sSnap.exists() ? sSnap.data().ratingSum || 0 : 0;
    let count = sSnap.exists() ? sSnap.data().ratingCount || 0 : 0;
    const prev = rSnap.exists() ? rSnap.data().stars || 0 : 0;
    if (prev) { sum += stars - prev; }        // actualiza su voto
    else { sum += stars; count += 1; }        // primer voto
    tx.set(rRef, { stars, at: serverTimestamp() });
    tx.set(statRef, { ratingSum: sum, ratingCount: count }, { merge: true });
  });
  return getRatingState(animeId);
}
