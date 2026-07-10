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
  getDocs,
  collection,
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
// IMPORTANTE: al editar desde el formulario (que NO trae episodios) NO se debe
// pisar los episodios existentes. Si no vienen episodios, se omite el campo para
// que el merge de Firestore los conserve.
export async function saveAnime(anime) {
  if (!anime.id) anime.id = slugify(anime.title);
  const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
  const payload = { ...anime, updatedAt: serverTimestamp() };
  if (hasEpisodes) payload.episodesTotal = anime.episodes.length;
  else delete payload.episodes;                    // preserva los episodios existentes
  await setDoc(doc(db, "animes", anime.id), payload, { merge: true });
  // La tarjeta del catálogo necesita el conteo REAL de episodios.
  let cardAnime = anime;
  if (!hasEpisodes) {
    const snap = await getDoc(doc(db, "animes", anime.id));
    cardAnime = { ...anime, episodes: snap.exists() ? (snap.data().episodes || []) : [] };
  }
  await upsertCatalogCard(cardAnime);
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

// Importa episodios con UPSERT: ACTUALIZA los que ya existen (misma temporada +
// número) y AGREGA los nuevos. Al actualizar, los campos del import mandan, pero
// se PRESERVAN servers/videoUrl/img existentes si el import no trae valor (para
// no perder los servidores al reimportar una lista editada solo con títulos).
export async function importEpisodes(animeId, incoming) {
  const ref = doc(db, "animes", animeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El anime no existe: " + animeId);
  const anime = snap.data();
  const episodes = Array.isArray(anime.episodes) ? anime.episodes.slice() : [];
  const idx = new Map(episodes.map((e, i) => [String(e.season) + "::" + Number(e.number), i]));
  let added = 0, updated = 0;
  const seen = new Set();
  for (const imp of incoming) {
    const key = String(imp.season) + "::" + Number(imp.number);
    if (seen.has(key)) continue; seen.add(key);
    if (idx.has(key)) {
      const cur = episodes[idx.get(key)];
      const merged = { ...cur, ...imp };
      if (!(Array.isArray(imp.servers) && imp.servers.length)) merged.servers = cur.servers || [];
      if (!imp.videoUrl) merged.videoUrl = cur.videoUrl || "";
      if (!imp.img) merged.img = cur.img || "";
      // ¿de verdad cambió algo? (para el contador)
      if (JSON.stringify(merged) !== JSON.stringify(cur)) { episodes[idx.get(key)] = merged; updated++; }
    } else {
      episodes.push(imp);
      idx.set(key, episodes.length - 1);
      added++;
    }
  }
  const sorted = orderedEpisodes({ episodes });
  await updateDoc(ref, { episodes: sorted, episodesTotal: sorted.length, updatedAt: serverTimestamp() });
  await upsertCatalogCard({ ...anime, episodes: sorted });
  return { added, updated, total: sorted.length };
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

// Edita un episodio existente (identificado por su temporada + número originales).
export async function updateEpisode(animeId, origSeason, origNumber, newEp) {
  const ref = doc(db, "animes", animeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El anime no existe.");
  const anime = snap.data();
  const episodes = Array.isArray(anime.episodes) ? [...anime.episodes] : [];
  const idx = episodes.findIndex(
    (e) => String(e.season) === String(origSeason) && Number(e.number) === Number(origNumber)
  );
  if (idx < 0) throw new Error("No se encontró el episodio a editar.");
  // Si cambia temporada+número, evita chocar con otro episodio existente.
  const dup = episodes.some(
    (e, i) => i !== idx && String(e.season) === String(newEp.season) && Number(e.number) === Number(newEp.number)
  );
  if (dup) throw new Error(`Ya existe ${newEp.season} episodio ${newEp.number}.`);
  episodes[idx] = { ...episodes[idx], ...newEp };
  const sorted = orderedEpisodes({ episodes });
  await updateDoc(ref, { episodes: sorted, episodesTotal: sorted.length, updatedAt: serverTimestamp() });
  await upsertCatalogCard({ ...anime, episodes: sorted });
  return sorted.length;
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

// ---- Importar / Exportar animes (JSON) -------------------------------------
// Importa un anime desde un objeto JSON (misma estructura que database.js).
// Preserva TODOS los campos (fonImg, releaseTime, etc.).
export async function importAnime(obj) {
  if (!obj || typeof obj !== "object") throw new Error("JSON inválido.");
  if (!obj.title) throw new Error("El JSON debe incluir al menos 'title'.");
  if (!obj.id) obj.id = slugify(obj.title);
  if (!Array.isArray(obj.episodes)) obj.episodes = [];
  if (obj.episodesTotal == null) obj.episodesTotal = obj.episodes.length;
  await setDoc(doc(db, "animes", obj.id), { ...obj, updatedAt: serverTimestamp() }, { merge: true });
  await upsertCatalogCard({ ...obj });
  return obj.id;
}

// Importa uno o varios animes (acepta objeto o arreglo). Devuelve resumen.
export async function importAnimes(data) {
  const list = Array.isArray(data) ? data : [data];
  const ok = [], fail = [];
  for (const item of list) {
    try { ok.push(await importAnime(item)); }
    catch (e) { fail.push((item && item.title) || "desconocido"); }
  }
  return { ok, fail, total: list.length };
}

// Exporta todo el catálogo (con episodios) como arreglo de objetos.
export async function exportAllAnimes() {
  const snap = await getDocs(collection(db, "animes"));
  return snap.docs.map((d) => { const { updatedAt, ...rest } = d.data(); return rest; });
}

// ---- Portada (hero) --------------------------------------------------------
export async function getHeroSlides() {
  const snap = await getDoc(doc(db, "config", "hero"));
  return snap.exists() && Array.isArray(snap.data().slides) ? snap.data().slides : [];
}
export async function saveHeroSlides(slides) {
  await setDoc(doc(db, "config", "hero"), { slides, updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Notificaciones a usuarios (toast/banner en el sitio) -------------------
export async function sendNotification(n) {
  await setDoc(doc(db, "notifications", "current"), {
    id: Date.now(),                       // cada envío es único → se muestra una vez
    title: (n.title || "").trim(),
    message: (n.message || "").trim(),
    style: n.style || "info",             // info | success | warning | announce | new
    format: n.format || "toast",          // toast (esquina) | banner (superior)
    duration: Number(n.duration) || 6,    // segundos de auto-cierre
    active: true,
    createdAt: serverTimestamp(),
  });
}
export async function deactivateNotification() {
  await setDoc(doc(db, "notifications", "current"), { active: false }, { merge: true });
}
export async function getNotification() {
  const s = await getDoc(doc(db, "notifications", "current"));
  return s.exists() ? s.data() : null;
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
    altTitles: splitList(f.altTitles),
    img: f.img?.trim() || "",
    heroImg: f.heroImg?.trim() || "",
    fonImg: f.fonImg?.trim() || "",
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
    releaseTime: f.releaseTime?.trim() || "",
    language: f.language?.trim() || "Sub",
    videoUrl: f.videoUrl?.trim() || "",
  };
}
