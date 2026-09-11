// ============================================================================
//  EPISODIOS QUE AÚN NO SE HAN ESTRENADO  —  All-Anime
//  La lista de episodios se sube COMPLETA (cada uno con su fecha), así que un
//  episodio que todavía no se emite parecía disponible y al abrirlo solo daba
//  pantalla negra. Con el interruptor «Bloquear episodios no estrenados»
//  (admin → Control) esos episodios quedan bloqueados hasta que llega su fecha,
//  y se desbloquean solos: no hay que tocar nada el día del estreno.
//  Ejemplo: fumando-juntos-detras-del-super, con un episodio cada semana.
// ============================================================================
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// «Septiembre 17, 2026» (+ hora «19:00») → Date. Devuelve null si no hay fecha
// utilizable: sin fecha NUNCA se bloquea nada.
export function parseReleaseDate(dateString, timeString) {
  if (!dateString) return null;
  const hm = String(timeString || "00:00").split(":");
  const hh = parseInt(hm[0], 10) || 0, mm = parseInt(hm[1], 10) || 0;

  const p = String(dateString).replace(/,/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
  if (p.length === 3 && Object.prototype.hasOwnProperty.call(MESES, p[0])) {
    const d = new Date(parseInt(p[2], 10), MESES[p[0]], parseInt(p[1], 10), hh, mm);
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {   // «2026-09-17»: se interpreta en hora local, no en UTC (si no, se adelanta un día)
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3], hh, mm);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(dateString).split("/");
  if (s.length === 3) {
    let y = parseInt(s[2], 10);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(s[1], 10) - 1, parseInt(s[0], 10), hh, mm);
    return isNaN(d.getTime()) ? null : d;
  }
  const g = new Date(dateString);
  if (isNaN(g.getTime())) return null;
  g.setHours(hh, mm, 0, 0);
  return g;
}

// --- Interruptor (config/flags.lockUnaired) ---------------------------------
// Se guarda SOLO este flag en el navegador para que el primer pintado ya salga
// bien; el resto de flags (mantenimiento, banner) nunca se cachean.
const CACHE = "aa_lock_unaired";
let flags = {};
try { flags = { lockUnaired: localStorage.getItem(CACHE) === "1" }; } catch (e) { flags = {}; }

export function lockEnabled() { return !!flags.lockUnaired; }

export const flagsReady = (async () => {
  try {
    const snap = await getDoc(doc(db, "config", "flags"));
    flags = snap.exists() ? (snap.data() || {}) : {};
    try { localStorage.setItem(CACHE, flags.lockUnaired ? "1" : "0"); } catch (e) {}
  } catch (e) {
    console.warn("[unaired] no se pudo leer config/flags; se usa el último valor conocido", e);
  }
  return flags;
})();

// ¿Este episodio todavía no se ha estrenado? Con el interruptor apagado siempre
// devuelve false, así que el sitio se comporta exactamente como antes.
export function isUnaired(ep) {
  if (!ep || !flags.lockUnaired) return false;
  const d = parseReleaseDate(ep.releaseDate, ep.releaseTime);
  return !!d && d.getTime() > Date.now();
}

// «17 de septiembre» o «17 de septiembre a las 19:00»
export function whenText(ep) {
  const d = parseReleaseDate(ep && ep.releaseDate, ep && ep.releaseTime);
  if (!d) return "";
  let out;
  try { out = d.toLocaleDateString("es", { day: "numeric", month: "long" }); }
  catch (e) { out = (ep && ep.releaseDate) || ""; }
  const t = String((ep && ep.releaseTime) || "").trim();
  if (t && t !== "00:00") out += " a las " + t;
  return out;
}

// «en 3 días», «en 5 h», «en 20 min» — para el contador de la tarjeta.
export function countdownText(ep) {
  const d = parseReleaseDate(ep && ep.releaseDate, ep && ep.releaseTime);
  if (!d) return "";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return "en " + min + " min";
  const h = Math.round(min / 60);
  if (h < 24) return "en " + h + " h";
  const dd = Math.round(h / 24);
  return dd === 1 ? "mañana" : "en " + dd + " días";
}

// Estilos del candado (se inyectan una sola vez, no hace falta tocar el CSS).
export function injectLockStyles() {
  if (document.getElementById("aa-unaired-styles")) return;
  const s = document.createElement("style");
  s.id = "aa-unaired-styles";
  s.textContent = `
    .episode-detail-card.ep-locked > a { cursor: not-allowed; }
    .episode-detail-card.ep-locked .episode-img-container img { filter: grayscale(.85) brightness(.45); }
    .episode-detail-card.ep-locked .play-icon-overlay,
    .episode-detail-card.ep-locked .ep-hover { display: none !important; }
    .episode-detail-card.ep-locked .episode-card-title { opacity: .65; }
    .ep-lock-badge {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: .6rem; text-align: center;
      color: #fff; padding: 8px; pointer-events: none;
    }
    .ep-lock-badge i { font-size: 2.2rem; opacity: .9; }
    .ep-lock-when {
      font: 600 1.25rem/1.3 Roboto, sans-serif; background: rgba(0,0,0,.6);
      border-radius: 999px; padding: .4rem .9rem; backdrop-filter: blur(2px);
    }
    .ep-lock-count { font: 500 1.15rem/1.2 Roboto, sans-serif; opacity: .8; }
    .player-locked {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; text-align: center; color: #f0f0f0; padding: 28px 18px;
      font-family: Roboto, system-ui, sans-serif;
    }
    .player-locked .pl-ico { font-size: 40px; line-height: 1; }
    .player-locked .pl-t { font-weight: 700; font-size: 17px; }
    .player-locked .pl-d { color: #a0a0a0; font-size: 15px; }`;
  document.head.appendChild(s);
}

// Cartel para los reproductores (frame/player.html y frame/aatv.html).
export function lockedHtml(ep) {
  const when = whenText(ep);
  const cd = countdownText(ep);
  return `<div class="player-locked">
      <div class="pl-ico">🔒</div>
      <div class="pl-t">Este episodio aún no se ha estrenado</div>
      <div class="pl-d">${when ? "Disponible el " + when : "Sin fecha de estreno"}${cd ? " · " + cd : ""}</div>
    </div>`;
}
