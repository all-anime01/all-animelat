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
    /* Márgenes seguros para pantallas con overscan */
    html.aa-tv .main-content, html.aa-tv .container { padding-left: max(3vw, 24px); padding-right: max(3vw, 24px); }
    html.aa-tv header.scrolled, html.aa-tv .header { padding-left: max(3vw, 24px); padding-right: max(3vw, 24px); }
    /* Oculta el cursor cuando se navega por D-pad */
    html.aa-tv.aa-dpad, html.aa-tv.aa-dpad * { cursor: none !important; }
  `;
  (document.head || root).appendChild(st);

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
  const focusables = () => {
    const scope = activeScope();
    return Array.prototype.filter.call(scope.querySelectorAll(SEL), visible).map(ensureFocusable);
  };

  let current = null;
  function setFocus(el, scroll) {
    if (!el) return;
    if (current && current !== el) current.classList.remove("aa-focus");
    current = el;
    el.classList.add("aa-focus");
    try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
    if (scroll !== false) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }

  const isTyping = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== "button" && el.type !== "submit";

  // --- Navegación espacial: mejor candidato en una dirección -----------------
  function best(dir) {
    const list = focusables();
    if (!list.length) return null;
    const cur = current && list.includes(current) ? current : null;
    if (!cur) return list[0];
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
      const score = primary + cross * 2;          // prioriza alineación en el eje cruzado
      if (score < bestScore) { bestScore = score; winner = el; }
    }
    return winner;
  }

  function onKey(e) {
    const k = e.key;
    const active = document.activeElement;
    // Si se está escribiendo en un campo, deja que las flechas muevan el cursor
    // del texto (salvo arriba/abajo para poder salir del campo).
    if (isTyping(active) && (k === "ArrowLeft" || k === "ArrowRight")) return;

    if (k === "ArrowRight" || k === "ArrowLeft" || k === "ArrowUp" || k === "ArrowDown") {
      const dir = k === "ArrowRight" ? "right" : k === "ArrowLeft" ? "left" : k === "ArrowUp" ? "up" : "down";
      const next = best(dir);
      if (next) { e.preventDefault(); root.classList.add("aa-dpad"); setFocus(next); }
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
    const curOk = current && document.contains(current) && visible(current) &&
      (scope === document ? true : scope.contains(current));
    if (scopeChanged || !curOk) setTimeout(() => focusScope(scope), scope !== document ? 250 : 50);
  };
  let moT = null;
  const mo = new MutationObserver(() => { clearTimeout(moT); moT = setTimeout(resync, 120); });
  try { mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] }); } catch {}
})();
