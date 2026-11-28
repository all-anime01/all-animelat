// ============================================================================
//  FILAS ESTILO PRIME VIDEO  —  All-Anime
//  «Doblajes de la Temporada» y «Los favoritos del público».
//
//  Al dejar el cursor sobre un póster, la tarjeta se ABRE HACIA EL LADO: crece
//  en ancho hasta 16:9 manteniendo su alto, empuja a las de al lado y enseña
//  la imagen de fondo del anime con su logo, «Ver ahora», Mi lista, info, una
//  línea destacada en verde y las etiquetas. Pasado un momento, si el anime
//  tiene tráiler, entra en fundido. Al salir, se cierra con suavidad de vuelta
//  a su póster.
//
//  Solo con ratón real y pantalla ancha. En móvil (sin hover) y en la app de TV
//  (mando) se sigue usando el carrusel de siempre: allí ensanchar tarjetas
//  movería el foco del mando de sitio.
// ============================================================================

const OPEN_DELAY = 320;      // intención: no abrir al cruzar la fila de paso
const NEXT_DELAY = 140;      // si ya había una abierta, la vecina se abre antes
const TRAILER_DELAY = 1300;  // el tráiler entra cuando la tarjeta ya está abierta
const ANIM_MS = 460;         // igual que la transición de ancho del CSS

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ytId = (u) => {
  const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

/** ¿Este dispositivo puede usar el efecto? (ratón real, no TV, pantalla ancha) */
export function primeRowEnabled() {
  const tv = document.documentElement.classList.contains("aa-tv");
  return !tv && window.innerWidth > 768 &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function totalEps(a) {
  return a.episodesTotal || a.episodesCount || (a.episodes || []).length || 0;
}

// Línea verde destacada (en Prime: «Primeros 3 episodios disponibles»).
function highlight(a) {
  const n = totalEps(a);
  const eps = n ? `${n} ${n === 1 ? "episodio" : "episodios"}` : "";
  if (/dob|latino/i.test(a.audio || "")) {
    return { icon: "fa-microphone", text: eps ? `Doblaje latino · ${eps}` : "Doblaje latino disponible" };
  }
  if (/emisi/i.test(a.status || "")) return { icon: "fa-bullhorn", text: "Nuevos episodios cada semana" };
  return eps ? { icon: "fa-check-circle", text: `${eps} disponibles` } : null;
}

function badges(a) {
  const out = [];
  const st = String(a.status || "");
  if (a.type === "Película") out.push(`<span class="prow-box">PELÍCULA</span>`);
  else if (/emisi/i.test(st)) out.push(`<span class="prow-box hot">EN EMISIÓN</span>`);
  else if (st) out.push(`<span class="prow-box">${esc(st.toUpperCase())}</span>`);
  // Clasificación de edad («+16 Violencia»). Algunas fichas traen ahí un número
  // suelto que no es una clasificación (p. ej. «4.8»): eso no se pinta.
  const cw = String(a.contentWarning || "").trim();
  if (cw && !/^\d+(?:[.,]\d+)?$/.test(cw)) out.push(`<span class="prow-box">${esc(cw)}</span>`);
  if (a.year) out.push(`<span>${esc(a.year)}</span>`);
  if (a.type !== "Película" && a.seasons) out.push(`<span>${a.seasons} ${a.seasons == 1 ? "temporada" : "temporadas"}</span>`);
  if (a.audio) out.push(`<span>${esc(a.audio)}</span>`);
  return out.join("");
}

function itemHtml(a) {
  const href = `anime-details.html?id=${encodeURIComponent(a.id)}`;
  const fondo = a.heroImg || a.fonImg || a.img || "";
  const hl = highlight(a);
  const sub = [a.rating ? `<i class="fas fa-star"></i> ${esc(a.rating)}` : "", esc((a.genres || []).slice(0, 3).join(" • "))]
    .filter(Boolean).join('<span class="prow-dot">·</span>');
  return `
    <article class="prow-item" role="listitem" data-id="${esc(a.id)}"
             data-trailer="${esc(a.trailerUrl)}" data-video="${esc(a.video)}">
      <a class="prow-poster" href="${href}" aria-label="${esc(a.title)}">
        <img src="${esc(a.img)}" alt="${esc(a.title)}" loading="lazy" decoding="async">
        ${a.quality ? `<span class="prow-quality">${esc(a.quality)}</span>` : ""}
      </a>
      <div class="prow-wide" aria-hidden="true">
        <img class="prow-bg" data-src="${esc(fondo)}" alt="">
        <div class="prow-video"></div>
        <div class="prow-shade"></div>
        <div class="prow-body">
          ${a.logoImg
            ? `<img class="prow-logo" data-src="${esc(a.logoImg)}" alt="${esc(a.title)}">`
            : `<h3 class="prow-title">${esc(a.title)}</h3>`}
          <div class="prow-actions">
            <a class="prow-play" href="${href}" tabindex="-1"><i class="fas fa-play"></i> Ver ahora</a>
            <button type="button" class="prow-circle prow-fav" tabindex="-1" aria-label="Añadir a Mi lista" data-tip="Mi lista"><i class="fas fa-plus"></i></button>
            <a class="prow-circle prow-info" href="${href}" tabindex="-1" aria-label="Más información" data-tip="Detalles"><i class="fas fa-info"></i></a>
          </div>
          ${hl ? `<div class="prow-hl"><i class="fas ${hl.icon}"></i> ${esc(hl.text)}</div>` : ""}
          <div class="prow-badges">${badges(a)}</div>
          ${sub ? `<div class="prow-sub">${sub}</div>` : ""}
        </div>
      </div>
    </article>`;
}

// Mueve la fila mientras la tarjeta se abre para que quede ANCLADA bajo el
// cursor: si había otra abierta antes que ella, al cerrarse esa todo se
// correría hacia la izquierda y el ratón acabaría encima de otra tarjeta. Y si
// no cabe entera (las del borde derecho), se va corriendo para que se vea
// completa: en la práctica «se abre hacia la izquierda», como en Prime.
// Se recalcula en cada fotograma con la posición real del momento, porque los
// anchos están animándose a la vez.
function followOpen(row, item, wideW, done) {
  const pad = 12;
  const startOff = item.offsetLeft - row.scrollLeft;          // dónde se ve ahora
  let endOff = Math.min(startOff, row.clientWidth - pad - wideW);
  endOff = Math.max(endOff, pad);
  const t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  cancelAnimationFrame(row._follow);
  row._following = true;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / (ANIM_MS + 40));
    row.scrollLeft = item.offsetLeft - (startOff + (endOff - startOff) * ease(t));
    if (t < 1) row._follow = requestAnimationFrame(step);
    else { row._following = false; done && done(); }
  };
  row._follow = requestAnimationFrame(step);
}

// Espera (poco) a que la imagen de fondo esté lista: así al abrir nunca se ve
// la tarjeta en negro un instante.
function ready(img, max = 350) {
  if (!img || !img.getAttribute("src") || img.complete) return Promise.resolve();
  return Promise.race([
    (img.decode ? img.decode() : Promise.resolve()).catch(() => {}),
    new Promise((r) => setTimeout(r, max)),
  ]);
}

/**
 * Monta una fila estilo Prime en `host` (se reemplaza su contenido).
 * opts.isFav(id) → bool | Promise<bool>; opts.toggleFav(anime) → Promise<bool>
 */
export function mountPrimeRow(host, list, opts = {}) {
  if (!host || !list || !list.length) return;
  const byId = new Map(list.map((a) => [String(a.id), a]));
  host.classList.add("prow-host");
  host.innerHTML = `
    <div class="prow-wrap">
      <button type="button" class="prow-nav prev" aria-label="Anteriores"><i class="fas fa-chevron-left"></i></button>
      <div class="prow" role="list">${list.map(itemHtml).join("")}</div>
      <button type="button" class="prow-nav next" aria-label="Siguientes"><i class="fas fa-chevron-right"></i></button>
    </div>`;
  const wrap = host.querySelector(".prow-wrap");
  const row = host.querySelector(".prow");

  // Mismo tamaño de póster que los carruseles de siempre (6/5/4 por fila).
  function size() {
    const w = row.clientWidth;
    const n = w >= 1300 ? 6 : w >= 950 ? 5 : 4;
    const gap = 12;
    const pw = Math.floor((w - gap * (n - 1)) / n);
    const ph = Math.round(pw * 1.5);
    row.style.setProperty("--pw", pw + "px");
    row.style.setProperty("--ph", ph + "px");
    row.style.setProperty("--ww", Math.round(ph * 16 / 9) + "px");
    row.style.setProperty("--gap", gap + "px");
    navState();
  }
  function navState() {
    const max = row.scrollWidth - row.clientWidth - 2;
    wrap.classList.toggle("at-start", row.scrollLeft <= 2);
    wrap.classList.toggle("at-end", row.scrollLeft >= max);
  }
  const pageBy = (dir) => row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: "smooth" });
  wrap.querySelector(".prow-nav.prev").addEventListener("click", () => { close(); pageBy(-1); });
  wrap.querySelector(".prow-nav.next").addEventListener("click", () => { close(); pageBy(1); });
  row.addEventListener("scroll", navState, { passive: true });

  let open = null, pending = null, timer = null, trailerT = null;

  function loadLazy(scope) {
    scope.querySelectorAll("[data-src]").forEach((im) => {
      if (!im.getAttribute("src")) im.setAttribute("src", im.dataset.src);
    });
  }
  // En cuanto el ratón entra en la fila se precargan los fondos y logos de todas
  // sus tarjetas (son pocas): cuando se abra una ya estará la imagen.
  row.addEventListener("pointerenter", () => loadLazy(row), { once: true });

  function startTrailer(item) {
    const box = item.querySelector(".prow-video");
    if (!box || box.firstChild) return;
    const { video, trailer } = item.dataset;
    let el = null;
    if (video) {
      el = document.createElement("video");
      Object.assign(el, { autoplay: true, muted: true, loop: true, playsInline: true });
      el.src = video;
      el.addEventListener("playing", () => item === open && box.classList.add("on"), { once: true });
    } else {
      const id = ytId(trailer);
      if (!id) return;
      el = document.createElement("iframe");
      el.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`;
      el.allow = "autoplay; encrypted-media";
      el.setAttribute("frameborder", "0");
      el.addEventListener("load", () => setTimeout(() => item === open && box.classList.add("on"), 900), { once: true });
    }
    el.tabIndex = -1;
    box.appendChild(el);
  }
  function stopTrailer(item) {
    const box = item.querySelector(".prow-video");
    if (!box) return;
    box.classList.remove("on");
    // Se quita cuando el fundido de salida ya terminó.
    setTimeout(() => { if (item !== open) box.innerHTML = ""; }, 500);
  }

  async function paintFav(item) {
    const btn = item.querySelector(".prow-fav");
    if (!btn || !opts.isFav) return;
    let on = false;
    try { on = !!(await opts.isFav(item.dataset.id)); } catch {}
    btn.classList.toggle("on", on);
    btn.querySelector("i").className = on ? "fas fa-check" : "fas fa-plus";
    btn.setAttribute("aria-label", on ? "Quitar de Mi lista" : "Añadir a Mi lista");
    btn.dataset.tip = on ? "En Mi lista" : "Mi lista";
  }

  async function openItem(item) {
    if (open === item) return;
    pending = item;
    loadLazy(item);
    await ready(item.querySelector(".prow-bg"));
    if (pending !== item) return;              // el ratón ya se fue a otra
    pending = null;
    if (open) closeItem(open);
    open = item;
    paintFav(item);
    item.classList.add("open");
    item.querySelector(".prow-wide").removeAttribute("aria-hidden");
    item.querySelectorAll(".prow-wide [tabindex]").forEach((x) => x.removeAttribute("tabindex"));
    followOpen(row, item, parseFloat(getComputedStyle(row).getPropertyValue("--ww")) || 480, navState);
    clearTimeout(trailerT);
    trailerT = setTimeout(() => item === open && startTrailer(item), TRAILER_DELAY);
  }
  function closeItem(item) {
    item.classList.remove("open");
    item.querySelector(".prow-wide").setAttribute("aria-hidden", "true");
    item.querySelectorAll(".prow-wide a, .prow-wide button").forEach((x) => x.setAttribute("tabindex", "-1"));
    stopTrailer(item);
    if (open === item) open = null;
  }
  function close() {
    clearTimeout(timer); clearTimeout(trailerT);
    pending = null;
    if (open) closeItem(open);
  }

  // Se escucha el MOVIMIENTO real del ratón (no «pointerover»): cuando la fila
  // se desplaza o una tarjeta se cierra, Chrome lanza eventos de hover aunque el
  // ratón esté quieto, y eso abría tarjetas en cascada.
  let lastX = -1, lastY = -1;
  row.addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (e.clientX === lastX && e.clientY === lastY) return;
    lastX = e.clientX; lastY = e.clientY;
    if (row._following) return;                // la fila se está moviendo sola
    const item = e.target.closest(".prow-item");
    if (!item || item === open || item === pending) { if (item === open) clearTimeout(timer); return; }
    clearTimeout(timer);
    timer = setTimeout(() => openItem(item), open ? NEXT_DELAY : OPEN_DELAY);
  });
  row.addEventListener("pointerleave", close);
  // Teclado: al tabular por los pósters también se abren.
  row.addEventListener("focusin", (e) => {
    const item = e.target.closest(".prow-item");
    if (item) { clearTimeout(timer); openItem(item); }
  });
  row.addEventListener("focusout", (e) => {
    if (!row.contains(e.relatedTarget)) close();
  });

  row.addEventListener("click", async (e) => {
    const btn = e.target.closest(".prow-fav");
    if (!btn) return;
    e.preventDefault();
    const item = btn.closest(".prow-item");
    const anime = byId.get(item.dataset.id);
    if (!anime || !opts.toggleFav) return;
    btn.disabled = true;
    try {
      const on = await opts.toggleFav(anime);
      btn.classList.toggle("on", on);
      btn.querySelector("i").className = on ? "fas fa-check" : "fas fa-plus";
      btn.setAttribute("aria-label", on ? "Quitar de Mi lista" : "Añadir a Mi lista");
      btn.dataset.tip = on ? "En Mi lista" : "Mi lista";
      btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
    } catch (err) { console.error(err); }
    btn.disabled = false;
  });

  size();
  let rT = null;
  if (host._prowResize) window.removeEventListener("resize", host._prowResize);   // si la fila se repinta
  host._prowResize = () => { clearTimeout(rT); rT = setTimeout(() => { close(); size(); }, 150); };
  window.addEventListener("resize", host._prowResize, { passive: true });
}
