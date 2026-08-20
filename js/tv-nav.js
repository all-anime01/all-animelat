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

  // --- Estilos del modo TV (foco 10 pies + overscan) -------------------------
  const st = document.createElement("style");
  st.id = "aa-tv-styles";
  const RAIL_W = 84, RAIL_EXP = 268;   // ancho colapsado / expandido de la barra
  st.textContent = `
    html.aa-tv body { overflow-x: hidden; }
    /* Foco muy visible para el control remoto */
    html.aa-tv :focus { outline: none; }
    html.aa-tv .aa-focus {
      outline: 3px solid #ff5a3c !important; outline-offset: 3px !important;
      border-radius: 8px !important; box-shadow: 0 0 0 6px rgba(255,90,60,.35), 0 12px 34px rgba(0,0,0,.55) !important;
      position: relative; z-index: 5;
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

    /* ===== Modo TV estilo Crunchyroll: barra lateral izquierda ===== */
    /* Se oculta el header horizontal original y el contenido se desplaza a la
       derecha, dejando la barra lateral fija a la izquierda (navegable con D-pad). */
    html.aa-tv.aa-rail-on header { display: none !important; }
    html.aa-tv.aa-rail-on body { padding-left: ${RAIL_W}px; }
    html.aa-tv.aa-rail-on .main-content,
    html.aa-tv.aa-rail-on .container { padding-left: max(2.5vw, 20px); padding-right: max(3vw, 28px); }

    .aa-rail {
      position: fixed; top: 0; left: 0; height: 100vh; width: ${RAIL_W}px;
      background: linear-gradient(180deg, #16181d 0%, #0e0f13 100%);
      border-right: 1px solid #24262d; z-index: 1500;
      display: flex; flex-direction: column; align-items: stretch; gap: 6px;
      padding: 22px 0; box-sizing: border-box; overflow: hidden;
      transition: width .18s ease, box-shadow .18s ease;
    }
    .aa-rail.expanded { width: ${RAIL_EXP}px; box-shadow: 24px 0 60px rgba(0,0,0,.55); }
    .aa-rail-logo { display:flex; align-items:center; justify-content:flex-start; gap:12px;
      padding: 0 26px; height: 52px; margin-bottom: 14px; overflow:hidden; }
    .aa-rail-logo img { width: 32px; height: 32px; object-fit: contain; flex: none; }
    .aa-rail-logo b { color:#fff; font-size: 20px; white-space:nowrap; opacity:0; transition:opacity .15s; letter-spacing:.5px; }
    .aa-rail.expanded .aa-rail-logo b { opacity: 1; }
    .aa-rail-spacer { flex: 1; }
    .aa-rail-item {
      display: flex; align-items: center; gap: 20px; height: 56px;
      padding: 0 30px; color: #b6bac2; text-decoration: none; white-space: nowrap;
      font-size: 17px; font-weight: 600; border: none; background: none; cursor: pointer;
      border-left: 4px solid transparent;
    }
    .aa-rail-item i { font-size: 22px; width: 24px; text-align: center; flex: none; }
    .aa-rail-item span { opacity: 0; transition: opacity .15s ease; }
    .aa-rail.expanded .aa-rail-item span { opacity: 1; }
    .aa-rail-item.active { color: #fff; border-left-color: #ff5a3c; }
    .aa-rail-item.aa-focus {
      outline: none !important; box-shadow: none !important; transform: none !important;
      background: rgba(255,90,60,.16); color: #fff; border-left-color: #ff5a3c; border-radius: 0 !important;
    }
    /* Overlay de búsqueda para TV */
    .aa-tv-search {
      position: fixed; inset: 0; z-index: 1650; background: rgba(8,9,12,.96);
      display: none; align-items: flex-start; justify-content: center; padding-top: 14vh;
    }
    .aa-tv-search.on { display: flex; }
    .aa-tv-search input {
      width: min(70vw, 760px); font-size: 26px; padding: 18px 24px; border-radius: 14px;
      border: 2px solid #333; background: #17181d; color: #fff; outline: none;
    }
    .aa-tv-search input:focus, .aa-tv-search input.aa-focus { border-color: #ff5a3c; box-shadow: 0 0 0 5px rgba(255,90,60,.3) !important; }
    .aa-tv-search .aa-tv-search-hint { position:absolute; bottom: 8vh; color:#8a8f99; font-size:15px; }
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

  // --- Barra lateral estilo Crunchyroll -------------------------------------
  const RAIL_ITEMS = [
    { icon: "fa-search", label: "Buscar", act: "search" },
    { icon: "fa-home", label: "Inicio", href: "index.html" },
    { icon: "fa-compass", label: "Explorar", href: "explorar.html" },
    { icon: "fa-film", label: "Películas", href: "peliculas.html" },
  ];
  function openSearch() {
    root.classList.add("aa-search-open");
    const c = document.querySelector(".search-container");
    if (c) c.classList.add("active");                 // el sitio muestra el input al activar
    const inp = document.getElementById("search-input");
    if (inp) setTimeout(() => { try { inp.focus(); } catch {} setFocus(inp, false); }, 80);
  }
  function closeSearch() {
    root.classList.remove("aa-search-open");
    const c = document.querySelector(".search-container");
    if (c) c.classList.remove("active");
  }
  function buildRail() {
    if (window.self !== window.top) return;           // no dentro del iframe del reproductor
    if (!document.querySelector("header")) return;      // páginas sin header
    if (document.querySelector(".aa-rail")) return;
    const page = (location.pathname.split("/").pop() || "index.html").toLowerCase() || "index.html";
    const logoImg = (document.querySelector(".logo img") || {}).src || "image/all-anime-logo.png";
    let html = `<div class="aa-rail-logo"><img src="${logoImg}" alt=""><b>All-Anime</b></div>`;
    for (const it of RAIL_ITEMS) {
      const active = it.href && (page === it.href || page === it.href.replace(".html", ""));
      if (it.href) html += `<a href="${it.href}" class="aa-rail-item${active ? " active" : ""}"><i class="fas ${it.icon}"></i><span>${it.label}</span></a>`;
      else html += `<button type="button" data-act="${it.act}" class="aa-rail-item"><i class="fas ${it.icon}"></i><span>${it.label}</span></button>`;
    }
    html += `<div class="aa-rail-spacer"></div>`;
    html += `<a href="cuenta.html" class="aa-rail-item${page === "cuenta.html" ? " active" : ""}"><i class="fas fa-user"></i><span>Mi cuenta</span></a>`;
    const rail = document.createElement("nav");
    rail.className = "aa-rail";
    rail.innerHTML = html;
    document.body.appendChild(rail);
    root.classList.add("aa-rail-on");
    const sb = rail.querySelector('[data-act="search"]');
    if (sb) sb.addEventListener("click", openSearch);
  }
  if (document.body) buildRail();
  else document.addEventListener("DOMContentLoaded", buildRail);

  // --- Utilidades de foco ----------------------------------------------------
  const SEL = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), .open-player-from-details, .open-player-from-modal, .ODDIV li, .SelectLangDisp li';
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
  const MODAL_SEL = '.episode-player-modal, #trailer-modal, #adfree-modal, .adfree-ov, #apk-help, [role="dialog"]';
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

  let current = null;
  function setFocus(el, scroll) {
    if (!el) return;
    if (current && current !== el) current.classList.remove("aa-focus");
    current = el;
    el.classList.add("aa-focus");
    // La barra lateral se expande (muestra las etiquetas) solo cuando el foco está
    // en ella; al salir al contenido, se colapsa a íconos (estilo Crunchyroll).
    const rail = document.querySelector(".aa-rail");
    if (rail) rail.classList.toggle("expanded", !!el.closest(".aa-rail"));
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
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

  // Navega en una dirección. Contenido y barra son zonas separadas: en el borde
  // izquierdo del contenido se salta a la barra; desde la barra a la derecha se
  // vuelve al contenido. Se prefiere lo visible; si no hay nada, se busca en toda
  // la página (el foco arrastra el scroll) o se desplaza la página.
  function navigate(dir) {
    const cur = current;
    // --- En la barra lateral ---
    if (inRail(cur)) {
      if (dir === "up" || dir === "down") { const n = bestAmong(railItems(), dir, cur); if (n) setFocus(n); return; }
      if (dir === "right") { const c = allContent().filter(nearViewport); const n = bestAmong(c, "right", null) || c[0] || allContent()[0]; if (n) setFocus(n); return; }
      return; // izquierda en la barra: ya está al borde
    }
    // --- En el contenido ---
    const vp = allContent().filter(nearViewport);
    let n = bestAmong(vp, dir, cur);
    if (!n) n = bestAmong(allContent(), dir, cur);   // salta a la siguiente sección fuera de pantalla
    if (n) { setFocus(n); return; }
    if (dir === "left") { const r = nearestRailItem(cur); if (r) { setFocus(r); return; } }
    // Sin candidato: desplaza la página por si hay contenido fuera del alcance.
    if (dir === "down") window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: "smooth" });
    else if (dir === "up") window.scrollBy({ top: -Math.round(window.innerHeight * 0.7), behavior: "smooth" });
  }

  function onKey(e) {
    const k = e.key;
    const active = document.activeElement;
    // Atrás/Escape: si el buscador de TV está abierto, ciérralo y vuelve al contenido.
    if ((k === "Escape" || k === "Backspace" || k === "GoBack" || k === "BrowserBack") && root.classList.contains("aa-search-open")) {
      if (isTyping(active) && k === "Backspace" && active.value) return; // deja borrar texto
      e.preventDefault(); closeSearch(); setTimeout(() => focusScope(document), 40); return;
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
    if (k === "Enter" || k === "OK") {
      if (isTyping(active)) return;
      if (current) {
        e.preventDefault();
        // dispara la acción real (link/botón) del elemento enfocado
        current.click();
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
})();
