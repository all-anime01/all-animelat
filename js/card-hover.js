// ============================================================================
//  HOVER ESTILO NETFLIX EN LAS TARJETAS DE ANIME  —  All-Anime
//  Al pasar el cursor sobre una tarjeta, tras un breve retardo se despliega un
//  panel flotante (ampliado) que reproduce el tráiler en silencio con el logo
//  del anime superpuesto, más un botón "Ver ahora" e info rápida.
//  Usa un panel flotante en position:fixed para no recortarse dentro de los
//  carruseles (overflow:hidden). En dispositivos táctiles se desactiva.
// ============================================================================

let hoverTimer = null, closeTimer = null, pv = null, activeCard = null;

const ytId = (u) => {
  const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

function mediaHtml(card) {
  const { video, trailer, img } = card.dataset;
  // En TV: preview LIGERO = solo imagen (nada de iframe de tráiler). El iframe pesaba,
  // trababa la navegación y a veces "atrapaba" la entrada. Escritorio sí usa tráiler.
  if (document.documentElement.classList.contains("aa-tv")) {
    return `<img class="cardpv-media vid" src="${img || ""}" alt="">`;
  }
  // tabindex="-1" + pointer-events(CSS) → el tráiler NO captura el D-pad ni el foco,
  // así en TV se puede seguir navegando y OK entra al anime (no lo bloquea el video).
  if (video) {
    return `<video class="cardpv-media vid" tabindex="-1" autoplay muted loop playsinline poster="${img || ""}"><source src="${video}"></video>`;
  }
  const id = ytId(trailer);
  if (id) {
    // controls=0 + sin interacción (pointer-events) + recorte por CSS → sin
    // título, botones ni marca de YouTube.
    const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`;
    return `<iframe class="cardpv-media yt" tabindex="-1" src="${src}" allow="autoplay; encrypted-media" frameborder="0" scrolling="no"></iframe>`;
  }
  return `<img class="cardpv-media vid" src="${img || ""}" alt="">`;
}

function removePreview() {
  clearTimeout(closeTimer); closeTimer = null;
  if (activeCard) activeCard.removeEventListener("mouseleave", onCardLeave);
  if (pv) { pv.remove(); pv = null; }
  activeCard = null;
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
  // Altura que cubre toda la tarjeta (el tráiler 16:9 arriba y la info debajo
  // se estiran para tapar el póster por completo).
  const mediaH = pw * 9 / 16;
  const coverH = Math.max(r.height + 30, mediaH + 96);

  pv = document.createElement("div");
  pv.className = "card-preview";
  pv.style.cssText = `left:${left}px;top:${top}px;width:${pw}px;height:${coverH}px;`;
  const logo = card.dataset.logo;
  pv.innerHTML = `
    <a class="cardpv-media-wrap" href="${card.dataset.href}" aria-label="${card.dataset.title || ""}">
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
  requestAnimationFrame(() => pv.classList.add("show"));

  pv.addEventListener("mouseenter", () => clearTimeout(closeTimer));
  pv.addEventListener("mouseleave", removePreview);
  card.addEventListener("mouseleave", onCardLeave);
}

export function initCardHover() {
  // Modo TV (D-pad, sin puntero real): tv-nav.js llama estas funciones al enfocar
  // o salir de una tarjeta, para mostrar/ocultar la vista previa igual que en PC.
  window.__aaCardPreview = (card) => {
    if (!card || card === activeCard) return;
    if (!card.dataset.trailer && !card.dataset.video) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showPreview(card), 420);
  };
  window.__aaCardPreviewClose = () => { clearTimeout(hoverTimer); removePreview(); };

  // Con puntero real (escritorio) se activa por hover automático. En táctil no.
  if (window.matchMedia("(hover: none)").matches && !document.documentElement.classList.contains("aa-tv")) return;
  if (window.matchMedia("(hover: none)").matches && document.documentElement.classList.contains("aa-tv")) return; // en TV lo dispara tv-nav, no el puntero

  document.addEventListener("pointerover", (e) => {
    const card = e.target.closest(".anime-card");
    if (!card || card === activeCard) return;
    if (!card.dataset.trailer && !card.dataset.video) return; // sin tráiler, sin preview
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showPreview(card), 550);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(".anime-card")) clearTimeout(hoverTimer);
  });
  window.addEventListener("scroll", removePreview, { passive: true });
  window.addEventListener("resize", removePreview, { passive: true });
}
