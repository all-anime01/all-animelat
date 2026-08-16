// ============================================================================
//  ANALÍTICA DE TRÁFICO  —  All-Anime
//  Registra una visita por sesión y permite al admin ver el flujo de usuarios.
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs,
  getCountFromServer, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10); // YYYY-MM-DD

// Detecta el país del visitante (una vez por sesión) con un servicio geo-IP
// gratuito y sin clave. Best-effort: si falla, no pasa nada.
async function detectCountry() {
  try {
    const cached = sessionStorage.getItem("visitCountry");
    if (cached) return JSON.parse(cached);
    const r = await fetch("https://get.geojs.io/v1/ip/geo.json");
    const g = await r.json();
    const info = { code: (g.country_code || "").toUpperCase(), name: g.country || g.country_code || "" };
    if (info.code) sessionStorage.setItem("visitCountry", JSON.stringify(info));
    return info.code ? info : null;
  } catch (e) { return null; }
}

// Registra una visita (una vez por sesión de navegador) + el país de origen.
export async function logVisit() {
  if (!FIREBASE_CONFIGURED) return;
  try {
    if (sessionStorage.getItem("visitLogged")) return;
    sessionStorage.setItem("visitLogged", "1");
    const key = todayKey();
    await setDoc(
      doc(db, "stats_daily", key),
      { date: key, count: increment(1), updatedAt: serverTimestamp() },
      { merge: true }
    );
    // País del visitante (agregado en stats_country/all).
    const c = await detectCountry();
    if (c) {
      await setDoc(
        doc(db, "stats_country", "all"),
        { counts: { [c.code]: increment(1) }, names: { [c.code]: c.name }, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch (e) { /* la analítica no es crítica */ }
}

// Marca la ÚLTIMA VEZ que un usuario registrado visitó el sitio. Se llama al
// resolver la sesión; throttled a una vez por sesión de navegador para no
// escribir en cada navegación.
export async function touchLastVisit(uid) {
  if (!FIREBASE_CONFIGURED || !uid) return;
  try {
    if (sessionStorage.getItem("lastVisitLogged")) return;
    sessionStorage.setItem("lastVisitLogged", "1");
    await setDoc(doc(db, "users", uid), { lastVisit: serverTimestamp() }, { merge: true });
  } catch (e) { /* no crítico */ }
}

// Distribución de visitas por país (ordenada de mayor a menor).
export async function getCountryStats() {
  try {
    const snap = await getDoc(doc(db, "stats_country", "all"));
    if (!snap.exists()) return [];
    const d = snap.data(), counts = d.counts || {}, names = d.names || {};
    return Object.entries(counts)
      .map(([code, count]) => ({ code, name: names[code] || code, count }))
      .sort((a, b) => b.count - a.count);
  } catch (e) { return []; }
}

// Animes más vistos por la comunidad (por número de reproducciones).
export async function getTopAnimes(max = 10) {
  try {
    const q = query(collection(db, "animeStats"), orderBy("viewCount", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, viewCount: d.data().viewCount || 0 })).filter((x) => x.viewCount > 0);
  } catch (e) { return []; }
}

// Devuelve las visitas de los últimos `days` días (orden ascendente por fecha).
export async function getDailyVisits(days = 30) {
  const q = query(collection(db, "stats_daily"), orderBy("date", "desc"), limit(days));
  const snap = await getDocs(q);
  const map = new Map(snap.docs.map((d) => [d.id, d.data().count || 0]));
  // Rellena los días sin visitas con 0 para una gráfica continua.
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    out.push({ date: key, count: map.get(key) || 0 });
  }
  return out;
}

// Número total de usuarios registrados (consulta de agregación: 1 lectura).
export async function getUserCount() {
  try {
    const snap = await getCountFromServer(collection(db, "users"));
    return snap.data().count;
  } catch (e) { return null; }
}

// Lista de usuarios registrados CON SUS DATOS (para el panel admin).
// Ordena por fecha de alta (más recientes primero); si algún doc no tiene
// createdAt, cae a una lectura sin orden para no perder usuarios.
export async function getUsers(max = 500) {
  const toDate = (v) => (v && typeof v.toDate === "function" ? v.toDate() : null);
  const shape = (d) => {
    const u = d.data();
    return { uid: d.id, email: u.email || "", displayName: u.displayName || "", role: u.role || "user", photoURL: u.photoURL || "", adFree: !!u.adFree, createdAt: toDate(u.createdAt), lastVisit: toDate(u.lastVisit) };
  };
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(shape);
  } catch (e) {
    try {
      const snap = await getDocs(query(collection(db, "users"), limit(max)));
      return snap.docs.map(shape).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    } catch (e2) { return []; }
  }
}

// Episodios más vistos por la comunidad (episodeStats.viewCount).
export async function getTopEpisodes(max = 10) {
  try {
    const q = query(collection(db, "episodeStats"), orderBy("viewCount", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => { const s = d.data(); return { id: d.id, viewCount: s.viewCount || 0, animeId: s.animeId || "", animeTitle: s.animeTitle || "", season: s.season || "", number: s.number, title: s.title || "", img: s.img || "" }; })
      .filter((x) => x.viewCount > 0);
  } catch (e) { return []; }
}
