// ============================================================================
//  ANALÍTICA DE TRÁFICO  —  All-Anime
//  Registra una visita por sesión y permite al admin ver el flujo de usuarios.
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import {
  doc, setDoc, collection, query, orderBy, limit, getDocs,
  getCountFromServer, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10); // YYYY-MM-DD

// Registra una visita (una vez por sesión de navegador).
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
  } catch (e) { /* la analítica no es crítica */ }
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
