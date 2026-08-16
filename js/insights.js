// ============================================================================
//  INSIGHTS / CONTROL PROPIO — All-Anime
//  Herramientas nativas (datos en tu Firestore, sin SaaS externos):
//   1) Analítica: registra búsquedas y tipo de dispositivo.
//   2) Errores: registra errores JS del cliente (tipo Sentry propio).
//   3) Flags/mantenimiento: aplica modo mantenimiento y banner global.
//  El panel admin lee/gestiona todo esto en sus pestañas Métricas/Errores/
//  Control/Moderación.
// ============================================================================
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Dispositivo (una vez por sesión) --------------------------------------
export async function recordDevice() {
  try {
    if (sessionStorage.getItem("aa_devrec")) return;
    sessionStorage.setItem("aa_devrec", "1");
    const ua = navigator.userAgent || "";
    const kind = /AFT[A-Z0-9]|Fire\s?TV|Silk|SmartTV|Tizen|Web0S|WebOS|GoogleTV|AllAnimeTV/i.test(ua)
      ? "tv" : /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
    await setDoc(doc(db, "device_stats", kind), { count: increment(1), label: kind, updatedAt: serverTimestamp() }, { merge: true });
  } catch {}
}

// --- Búsquedas -------------------------------------------------------------
export async function recordSearch(q) {
  try {
    const term = (q || "").trim().toLowerCase();
    if (term.length < 3) return;
    const id = term.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "_").slice(0, 60);
    if (!id) return;
    await setDoc(doc(db, "search_stats", id), { term, count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  } catch {}
}

// --- Errores del cliente (máx 8 por sesión, para no inundar) ----------------
let errCount = 0;
const seen = new Set();
export async function recordError(err) {
  try {
    const msg = (err && err.message) || String(err || "error");
    if (seen.has(msg) || errCount >= 8) return;
    seen.add(msg); errCount++;
    await addDoc(collection(db, "errorLogs"), {
      message: String(msg).slice(0, 500),
      stack: String((err && err.stack) || "").slice(0, 2000),
      page: location.pathname + location.search,
      ua: (navigator.userAgent || "").slice(0, 220),
      at: serverTimestamp(),
    });
  } catch {}
}

// --- Flags / mantenimiento / banner ----------------------------------------
let flags = null;
export function getFlags() { return flags; }

function showBanner(text, type) {
  if (document.getElementById("aa-flag-banner")) return;
  const b = document.createElement("div");
  b.id = "aa-flag-banner";
  const bg = type === "warn" ? "#b45309" : type === "danger" ? "#b91c1c" : "#1f6feb";
  b.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9000;background:${bg};color:#fff;font:600 14px/1.4 Roboto,sans-serif;padding:10px 44px 10px 16px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.4)`;
  b.innerHTML = `${text}<span style="position:absolute;right:14px;top:8px;cursor:pointer;font-size:20px" title="Cerrar">&times;</span>`;
  b.querySelector("span").addEventListener("click", () => b.remove());
  const mount = () => document.body && document.body.prepend(b);
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
}

function showMaintenance(msg) {
  const html = `
    <div style="position:fixed;inset:0;z-index:100000;background:#0d1117;color:#f0f0f0;display:flex;flex-direction:column;
                align-items:center;justify-content:center;text-align:center;padding:24px;font-family:Roboto,sans-serif">
      <div style="font-size:64px;margin-bottom:10px">🛠️</div>
      <h1 style="font-family:Poppins,sans-serif;font-size:clamp(22px,5vw,34px);margin:0 0 12px">Estamos en mantenimiento</h1>
      <p style="max-width:520px;color:#a0a0a0;font-size:clamp(14px,3.4vw,17px)">${msg}</p>
    </div>`;
  const apply = () => { document.body.innerHTML = html; document.body.style.overflow = "hidden"; };
  if (document.body) apply(); else document.addEventListener("DOMContentLoaded", apply);
}

// Devuelve {maintenance:true} si bloqueó la página (para que main-2025 pare).
export async function applyFlags(isAdmin) {
  try { const s = await getDoc(doc(db, "config", "flags")); flags = s.exists() ? (s.data() || {}) : {}; }
  catch { flags = {}; }
  if (flags.bannerOn && flags.bannerText) showBanner(flags.bannerText, flags.bannerType);
  if (flags.maintenance && !isAdmin) { showMaintenance(flags.maintenanceMsg || "Volvemos muy pronto. Gracias por tu paciencia."); return { maintenance: true }; }
  return flags;
}
