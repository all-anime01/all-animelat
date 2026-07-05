// ============================================================================
//  LÓGICA DEL PANEL DE ADMINISTRACIÓN  —  All-Anime
//  Crear/editar animes y agregar episodios manteniendo la misma estructura
//  que js/database.js, y sincronizando el índice catalog/index.
// ============================================================================

import { db } from "./firebase-config.js";
import { toCatalogCard, orderedEpisodes, slugify, seasonNumber } from "./catalog-utils.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Lee el índice del catálogo (para poblar selectores).
export async function getCatalogIndex() {
  const snap = await getDoc(doc(db, "catalog", "index"));
  return snap.exists() ? snap.data() : { items: [], count: 0, version: 0 };
}

// Lee un anime completo.
export async function getAnime(animeId) {
  const snap = await getDoc(doc(db, "animes", animeId));
  return snap.exists() ? snap.data() : null;
}

// Inserta o reemplaza la tarjeta de un anime dentro de catalog/index.
async function upsertCatalogCard(anime) {
  const ref = doc(db, "catalog", "index");
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { items: [] };
  const items = Array.isArray(data.items) ? data.items : [];
  const card = toCatalogCard(anime);
  const idx = items.findIndex((it) => it.id === anime.id);
  if (idx >= 0) items[idx] = card;
  else items.push(card);
  const version = Date.now();
  await setDoc(ref, { items, count: items.length, version, updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(doc(db, "meta", "catalog"), { version, count: items.length, updatedAt: serverTimestamp() }, { merge: true });
}

// Crea o actualiza un anime completo (con o sin episodios).
export async function saveAnime(anime) {
  if (!anime.id) anime.id = slugify(anime.title);
  if (!Array.isArray(anime.episodes)) anime.episodes = [];
  anime.episodesTotal = anime.episodes.length || anime.episodesTotal || 0;
  await setDoc(doc(db, "animes", anime.id), { ...anime, updatedAt: serverTimestamp() }, { merge: true });
  await upsertCatalogCard({ ...anime });
  return anime.id;
}

// Agrega uno o varios episodios a un anime existente (sin borrar los previos).
export async function addEpisodes(animeId, newEpisodes) {
  const ref = doc(db, "animes", animeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El anime no existe: " + animeId);
  const anime = snap.data();
  const episodes = Array.isArray(anime.episodes) ? anime.episodes : [];

  for (const ep of newEpisodes) {
    // Evita duplicar el mismo episodio (misma temporada + número).
    const dup = episodes.some(
      (e) => String(e.season) === String(ep.season) && Number(e.number) === Number(ep.number)
    );
    if (dup) throw new Error(`Ya existe ${ep.season} episodio ${ep.number}.`);
    episodes.push(ep);
  }

  const sorted = orderedEpisodes({ episodes });
  await updateDoc(ref, {
    episodes: sorted,
    episodesTotal: sorted.length,
    updatedAt: serverTimestamp(),
  });
  await upsertCatalogCard({ ...anime, episodes: sorted });
  return sorted.length;
}

// Elimina un anime del catálogo (documento + índice).
export async function deleteAnime(animeId) {
  await deleteDoc(doc(db, "animes", animeId));
  const ref = doc(db, "catalog", "index");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const items = (snap.data().items || []).filter((it) => it.id !== animeId);
    const version = Date.now();
    await setDoc(ref, { items, count: items.length, version, updatedAt: serverTimestamp() }, { merge: true });
    await setDoc(doc(db, "meta", "catalog"), { version, count: items.length, updatedAt: serverTimestamp() }, { merge: true });
  }
}

// Devuelve las temporadas existentes de un anime, ordenadas.
export async function getAnimeSeasons(animeId) {
  const anime = await getAnime(animeId);
  if (!anime || !Array.isArray(anime.episodes)) return [];
  const seen = new Map();
  for (const ep of anime.episodes) {
    if (!seen.has(ep.season)) seen.set(ep.season, seasonNumber(ep.season));
  }
  return [...seen.keys()].sort((a, b) => seen.get(a) - seen.get(b));
}

// Lista los episodios de una temporada concreta.
export async function listEpisodes(animeId, season) {
  const anime = await getAnime(animeId);
  if (!anime || !Array.isArray(anime.episodes)) return [];
  return orderedEpisodes(anime).filter((e) => e.season === season);
}

// Elimina un episodio (por temporada + número).
export async function deleteEpisode(animeId, season, number) {
  const ref = doc(db, "animes", animeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El anime no existe.");
  const anime = snap.data();
  const episodes = (anime.episodes || []).filter(
    (e) => !(e.season === season && Number(e.number) === Number(number))
  );
  await updateDoc(ref, { episodes, episodesTotal: episodes.length, updatedAt: serverTimestamp() });
  await upsertCatalogCard({ ...anime, episodes });
  return episodes.length;
}

// ---- Portada (hero) --------------------------------------------------------
export async function getHeroSlides() {
  const snap = await getDoc(doc(db, "config", "hero"));
  return snap.exists() && Array.isArray(snap.data().slides) ? snap.data().slides : [];
}
export async function saveHeroSlides(slides) {
  await setDoc(doc(db, "config", "hero"), { slides, updatedAt: serverTimestamp() }, { merge: true });
}

// Activa/desactiva una etiqueta (recomendado/doblaje/agregado) en un anime.
// Controla en qué carrusel del inicio aparece.
export async function setAnimeTag(animeId, tag, on) {
  const anime = await getAnime(animeId);
  if (!anime) throw new Error("El anime no existe: " + animeId);
  let tags = Array.isArray(anime.tags) ? [...anime.tags] : [];
  const has = tags.includes(tag);
  if (on && !has) tags.push(tag);
  if (!on && has) tags = tags.filter((t) => t !== tag);
  await saveAnime({ ...anime, tags });
  return tags;
}

// Construye un objeto anime a partir del formulario (mismos campos que database.js).
export function buildAnimeFromForm(f) {
  const splitList = (v) =>
    Array.isArray(v) ? v.filter(Boolean) : (v || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    id: f.id?.trim() || slugify(f.title),
    title: f.title.trim(),
    img: f.img?.trim() || "",
    heroImg: f.heroImg?.trim() || "",
    logoImg: f.logoImg?.trim() || "",
    imgMobile: f.imgMobile?.trim() || "",
    trailerUrl: f.trailerUrl?.trim() || "",
    description: f.description?.trim() || "",
    genres: splitList(f.genres),
    rating: parseFloat(f.rating) || 0,
    ratingCount: f.ratingCount?.trim() || "0",
    seasons: parseInt(f.seasons, 10) || 1,
    episodesTotal: parseInt(f.episodesTotal, 10) || 0,
    status: f.status?.trim() || "En emisión",
    year: parseInt(f.year, 10) || new Date().getFullYear(),
    type: f.type?.trim() || "TV",
    quality: f.quality?.trim() || "1080p",
    tags: splitList(f.tags),
    audio: f.audio?.trim() || "Sub",
    creator: f.creator?.trim() || "",
    contentWarning: f.contentWarning?.trim() || "+13",
    episodes: [],
  };
}

// Construye un episodio a partir del formulario (mismos campos que database.js).
export function buildEpisodeFromForm(f) {
  return {
    season: f.season?.trim() || "Temporada 1",
    number: parseInt(f.number, 10),
    title: f.title?.trim() || "",
    duration: f.duration?.trim() || "24 min",
    description: f.description?.trim() || "",
    img: f.img?.trim() || "",
    releaseDate: f.releaseDate?.trim() || "",
    language: f.language?.trim() || "Sub",
    videoUrl: f.videoUrl?.trim() || "",
  };
}
