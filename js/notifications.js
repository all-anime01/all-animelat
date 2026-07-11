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

// Renderiza un toast (esquina), banner (franja superior) o tarjeta de anime.
export function showNotification(n) {
  const style = ICONS[n.style] ? n.style : "info";
  const format = n.format === "banner" ? "banner" : n.format === "card" ? "card" : "toast";
  // Duración en segundos. 0 (o negativo) = fija: NO se auto-cierra (útil para
  // tarjetas de anuncio con botón). Sin valor → 6.
  const dur = Number.isFinite(+n.duration) ? Math.max(0, +n.duration) : 6;

  ensureStyles();
  const el = document.createElement("div");
  el.className = `an-notif an-notif-${format} an-notif-${style}`;
  el.setAttribute("role", "status");
  if (format === "card") {
    const bg = String(n.bgImage || n.poster || "").replace(/["'\\]/g, "");
    el.innerHTML = `
      ${bg ? `<div class="an-notif-bg" style="background-image:url('${bg}')"></div>` : ""}
      <button class="an-notif-x" aria-label="Cerrar">&times;</button>
      <div class="an-notif-card-in">
        ${n.poster ? `<img class="an-notif-poster" src="${esc(n.poster)}" alt="" onerror="this.style.display='none'">` : ""}
        <div class="an-notif-card-txt">
          <span class="an-notif-kicker"><i class="fas ${ICONS[style]}"></i>${n.title ? " " + esc(n.title) : ""}</span>
          ${n.animeTitle ? `<strong class="an-notif-anime">${esc(n.animeTitle)}</strong>` : ""}
          <span class="an-notif-msg">${esc(n.message)}</span>
          ${n.ctaText && n.ctaUrl ? `<a class="an-notif-cta" href="${esc(n.ctaUrl)}">${esc(n.ctaText)} <i class="fas fa-arrow-right"></i></a>` : ""}
        </div>
      </div>
      <span class="an-notif-bar"></span>`;
  } else {
    el.innerHTML = `
    <i class="fas ${ICONS[style]} an-notif-ic" aria-hidden="true"></i>
    <div class="an-notif-body">${n.title ? `<strong class="an-notif-title">${esc(n.title)}</strong>` : ""}<span>${esc(n.message)}</span></div>
    <button class="an-notif-x" aria-label="Cerrar">&times;</button>
    <span class="an-notif-bar"></span>`;
  }
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
  .an-notif-toast,.an-notif-banner{border-left:3px solid var(--ac,#3b9dff)}
  /* tarjeta de anime: anuncio llamativo con poster + fondo */
  .an-notif-card{right:20px;bottom:20px;max-width:380px;width:calc(100% - 40px);padding:0;border-radius:16px;
    transform:translateY(16px) scale(.98);color:#fff;border-color:rgba(255,255,255,.12)}
  .an-notif-card.show{opacity:1;transform:translateY(0) scale(1);transition:opacity .35s ease,transform .35s ease}
  .an-notif-card .an-notif-bg{position:absolute;inset:0;background-size:cover;background-position:center;z-index:0}
  .an-notif-card .an-notif-bg::after{content:"";position:absolute;inset:0;
    background:linear-gradient(120deg,rgba(10,12,16,.93) 0%,rgba(10,12,16,.72) 55%,rgba(10,12,16,.48) 100%)}
  .an-notif-card .an-notif-card-in{position:relative;z-index:1;display:flex;gap:14px;padding:16px 16px 18px}
  .an-notif-card .an-notif-poster{width:62px;height:90px;border-radius:10px;object-fit:cover;flex-shrink:0;
    box-shadow:0 8px 20px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14)}
  .an-notif-card .an-notif-card-txt{display:flex;flex-direction:column;gap:5px;min-width:0}
  .an-notif-card .an-notif-kicker{font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--ac,#3b9dff)}
  .an-notif-card .an-notif-anime{font-size:17px;font-weight:800;line-height:1.15}
  .an-notif-card .an-notif-msg{font-size:13px;color:#d7dbe2;line-height:1.35}
  .an-notif-card .an-notif-cta{align-self:flex-start;margin-top:4px;display:inline-flex;align-items:center;gap:6px;
    background:var(--ac,#3b9dff);color:#fff;font-size:12.5px;font-weight:700;text-decoration:none;padding:7px 13px;border-radius:20px}
  .an-notif-card .an-notif-cta:hover{filter:brightness(1.1)}
  .an-notif-card .an-notif-x{position:absolute;top:8px;right:10px;z-index:2;color:#fff}
  .an-notif-card .an-notif-bar{color:var(--ac,#3b9dff);opacity:.85}
  @media (max-width:520px){ .an-notif-toast,.an-notif-card{right:10px;left:10px;bottom:10px;max-width:none;width:auto} }
  @media (prefers-reduced-motion:reduce){ .an-notif,.an-notif.show{transition:opacity .2s ease} }
  `;
  document.head.appendChild(css);
}
