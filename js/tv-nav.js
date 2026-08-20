// ============================================================================
//  NAVEGACIÓN PARA TV (Fire TV / Android TV) — All-Anime
//  Hace el sitio usable con el control remoto (D-pad): mueve el foco entre
//  elementos con las flechas, activa con OK/Enter, y aplica un modo "10 pies"
//  (foco muy visible, márgenes seguros de overscan). Se activa automáticamente
//  en televisores (o si la app WebView lo fuerza) y no estorba en escritorio.
// ============================================================================
(function () {
  "use strict";

  // --- Detección de TV -------------------------------------------------------
  const ua = navigator.userAgent || "";
  const isTVua = /AllAnimeTV|AFT[A-Z0-9]|Fire\s?TV|; ?TV\b|\bTV\b|SmartTV|Smart-TV|GoogleTV|Google TV|BRAVIA|Web0S|WebOS|Tizen|HbbTV|NetCast|Silk/i.test(ua);
  const noTouch = !("ontouchstart" in window) && (navigator.maxTouchPoints || 0) === 0;
  const bigScreen = Math.min(window.screen ? screen.width : 0, window.screen ? screen.height : 0) >= 700 && (window.innerWidth >= 1280);
  let forced = false;
  try { forced = localStorage.getItem("aa_tv") === "1"; } catch {}
  const isTV = forced || isTVua || (noTouch && bigScreen && /Android|Linux armv|CrKey/i.test(ua));
  if (!isTV) return; // en escritorio/móvil no cambiamos nada

  const root = document.documentElement;
  root.classList.add("aa-tv");
  // ¿Estamos dentro del iframe del reproductor (frame/player.html) o en la página
  // principal? Sirve para el "puente" de foco entre el modal y la lista de servidores.
  const isFrame = window.self !== window.top;

  // --- Estilos del modo TV (foco 10 pies + overscan) -------------------------
  const st = document.createElement("style");
  st.id = "aa-tv-styles";
  const RAIL_W = 84, RAIL_EXP = 268;   // ancho colapsado / expandido de la barra
  st.textContent = `
    html.aa-tv body { overflow-x: hidden; }
    /* Foco muy visible para el control remoto */
    html.aa-tv :focus { outline: none; }
    html.aa-tv .aa-focus {
      outline: 4px solid #ff5a3c !important; outline-offset: 3px !important;
      border-radius: 8px !important; box-shadow: 0 0 0 7px rgba(255,90,60,.4), 0 14px 38px rgba(0,0,0,.6) !important;
      position: relative; z-index: 5;
    }
    /* Los IFRAMES (reproductor / video de cada server) NO llevan borde de foco:
       molestaba sobre el video. Se indica dónde estás solo con la pista de texto. */
    html.aa-tv iframe.aa-focus, html.aa-tv #episode-iframe.aa-focus, html.aa-tv #IFR.aa-focus {
      outline: none !important; box-shadow: none !important;
    }
    html.aa-tv .player-video-container:has(#episode-iframe.aa-focus)::after {
      content: "▶  Pulsa OK / Play para elegir servidor";
      position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%);
      background: rgba(255,90,60,.95); color: #fff; font-weight: 700; font-size: 15px;
      padding: 8px 16px; border-radius: 30px; z-index: 61; pointer-events: none;
      box-shadow: 0 6px 20px rgba(0,0,0,.5);
    }
    html.aa-tv .anime-card.aa-focus, html.aa-tv .cr-card.aa-focus,
    html.aa-tv .episode-detail-card.aa-focus, html.aa-tv .cr-list-item.aa-focus {
      transform: scale(1.06) !important; transition: transform .12s ease;
    }
    /* Las tarjetas envuelven su contenido en un <a> (ese es el que recibe el foco);
       se escala ese <a> para que la selección se vea claramente. */
    html.aa-tv .anime-card a.aa-focus, html.aa-tv .cr-card a.aa-focus,
    html.aa-tv .episode-detail-card a.aa-focus {
      display: block !important; transform: scale(1.05); transition: transform .12s ease;
    }
    /* Oculta el cursor cuando se navega por D-pad */
    html.aa-tv.aa-dpad, html.aa-tv.aa-dpad * { cursor: none !important; }

    /* ===== Barra lateral estilo Prime Video: overlay TRANSPARENTE que NO empuja
       el contenido (no se pierde pantalla); se oscurece y expande al enfocarla,
       con animación fluida. Arriba va el avatar de "Mi cuenta" (sin texto). ===== */
    html.aa-tv.aa-rail-on header { display: none !important; }
    /* El contenido va a pantalla completa por debajo; solo un respiro a la izquierda. */
    html.aa-tv.aa-rail-on .main-content,
    html.aa-tv.aa-rail-on .container { padding-left: max(2vw, 20px); padding-right: max(2.5vw, 24px); }

    .aa-rail {
      position: fixed; top: 0; left: 0; height: 100vh; width: ${RAIL_W}px; z-index: 1500;
      display: flex; flex-direction: column; align-items: stretch; gap: 4px;
      padding: 26px 0; box-sizing: border-box; overflow: hidden;
      background: linear-gradient(90deg, rgba(9,10,13,.72) 0%, rgba(9,10,13,.30) 58%, rgba(9,10,13,0) 100%);
      transition: width .24s cubic-bezier(.22,.61,.36,1), background .24s ease;
    }
    .aa-rail.expanded {
      width: ${RAIL_EXP}px;
      background: linear-gradient(90deg, rgba(8,9,12,.99) 0%, rgba(8,9,12,.96) 64%, rgba(8,9,12,0) 100%);
      backdrop-filter: blur(3px);
    }
    .aa-rail-spacer { flex: 1; }
    .aa-rail-item {
      display: flex; align-items: center; gap: 20px; height: 54px; padding: 0 26px;
      color: #cfd3db; text-decoration: none; white-space: nowrap; font-size: 17px;
      font-weight: 600; border: none; background: none; cursor: pointer;
    }
    .aa-rail-item i { font-size: 23px; width: 28px; text-align: center; flex: none;
      filter: drop-shadow(0 2px 7px rgba(0,0,0,.9)); }
    .aa-rail-item span:not(.aa-rail-avatar) { opacity: 0; transform: translateX(-6px);
      transition: opacity .18s ease, transform .18s ease; }
    .aa-rail.expanded .aa-rail-item span:not(.aa-rail-avatar) { opacity: 1; transform: none; }
    .aa-rail-item.active { color: #fff; }
    .aa-rail-item.active i { color: #ff5a3c; }
    .aa-rail-item.aa-focus {
      outline: none !important; box-shadow: none !important; transform: none !important;
      color: #fff; border-radius: 0 !important;
    }
    .aa-rail.expanded .aa-rail-item.aa-focus { background: rgba(255,255,255,.13); }
    .aa-rail-item.aa-focus i { color: #ff5a3c; }
    /* Avatar de "Mi cuenta" arriba (reemplaza el nombre/logo All-Anime) */
    .aa-rail-account { height: 66px; margin-bottom: 8px; }
    .aa-rail-avatar {
      width: 42px; height: 42px; border-radius: 50%; flex: none; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #2a2d36; color: #fff; font-weight: 800; font-size: 18px;
      border: 2px solid rgba(255,255,255,.55); box-shadow: 0 2px 10px rgba(0,0,0,.7);
    }
    .aa-rail-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .aa-rail-account.aa-focus .aa-rail-avatar { border-color: #ff5a3c; }
  `;
  (document.head || root).appendChild(st);
  // CSS para revelar el buscador del header al pulsar "Buscar" en la barra.
  st.textContent += `
    html.aa-tv.aa-search-open header {
      display: flex !important; position: fixed !important; top: 0; left: ${RAIL_W}px; right: 0;
      z-index: 1600; background: #0e0f13; padding: 14px max(3vw,24px);
      box-shadow: 0 12px 34px rgba(0,0,0,.6); align-items: center;
    }
    html.aa-tv.aa-search-open header .search-container { width: min(60vw, 720px); }
    html.aa-tv.aa-search-open header #search-input { display: block !important; width: 100%; font-size: 20px; padding: 12px 18px; }
  `;

  // --- Barra lateral estilo Prime Video -------------------------------------
  const RAIL_ITEMS = [
    { icon: "fa-search", label: "Buscar", act: "search" },
    { icon: "fa-home", label: "Inicio", href: "index.html" },
    { icon: "fa-compass", label: "Explorar", href: "explorar.html" },
    { icon: "fa-film", label: "Películas", href: "peliculas.html" },
  ];
  // El buscador de TV reutiliza el overlay a pantalla completa del sitio (igual que
  // en Android). Si no está listo aún, cae al buscador del header como respaldo.
  function openSearch() {
    if (typeof window.__aaOpenSearch === "function") {
      window.__aaOpenSearch();
      setTimeout(() => { const i = document.getElementById("msearch-input"); if (i) { try { i.focus(); } catch {} setFocus(i, false); } }, 120);
      return;
    }
    root.classList.add("aa-search-open");
    const c = document.querySelector(".search-container"); if (c) c.classList.add("active");
    const inp = document.getElementById("search-input");
    if (inp) setTimeout(() => { try { inp.focus(); } catch {} setFocus(inp, false); }, 80);
  }
  function closeSearch() {
    if (typeof window.__aaCloseSearch === "function") window.__aaCloseSearch();
    root.classList.remove("aa-search-open");
    const c = document.querySelector(".search-container"); if (c) c.classList.remove("active");
  }
  function avatarInner() {
    const u = window.__aaUser;
    if (u && u.photoURL) return `<img src="${u.photoURL}" alt="">`;
    if (u && (u.displayName || u.email)) return (u.displayName || u.email).trim().charAt(0).toUpperCase();
    return '<i class="fas fa-user" style="font-size:19px"></i>';
  }
  function buildRail() {
    if (window.self !== window.top) return;           // no dentro del iframe del reproductor
    if (!document.querySelector("header")) return;      // páginas sin header
    if (document.querySelector(".aa-rail")) return;
    const page = (location.pathname.split("/").pop() || "index.html").toLowerCase() || "index.html";
    // Arriba: avatar de "Mi cuenta" (sin el texto All-Anime).
    let html = `<a href="cuenta.html" class="aa-rail-item aa-rail-account${page === "cuenta.html" ? " active" : ""}"><span class="aa-rail-avatar" id="aa-rail-av">${avatarInner()}</span><span>Mi cuenta</span></a>`;
    for (const it of RAIL_ITEMS) {
      const active = it.href && (page === it.href || page === it.href.replace(".html", ""));
      if (it.href) html += `<a href="${it.href}" class="aa-rail-item${active ? " active" : ""}"><i class="fas ${it.icon}"></i><span>${it.label}</span></a>`;
      else html += `<button type="button" data-act="${it.act}" class="aa-rail-item"><i class="fas ${it.icon}"></i><span>${it.label}</span></button>`;
    }
    html += `<div class="aa-rail-spacer"></div>`;
    const rail = document.createElement("nav");
    rail.className = "aa-rail";
    rail.innerHTML = html;
    document.body.appendChild(rail);
    root.classList.add("aa-rail-on");
    const sb = rail.querySelector('[data-act="search"]');
    if (sb) sb.addEventListener("click", openSearch);
    // Actualiza el avatar cuando cambia la sesión.
    document.addEventListener("aa-user-change", () => { const av = document.getElementById("aa-rail-av"); if (av) av.innerHTML = avatarInner(); });
  }
  if (document.body) buildRail();
  else document.addEventListener("DOMContentLoaded", buildRail);

  // --- Utilidades de foco ----------------------------------------------------
  const SEL = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), .open-player-from-details, .open-player-from-modal, .ODDIV li, .SelectLangDisp li, .rw-stars i, #episode-iframe, #backToPlayers';
  const NATIVE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/;
  // Los <li>/<a sin href> con onclick no son enfocables: les damos tabindex.
  const ensureFocusable = (el) => { if (!NATIVE.test(el.tagName) && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0"); return el; };
  const isShown = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const visible = (el) => {
    if (!el || el.disabled || !isShown(el)) return false;
    const r = el.getBoundingClientRect();
    // dentro (o cerca) del viewport
    return r.bottom > -4 && r.top < (window.innerHeight + 4) && r.right > -4 && r.left < (window.innerWidth + 4);
  };
  // Cuando hay un modal/diálogo abierto, el foco se ATRAPA dentro de él (si no,
  // "se pierde" hacia el contenido de atrás y no se puede navegar el modal).
  const MODAL_SEL = '.episode-player-modal, #trailer-modal, #adfree-modal, .adfree-ov, #apk-help, .msearch-overlay.open, [role="dialog"]';
  function activeScope() {
    const modals = Array.prototype.filter.call(document.querySelectorAll(MODAL_SEL), isShown);
    return modals.length ? modals[modals.length - 1] : document;
  }
  // IMPORTANTE: se consideran TODOS los elementos renderizados (isShown), no solo
  // los que están dentro del viewport. Así el D-pad puede recorrer toda la página
  // (bajar por las filas, avanzar por los carruseles) y el foco arrastra el scroll
  // con scrollIntoView. Antes solo veía lo visible en pantalla → se atascaba.
  const focusables = () => {
    const scope = activeScope();
    return Array.prototype.filter.call(scope.querySelectorAll(SEL), isShown).map(ensureFocusable);
  };

  let current = null, _hoverCard = null;
  function setFocus(el, scroll) {
    if (!el) return;
    if (current && current !== el) current.classList.remove("aa-focus");
    current = el;
    el.classList.add("aa-focus");
    // La barra lateral se expande (muestra las etiquetas) solo cuando el foco está
    // en ella; al salir al contenido, se colapsa a íconos.
    const rail = document.querySelector(".aa-rail");
    if (rail) rail.classList.toggle("expanded", !!el.closest(".aa-rail"));
    // Vista previa de la tarjeta al enfocarla (sale el trailer/preview del anime,
    // como el hover en PC). card-hover.js expone estas funciones para TV.
    const card = el.closest ? el.closest(".anime-card") : null;
    if (card !== _hoverCard) {
      try { if (typeof window.__aaCardPreviewClose === "function") window.__aaCardPreviewClose(); } catch {}
      _hoverCard = card || null;
      try { if (card && typeof window.__aaCardPreview === "function") window.__aaCardPreview(card); } catch {}
    }
    // OJO: NO enfocar el <iframe> del reproductor con .focus() — eso transferiría
    // el teclado dentro del iframe y el padre dejaría de controlar el D-pad. El
    // iframe solo se resalta; se entra a él con ENTER (postMessage aa:"enter").
    if (el.tagName !== "IFRAME") { try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} } }
    // No arrastrar el scroll cuando el foco está en la barra fija.
    if (scroll !== false && !el.closest(".aa-rail")) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }

  const isTyping = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "button" && el.type !== "submit";

  // --- Navegación espacial por ZONAS (barra lateral vs contenido) ------------
  const inRail = (el) => !!(el && el.closest && el.closest(".aa-rail"));
  const nearViewport = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > -60 && r.top < window.innerHeight + 60 && r.right > -60 && r.left < window.innerWidth + 60;
  };
  const allContent = () => focusables().filter((el) => !inRail(el));
  const railItems = () => focusables().filter(inRail);

  // Mejor candidato en una dirección dentro de una lista dada.
  function bestAmong(list, dir, cur) {
    if (!list.length) return null;
    if (!cur || !list.includes(cur)) return list[0];
    const cr = cur.getBoundingClientRect();
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let winner = null, bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      let primary, cross;
      if (dir === "right") { if (r.left < cr.right - 6) continue; primary = dx; cross = Math.abs(dy); }
      else if (dir === "left") { if (r.right > cr.left + 6) continue; primary = -dx; cross = Math.abs(dy); }
      else if (dir === "down") { if (r.top < cr.bottom - 6) continue; primary = dy; cross = Math.abs(dx); }
      else { if (r.bottom > cr.top + 6) continue; primary = -dy; cross = Math.abs(dx); }
      if (primary <= 0) continue;
      const score = primary + cross * 2.4;         // prioriza fuerte la alineación
      if (score < bestScore) { bestScore = score; winner = el; }
    }
    return winner;
  }

  // Ítem de la barra lateral más cercano en vertical al elemento actual.
  function nearestRailItem(cur) {
    const items = railItems();
    if (!items.length) return null;
    if (!cur) return items[0];
    const cy = cur.getBoundingClientRect().top + cur.getBoundingClientRect().height / 2;
    let best = items[0], bd = Infinity;
    for (const it of items) { const r = it.getBoundingClientRect(); const d = Math.abs((r.top + r.height / 2) - cy); if (d < bd) { bd = d; best = it; } }
    return best;
  }

  // ¿El candidato está grosso modo en la misma fila? (para decidir si IZQUIERDA
  // abre la barra en vez de subir a otra fila).
  function sameRow(a, b) {
    if (!a || !b) return false;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const overlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    return overlap > Math.min(ra.height, rb.height) * 0.35;
  }

  // Navegación LIBRE: en cualquier dirección busca el mejor candidato en TODA la
  // página (no solo el viewport), así se puede recorrer tarjeta por tarjeta,
  // izquierda↔derecha y arriba↔abajo sin atascarse; el foco arrastra el scroll.
  function navigate(dir) {
    const cur = current;
    // --- En la barra lateral ---
    if (inRail(cur)) {
      if (dir === "up" || dir === "down") { const n = bestAmong(railItems(), dir, cur); if (n) setFocus(n); return; }
      if (dir === "right") { const c = allContent(); const n = bestAmong(c.filter(nearViewport), "right", null) || bestAmong(c, "right", null) || c[0]; if (n) setFocus(n); return; }
      return; // izquierda en la barra: ya está al borde
    }
    // --- Contenido: mejor candidato en la dirección, por toda la página ---
    const content = allContent();
    let n = bestAmong(content, dir, cur);
    // IZQUIERDA: si no hay nada a la izquierda EN LA MISMA fila, abre la barra.
    if (dir === "left" && (!n || !sameRow(n, cur))) {
      const r = nearestRailItem(cur); if (r) { setFocus(r); return; }
    }
    if (n) { setFocus(n); return; }
    // Sin candidato en esa dirección: desplaza la página por si hay más contenido.
    if (dir === "down") window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: "smooth" });
    else if (dir === "up") window.scrollBy({ top: -Math.round(window.innerHeight * 0.7), behavior: "smooth" });
  }

  function onKey(e) {
    const k = e.key;
    const active = document.activeElement;
    // Dentro del iframe del reproductor, ATRÁS devuelve el foco al modal padre
    // (para llegar a comentarios / like / lista de episodios / cerrar).
    if (isFrame && (k === "Escape" || k === "Backspace" || k === "GoBack" || k === "BrowserBack")) {
      if (isTyping(active) && k === "Backspace" && active.value) return;
      e.preventDefault();
      try { window.parent.postMessage({ aa: "exit" }, "*"); } catch {}
      return;
    }
    // Atrás/Escape: si el buscador de TV está abierto, ciérralo y vuelve al contenido.
    const searchOpen = root.classList.contains("aa-search-open") || document.querySelector(".msearch-overlay.open");
    if ((k === "Escape" || k === "Backspace" || k === "GoBack" || k === "BrowserBack") && searchOpen) {
      if (isTyping(active) && k === "Backspace" && active.value) return; // deja borrar texto
      e.preventDefault(); closeSearch(); setTimeout(() => focusScope(document), 60); return;
    }
    // Si se está escribiendo en un campo, deja que las flechas muevan el cursor
    // del texto (salvo arriba/abajo para poder salir del campo).
    if (isTyping(active) && (k === "ArrowLeft" || k === "ArrowRight")) return;

    if (k === "ArrowRight" || k === "ArrowLeft" || k === "ArrowUp" || k === "ArrowDown") {
      const dir = k === "ArrowRight" ? "right" : k === "ArrowLeft" ? "left" : k === "ArrowUp" ? "up" : "down";
      e.preventDefault(); root.classList.add("aa-dpad");
      navigate(dir);
      return;
    }
    // OK/Enter y también el botón PLAY/PAUSA del control (para elegir servidor /
    // dar play a lo enfocado).
    if (k === "Enter" || k === "OK" || k === "MediaPlayPause" || k === "MediaPlay" || k === "Play" || k === "Pause" || k === " " || k === "Spacebar") {
      if (isTyping(active) && (k === " " || k === "Spacebar")) return;   // espacio en un campo escribe
      if (isTyping(active)) return;
      // ENTER/PLAY sobre el iframe del reproductor → ENTRA a la selección de servidores.
      if (current && current.id === "episode-iframe" && current.contentWindow) {
        e.preventDefault();
        try { current.contentWindow.postMessage({ aa: "enter" }, "*"); } catch {}
        return;
      }
      if (current) {
        e.preventDefault();
        current.click();   // dispara la acción real (link/botón) del elemento enfocado
      }
    }
  }
  document.addEventListener("keydown", onKey, true);

  // Enfoque inicial: la primera tarjeta/enlace útil del contenido.
  function focusInitial() {
    const list = focusables();
    if (!list.length) return;
    // prioriza el contenido (tarjetas / servidores / hero) sobre el header
    const pref = list.find((el) => el.closest(".OD, #serverContainer, .anime-grid, .cr-hist, .anime-listing-section, .episodes-list-container"))
      || list.find((el) => el.matches(".hero-button, .cr-card, .cr-list-item")) || list[0];
    setFocus(pref, false);
  }
  // Mueve el foco al primer elemento del ámbito actual (modal o contenido).
  function focusScope(scope) {
    const list = focusables();
    if (!list.length) return;
    let pref;
    if (scope && scope !== document) {
      // dentro de un modal: prioriza el reproductor/lista de servidores
      pref = list.find((el) => el.closest(".OD, #serverContainer, .player-video-container, .player-nav-col")) || list[0];
    } else {
      pref = list.find((el) => el.closest(".OD, #serverContainer, .anime-grid, .cr-hist, .anime-listing-section, .episodes-list-container"))
        || list.find((el) => el.matches(".hero-button, .cr-card, .cr-list-item")) || list[0];
    }
    setFocus(pref, scope !== document);
  }
  function focusInitial() { focusScope(document); }
  const start = () => setTimeout(focusInitial, 600);
  if (document.readyState === "complete" || document.readyState === "interactive") start();
  else document.addEventListener("DOMContentLoaded", start);

  // Vigila la apertura/cierre de modales: al abrirse uno, mete el foco dentro;
  // si el foco quedó fuera del ámbito activo (o el elemento enfocado ya no está
  // visible), lo re-engancha. Así el modal siempre es navegable con el control.
  let lastScope = document;
  const resync = () => {
    const scope = activeScope();
    const scopeChanged = scope !== lastScope;
    lastScope = scope;
    const curOk = current && document.contains(current) && isShown(current) &&
      (scope === document ? true : scope.contains(current));
    if (scopeChanged || !curOk) setTimeout(() => focusScope(scope), scope !== document ? 250 : 50);
  };
  let moT = null;
  const mo = new MutationObserver(() => { clearTimeout(moT); moT = setTimeout(resync, 120); });
  try { mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] }); } catch {}

  // Activa el elemento enfocado (equivale a OK). La app nativa lo llama cuando se
  // pulsa el botón PLAY/PAUSA del control (por si el WebView no envía la tecla a JS).
  window.__aaActivate = function () {
    if (!current) return;
    if (current.id === "episode-iframe" && current.contentWindow) {
      try { current.contentWindow.postMessage({ aa: "enter" }, "*"); } catch {}
      return;
    }
    try { current.click(); } catch {}
  };
  // Mueve el foco en una dirección (la app puede llamarlo si hiciera falta).
  window.__aaMove = function (dir) { root.classList.add("aa-dpad"); navigate(dir); };

  // --- Puente de foco entre el modal del episodio (padre) y el iframe del
  //     reproductor (selección de servidores). ENTER entra; ATRÁS vuelve. ---
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || typeof d !== "object" || !d.aa) return;
    if (d.aa === "enter" && isFrame) {
      // El padre pidió entrar: enfoca la lista de servidores del reproductor.
      root.classList.add("aa-dpad");
      setTimeout(() => focusScope(document), 60);
    } else if (d.aa === "exit" && !isFrame) {
      // El iframe pidió salir: devuelve el resalte al iframe dentro del modal.
      const ifr = document.getElementById("episode-iframe");
      if (ifr) setFocus(ifr);
    }
  });
})();
