// ============================================================================
//  WIDGET DE CALIFICACIÓN CON ESTRELLAS  —  All-Anime
//  Promedio dinámico (entre todos) + calificación personal del usuario.
// ============================================================================

import { getRatingState, setRating, isLoggedIn, userReady } from "./user-data.js";

function injectStyles() {
  if (document.getElementById("rating-widget-styles")) return;
  const s = document.createElement("style");
  s.id = "rating-widget-styles";
  s.textContent = `
  .rw{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:14px 0}
  .rw-stars{display:inline-flex;gap:4px;font-size:2.2rem;cursor:pointer}
  .rw-stars i{color:#555;transition:.1s}
  .rw-stars i.on{color:#ffc107}
  .rw-stars.readonly{cursor:default}
  .rw-info{font-size:1.4rem;color:#ccc}
  .rw-info b{color:#fff;font-size:1.7rem}
  .rw-hint{font-size:1.2rem;color:#999}
  .rw-hint a{color:#ff6b6b}`;
  document.head.appendChild(s);
}

/**
 * Monta el widget dentro de `container` para el anime `animeId`.
 */
export async function mountRatingWidget(container, animeId) {
  if (!container) return;
  injectStyles();
  container.innerHTML = `<div class="rw">
    <div class="rw-stars" id="rw-stars">${[1,2,3,4,5].map((n)=>`<i class="fas fa-star" data-v="${n}"></i>`).join("")}</div>
    <div class="rw-info" id="rw-info">—</div>
    <div class="rw-hint" id="rw-hint"></div>
  </div>`;

  const starsEl = container.querySelector("#rw-stars");
  const infoEl = container.querySelector("#rw-info");
  const hintEl = container.querySelector("#rw-hint");
  const stars = [...starsEl.querySelectorAll("i")];

  const paint = (val) => stars.forEach((s) => s.classList.toggle("on", Number(s.dataset.v) <= val));

  let state = { avg: 0, count: 0, mine: 0 };
  const renderInfo = () => {
    infoEl.innerHTML = state.count
      ? `<b>${state.avg.toFixed(1)}</b> / 5 · ${state.count} voto${state.count === 1 ? "" : "s"}`
      : "Aún sin calificaciones";
    paint(state.mine || Math.round(state.avg));
    hintEl.innerHTML = state.mine ? `Tu voto: ${state.mine}★` : "";
  };

  try { state = await getRatingState(animeId); } catch {}
  renderInfo();

  await userReady;
  if (!isLoggedIn()) {
    starsEl.classList.add("readonly");
    hintEl.innerHTML = `<a href="cuenta.html?redirect=${encodeURIComponent(location.pathname + location.search)}">Inicia sesión</a> para calificar`;
    return;
  }

  // Interactivo
  stars.forEach((s) => {
    s.addEventListener("mouseenter", () => paint(Number(s.dataset.v)));
    s.addEventListener("click", async () => {
      const v = Number(s.dataset.v);
      paint(v);
      try { state = await setRating(animeId, v); renderInfo(); }
      catch (err) { console.error(err); }
    });
  });
  starsEl.addEventListener("mouseleave", () => paint(state.mine || Math.round(state.avg)));
}
