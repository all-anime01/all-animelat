// ============================================================================
//  REACCIONES estilo Netflix  —  All-Anime
//  👎 No es para mí  ·  👍 Me gusta  ·  ❤️ Me encanta
//  Guarda la reacción del usuario (Firestore) y alimenta las recomendaciones.
// ============================================================================
import { getReaction, setReaction, isLoggedIn, userReady } from "./user-data.js";

const OPTS = [
  { v: "dislike", icon: "fa-thumbs-down", label: "No es para mí" },
  { v: "like",    icon: "fa-thumbs-up",   label: "Me gusta" },
  { v: "love",    icon: "fa-heart",       label: "Me encanta" },
];

function injectStyles() {
  if (document.getElementById("reactions-widget-styles")) return;
  const s = document.createElement("style");
  s.id = "reactions-widget-styles";
  s.textContent = `
  .rx{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0}
  .rx-label{font-size:1.3rem;color:#b9c0cc;font-weight:600}
  .rx-btns{display:inline-flex;align-items:center;gap:8px}
  .rx-btn{width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(255,255,255,.16);
    background:rgba(255,255,255,.05);color:#e7e9ee;font-size:1.45rem;cursor:pointer;display:inline-flex;
    align-items:center;justify-content:center;transition:transform .12s ease,background .15s ease,border-color .15s ease,color .15s ease}
  .rx-btn:hover{transform:translateY(-2px) scale(1.08);background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.4)}
  .rx-btn.on.rx-dislike{background:#3b4252;border-color:#8b93a6;color:#fff}
  .rx-btn.on.rx-like{background:#2563eb;border-color:#3b82f6;color:#fff;box-shadow:0 0 12px rgba(59,130,246,.45)}
  .rx-btn.on.rx-love{background:#e11d48;border-color:#ff3b63;color:#fff;box-shadow:0 0 12px rgba(225,29,72,.5)}
  .rx-btn.on{transform:scale(1.05)}
  .rx-tip{font-size:1.2rem;color:#9aa0aa;min-height:1.2em}
  .rx-tip:empty{display:none}
  .rx-tip a{color:#ff6b6b}
  @media (max-width:600px){ .rx{gap:9px} .rx-btn{width:38px;height:38px;font-size:1.35rem} }
  @media (prefers-reduced-motion:reduce){ .rx-btn{transition:background .15s ease} }`;
  document.head.appendChild(s);
}

// Monta el widget en `container` para `anime`. onChange(value|null) se llama al cambiar
// (para refrescar recomendaciones sin recargar).
export async function mountReactions(container, anime, onChange) {
  if (!container || !anime) return;
  injectStyles();
  container.innerHTML = `<div class="rx">
    <span class="rx-label">¿Qué te pareció?</span>
    <div class="rx-btns">${OPTS.map((o) =>
      `<button class="rx-btn rx-${o.v}" data-v="${o.v}" title="${o.label}" aria-label="${o.label}"><i class="fas ${o.icon}"></i></button>`).join("")}</div>
    <span class="rx-tip" id="rx-tip"></span>
  </div>`;
  const btns = [...container.querySelectorAll(".rx-btn")];
  const tip = container.querySelector("#rx-tip");
  const paint = (val) => btns.forEach((b) => b.classList.toggle("on", b.dataset.v === val));

  let current = null;
  try { current = await getReaction(anime.id); } catch {}
  paint(current);

  await userReady;
  if (!isLoggedIn()) {
    tip.innerHTML = `<a href="cuenta.html?redirect=${encodeURIComponent(location.pathname + location.search)}">Inicia sesión</a> para guardar tus gustos`;
    btns.forEach((b) => (b.disabled = true, b.style.opacity = ".6", b.style.cursor = "default"));
    return;
  }

  btns.forEach((b) => b.addEventListener("click", async () => {
    const v = b.dataset.v;
    const next = current === v ? null : v;   // volver a pulsar la activa = quitar
    paint(next); current = next;
    const o = OPTS.find((x) => x.v === v);
    tip.textContent = next ? `Guardado: ${o.label}` : "Reacción quitada";
    try {
      await setReaction(anime, next);
      if (typeof onChange === "function") onChange(next);
      setTimeout(() => { if (tip.textContent.startsWith("Guardado") || tip.textContent.startsWith("Reacción")) tip.textContent = next ? `✓ ${o.label}` : ""; }, 1600);
    } catch (err) {
      tip.textContent = "No se pudo guardar.";
    }
  }));
}
