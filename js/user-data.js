// ============================================================================
//  DATOS DEL USUARIO  —  All-Anime
//  Favoritos (animes y episodios) y calificación con estrellas, en Firestore.
//  Todo por usuario y dinámico (las calificaciones se agregan entre todos).
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { observeAuth } from "./auth.js";
import { episodeId as makeEpId } from "./catalog-utils.js";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection,
  serverTimestamp, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;
export const userReady = new Promise((resolve) => {
  if (!FIREBASE_CONFIGURED) { resolve(null); return; }
  let first = true;
  try {
    observeAuth((u) => { currentUser = u; if (first) { first = false; resolve(u); } });
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

// ---- CALIFICACIÓN CON ESTRELLAS (agregada entre todos) ----------------------
// animeStats/{id} = { ratingSum, ratingCount }  →  promedio = sum / count
function animeStatsRef(id) { return doc(db, "animeStats", id); }
function myRatingRef(uid, id) { return doc(db, "users", uid, "ratings", id); }

export async function getRatingState(animeId) {
  await userReady;
  let sum = 0, count = 0, mine = 0;
  try {
    const s = await getDoc(animeStatsRef(animeId));
    if (s.exists()) { sum = s.data().ratingSum || 0; count = s.data().ratingCount || 0; }
    if (currentUser) {
      const r = await getDoc(myRatingRef(currentUser.uid, animeId));
      if (r.exists()) mine = r.data().stars || 0;
    }
  } catch (e) { /* silencioso */ }
  return { avg: count ? sum / count : 0, count, mine };
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
