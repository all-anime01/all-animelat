// ============================================================================
//  HOVER ESTILO NETFLIX EN LAS TARJETAS DE ANIME  —  All-Anime
//  Al pasar el cursor sobre una tarjeta, tras un breve retardo se despliega un
//  panel flotante (ampliado) que reproduce el tráiler en silencio con el logo
//  del anime superpuesto, más un botón "Ver ahora" e info rápida.
//  Usa un panel flotante en position:fixed para no recortarse dentro de los
//  carruseles (overflow:hidden). En dispositivos táctiles se desactiva.
//
//  Animación: el panel NACE de la tarjeta (crece desde su centro) y al salir
//  vuelve a encogerse sobre ella mientras se desvanece, en vez de desaparecer de
//  golpe. Mientras se cierra, otra tarjeta ya puede abrir el suyo.
// ============================================================================

let hoverTimer = null, closeTimer = null, pv = null, activeCard = null;
const CLOSE_MS = 380;

const ytId = (u) => {
  const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

function mediaHtml(card) {
  const { video, trailer } = card.dataset;
  // En TV: preview LIGERO = solo imagen (nada de iframe de tráiler). El iframe pesaba,
  // trababa la navegación y a veces "atrapaba" la entrada. Escritorio sí usa tráiler.
  if (document.documentElement.classList.contains("aa-tv")) return "";
  // tabindex="-1" + pointer-events(CSS) → el tráiler NO captura el D-pad ni el foco.
  if (video) {
    return `<video class="cardpv-media vid cardpv-live" tabindex="-1" autoplay muted loop playsinline><source src="${video}"></video>`;
  }
  const id = ytId(trailer);
  if (id) {
    // controls=0 + sin interacción (pointer-events) + recorte por CSS → sin
    // título, botones ni marca de YouTube.
    const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`;
    return `<iframe class="cardpv-media yt cardpv-live" tabindex="-1" src="${src}" allow="autoplay; encrypted-media" frameborder="0" scrolling="no"></iframe>`;
  }
  return "";
}

// El vídeo no aparece de golpe: primero se ve la imagen de fondo y, cuando el
// vídeo de verdad está reproduciéndose, entra con un fundido (YouTube enseña
// negro y su marca los primeros instantes, por eso espera un poco más).
function fadeInWhenReady(panel) {
  const live = panel.querySelector(".cardpv-live");
  if (!live) return;
  const show = () => { if (panel.isConnected && !panel.classList.contains("closing")) live.classList.add("on"); };
  if (live.tagName === "VIDEO") live.addEventListener("playing", show, { once: true });
  else live.addEventListener("load", () => setTimeout(show, 900), { once: true });
}

// Cierra el panel actual animándolo de vuelta a su tarjeta. El panel se suelta
// enseguida (pv = null) para que otra tarjeta pueda abrir el suyo sin esperar.
function removePreview(instant) {
  clearTimeout(closeTimer); closeTimer = null;
  if (activeCard) activeCard.removeEventListener("mouseleave", onCardLeave);
  const el = pv;
  pv = null; activeCard = null;
  if (!el) return;
  if (instant === true || !el._from) { el.remove(); return; }
  el.classList.add("closing");
  el.classList.remove("show");
  el.style.transform = el._from;
  el.style.opacity = "0";
  const done = () => el.remove();
  el.addEventListener("transitionend", (e) => { if (e.target === el && e.propertyName === "transform") done(); });
  setTimeout(done, CLOSE_MS + 120);
}
function onCardLeave() { closeTimer = setTimeout(removePreview, 160); }

function showPreview(card) {
  removePreview();
  activeCard = card;
  // Panel ampliado y expandido en horizontal (más ancho que la tarjeta), estilo
  // Netflix: tráiler 16:9 con el logo + info debajo. Centrado sobre la tarjeta.
  const r = card.getBoundingClientRect();
  const pw = Math.min(Math.max(r.width * 1.8, 300), 400);
  const cx = r.left + r.width / 2;
  const left = Math.max(8, Math.min(cx - pw / 2, window.innerWidth - pw - 8));
  const top = Math.max(8, r.top - 22);
  const mediaH = pw * 9 / 16;
  const coverH = Math.max(r.height + 30, mediaH + 96);

  pv = document.createElement("div");
  pv.className = "card-preview";
  // Crece desde el centro de la tarjeta y empieza del tamaño de la tarjeta.
  const ox = cx - left, oy = r.top + r.height / 2 - top;
  const s0 = Math.max(0.35, Math.min(1, r.width / pw));
  pv._from = `scale(${s0.toFixed(3)})`;
  pv.style.cssText = `left:${left}px;top:${top}px;width:${pw}px;height:${coverH}px;` +
    `transform-origin:${ox}px ${oy}px;transform:${pv._from};opacity:0;`;
  const { logo, fondo, img } = card.dataset;
  const quieto = fondo || img || "";
  pv.innerHTML = `
    <a class="cardpv-media-wrap" href="${card.dataset.href}" aria-label="${card.dataset.title || ""}">
      <img class="cardpv-media vid cardpv-still" src="${quieto}" alt="">
      ${mediaHtml(card)}
      <div class="cardpv-catch"></div>
      <div class="cardpv-grad"></div>
      ${logo
        ? `<img class="cardpv-logo" src="${logo}" alt="${card.dataset.title || ""}">`
        : `<div class="cardpv-title">${card.dataset.title || ""}</div>`}
    </a>
    <div class="cardpv-info">
      <a class="cardpv-play" href="${card.dataset.href}"><i class="fas fa-play"></i> Ver ahora</a>
      <div class="cardpv-meta">${card.dataset.meta || ""}</div>
      ${card.dataset.genres ? `<div class="cardpv-genres">${card.dataset.genres}</div>` : ""}
    </div>`;
  document.body.appendChild(pv);
  fadeInWhenReady(pv);
  const el = pv;
  // Doble rAF: asegura que el navegador pinte el estado inicial antes de animar.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (el !== pv) return;
    el.classList.add("show");
    el.style.transform = "scale(1)";
    el.style.opacity = "1";
  }));

  pv.addEventListener("mouseenter", () => clearTimeout(closeTimer));
  pv.addEventListener("mouseleave", () => { if (el === pv) removePreview(); });
  card.addEventListener("mouseleave", onCardLeave);
}

export function initCardHover() {
  // Modo TV (D-pad, sin puntero real): tv-nav.js llama estas funciones al enfocar
  // o salir de una tarjeta, para mostrar/ocultar la vista previa igual que en PC.
  window.__aaCardPreview = (card) => {
    if (!card || card === activeCard) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showPreview(card), 420);
  };
  window.__aaCardPreviewClose = () => { clearTimeout(hoverTimer); removePreview(); };

  // Con puntero real (escritorio) se activa por hover automático. En táctil no.
  if (window.matchMedia("(hover: none)").matches) return; // en TV lo dispara tv-nav, no el puntero

  document.addEventListener("pointerover", (e) => {
    const card = e.target.closest(".anime-card");
    if (!card || card === activeCard) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showPreview(card), 550);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(".anime-card")) clearTimeout(hoverTimer);
  });
  // Al hacer scroll el panel se queda fuera de sitio: se cierra rápido (sin rebote).
  window.addEventListener("scroll", () => { clearTimeout(hoverTimer); removePreview(); }, { passive: true });
  window.addEventListener("resize", () => removePreview(true), { passive: true });
}
