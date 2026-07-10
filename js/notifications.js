// ============================================================================
//  NOTIFICACIONES A USUARIOS  —  All-Anime
//  El admin publica una notificación en Firestore (notifications/current) y los
//  usuarios la ven como un toast/banner discreto, con estilo elegible y
//  auto-cierre. Se muestra UNA vez por id (se recuerda en localStorage).
// ============================================================================
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SEEN_KEY = "allanime-notif-seen";

const ICONS = {
  info: "fa-circle-info",
  success: "fa-circle-check",
  warning: "fa-triangle-exclamation",
  announce: "fa-bullhorn",
  new: "fa-star",
};

export async function initNotifications() {
  try {
    const snap = await getDoc(doc(db, "notifications", "current"));
    if (!snap.exists()) return;
    const n = snap.data();
    if (!n.active || !n.message) return;
    if (String(n.id) === localStorage.getItem(SEEN_KEY)) return;   // ya la vio
    // pequeño delay para no competir con la carga inicial
    setTimeout(() => showNotification(n), 1200);
    localStorage.setItem(SEEN_KEY, String(n.id));
  } catch (e) { /* silencioso: nunca romper la página por una notificación */ }
}

// Renderiza un toast (esquina, discreto) o banner (franja superior).
export function showNotification(n) {
  const style = ICONS[n.style] ? n.style : "info";
  const format = n.format === "banner" ? "banner" : "toast";
  const dur = Number.isFinite(+n.duration) && +n.duration > 0 ? +n.duration : 6;   // seg; 0/none → 6

  ensureStyles();
  const el = document.createElement("div");
  el.className = `an-notif an-notif-${format} an-notif-${style}`;
  el.setAttribute("role", "status");
  el.innerHTML = `
    <i class="fas ${ICONS[style]} an-notif-ic" aria-hidden="true"></i>
    <div class="an-notif-body">${n.title ? `<strong class="an-notif-title">${esc(n.title)}</strong>` : ""}<span>${esc(n.message)}</span></div>
    <button class="an-notif-x" aria-label="Cerrar">&times;</button>
    <span class="an-notif-bar"></span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  const bar = el.querySelector(".an-notif-bar");
  if (bar && dur > 0) { bar.style.transition = `width ${dur}s linear`; requestAnimationFrame(() => (bar.style.width = "0%")); }

  let timer = dur > 0 ? setTimeout(close, dur * 1000) : null;
  function close() { clearTimeout(timer); el.classList.remove("show"); setTimeout(() => el.remove(), 350); }
  el.querySelector(".an-notif-x").addEventListener("click", close);
  // pausar el auto-cierre al pasar el cursor
  el.addEventListener("mouseenter", () => { clearTimeout(timer); if (bar) bar.style.animationPlayState = "paused", bar.style.transition = "none"; });
  el.addEventListener("mouseleave", () => { if (dur > 0) timer = setTimeout(close, 2500); });
  return close;
}

function esc(s) { const d = document.createElement("div"); d.textContent = String(s ?? ""); return d.innerHTML; }

function ensureStyles() {
  if (document.getElementById("an-notif-styles")) return;
  const css = document.createElement("style");
  css.id = "an-notif-styles";
  css.textContent = `
  .an-notif{position:fixed;z-index:99999;display:flex;align-items:flex-start;gap:12px;
    background:#16181d;color:#f2f3f5;border:1px solid rgba(255,255,255,.09);
    box-shadow:0 12px 34px rgba(0,0,0,.5);overflow:hidden;opacity:0;pointer-events:auto;
    font-size:14px;line-height:1.4;}
  .an-notif .an-notif-ic{font-size:19px;margin-top:1px;flex-shrink:0}
  .an-notif .an-notif-body{display:flex;flex-direction:column;gap:2px}
  .an-notif .an-notif-title{font-size:14.5px;font-weight:800}
  .an-notif .an-notif-x{background:none;border:none;color:#aab;font-size:20px;line-height:1;
    cursor:pointer;padding:0 2px;flex-shrink:0;opacity:.7}
  .an-notif .an-notif-x:hover{opacity:1}
  .an-notif .an-notif-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:currentColor;opacity:.5}
  /* toast: esquina inferior derecha, compacto (no intrusivo) */
  .an-notif-toast{right:20px;bottom:20px;max-width:360px;padding:14px 14px 15px;border-radius:12px;
    transform:translateY(16px) scale(.98)}
  .an-notif-toast.show{opacity:1;transform:translateY(0) scale(1);transition:opacity .3s ease,transform .3s ease}
  /* banner: franja superior centrada */
  .an-notif-banner{top:0;left:50%;transform:translate(-50%,-100%);max-width:680px;width:calc(100% - 24px);
    padding:12px 16px;border-radius:0 0 12px 12px;align-items:center}
  .an-notif-banner.show{opacity:1;transform:translate(-50%,0);transition:opacity .3s ease,transform .35s ease}
  /* estilos por tipo (color de acento en icono + barra) */
  .an-notif-info{--ac:#3b9dff}       .an-notif-success{--ac:#22c55e}
  .an-notif-warning{--ac:#f5a524}    .an-notif-announce{--ac:#a855f7}
  .an-notif-new{--ac:#ff4d6d}
  .an-notif-info .an-notif-ic,.an-notif-info .an-notif-bar{color:#3b9dff}
  .an-notif-success .an-notif-ic,.an-notif-success .an-notif-bar{color:#22c55e}
  .an-notif-warning .an-notif-ic,.an-notif-warning .an-notif-bar{color:#f5a524}
  .an-notif-announce .an-notif-ic,.an-notif-announce .an-notif-bar{color:#a855f7}
  .an-notif-new .an-notif-ic,.an-notif-new .an-notif-bar{color:#ff4d6d}
  .an-notif{border-left:3px solid var(--ac,#3b9dff)}
  @media (max-width:520px){ .an-notif-toast{right:10px;left:10px;bottom:10px;max-width:none} }
  @media (prefers-reduced-motion:reduce){ .an-notif,.an-notif.show{transition:opacity .2s ease} }
  `;
  document.head.appendChild(css);
}
