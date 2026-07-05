// ============================================================================
//  WIDGET DE CALIFICACIÓN CON ESTRELLAS  —  All-Anime
//  Promedio dinámico = base del anime (rating/ratingCount) + votos nuevos.
// ============================================================================

import { getRatingState, setRating, isLoggedIn, userReady } from "./user-data.js";

function injectStyles() {
  if (document.getElementById("rating-widget-styles")) return;
  const s = document.createElement("style");
  s.id = "rating-widget-styles";
  s.textContent = `
  .rw{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:14px 0}
  .rw-stars{display:inline-flex;gap:5px;font-size:2.4rem;cursor:pointer}
  .rw-stars i{color:#4a4a4a;transition:transform .12s ease,color .12s ease}
  .rw-stars i.on{color:#ff3b3b;text-shadow:0 0 10px rgba(255,59,59,.45)}
  .rw-stars:not(.readonly) i:hover{transform:scale(1.22)}
  .rw-stars.readonly{cursor:default}
  .rw-info{font-size:1.5rem;color:#ccc}
  .rw-info b{color:#fff;font-size:1.9rem}
  .rw-hint{font-size:1.25rem;color:#999}
  .rw-hint a{color:#ff6b6b}
  .rw-saved{color:#ff3b3b;font-weight:700}
  .rw-thanks{color:#4ade80;font-weight:700}
  .rw-count{display:inline-block;font-weight:700;color:#fff}
  .rw-count.rw-flash{animation:rw-pop .6s ease}
  @keyframes rw-pop{0%{transform:scale(1)}40%{transform:scale(1.35);color:#ff5c5c}100%{transform:scale(1)}}`;
  document.head.appendChild(s);
}

/**
 * Monta el widget dentro de `container` para `anime` (usa su id, rating y ratingCount).
 */
export async function mountRatingWidget(container, anime) {
  if (!container || !anime) return;
  injectStyles();
  const animeId = anime.id;
  const seedAvg = Number(anime.rating) || 0;
  const seedCount = anime.ratingCount || 0;

  container.innerHTML = `<div class="rw">
    <div class="rw-stars" id="rw-stars">${[1,2,3,4,5].map((n)=>`<i class="fas fa-star" data-v="${n}"></i>`).join("")}</div>
    <div class="rw-info" id="rw-info">—</div>
    <div class="rw-hint" id="rw-hint"></div>
  </div>`;

  const starsEl = container.querySelector("#rw-stars");
  const infoEl = container.querySelector("#rw-info");
  const hintEl = container.querySelector("#rw-hint");
  const stars = [...starsEl.querySelectorAll("i")];
  const paint = (val) => stars.forEach((s) => s.classList.toggle("on", Number(s.dataset.v) <= Math.round(val)));

  let state = { avg: seedAvg, count: 0, mine: 0 };
  const renderInfo = (flash) => {
    infoEl.innerHTML = `<b>${state.avg.toFixed(1)}</b> / 5 · <span class="rw-count${flash ? " rw-flash" : ""}">${state.count.toLocaleString("es")}</span> voto${state.count === 1 ? "" : "s"}`;
    paint(state.mine || state.avg);
    hintEl.innerHTML = state.mine ? `<span class="rw-saved"><i class="fas fa-circle-check"></i> Tu voto: ${state.mine}★</span>` : "";
  };

  try { state = await getRatingState(animeId, seedAvg, seedCount); } catch {}
  renderInfo();

  await userReady;
  if (!isLoggedIn()) {
    starsEl.classList.add("readonly");
    hintEl.innerHTML = `<a href="cuenta.html?redirect=${encodeURIComponent(location.pathname + location.search)}">Inicia sesión</a> para calificar`;
    return;
  }

  stars.forEach((s) => {
    s.addEventListener("mouseenter", () => paint(Number(s.dataset.v)));
    s.addEventListener("click", async () => {
      const v = Number(s.dataset.v);
      paint(v);
      hintEl.innerHTML = "Guardando…";
      try {
        await setRating(animeId, v);
        state = await getRatingState(animeId, seedAvg, seedCount);
        renderInfo(true); // con animación en el contador
        hintEl.innerHTML = `<span class="rw-thanks">🎉 ¡Gracias por calificar! <b>Tu voto: ${v}★</b></span>`;
        setTimeout(() => { if (state.mine) hintEl.innerHTML = `<span class="rw-saved"><i class="fas fa-circle-check"></i> Tu voto: ${state.mine}★</span>`; }, 2500);
      } catch (err) {
        console.error(err);
        hintEl.innerHTML = `<span style="color:#ff6b6b">No se pudo guardar tu voto (${err.code || err.message}).</span>`;
      }
    });
  });
  starsEl.addEventListener("mouseleave", () => paint(state.mine || state.avg));
}
