// ============================================================================
//  BLOQUEADOR DE ANUNCIOS (escudo por video)
//  Los reproductores son de servidores externos (streamwish, filemoon, etc.)
//  y no podemos tocar su DOM (otro origen). Pero SÍ podemos neutralizar la
//  publicidad más molesta —popups, popunders y redirecciones— aislando el
//  iframe con `sandbox` (sin allow-popups ni allow-top-navigation). Un botón
//  escudo permite activarlo/desactivarlo por si algún servidor lo necesita.
// ============================================================================
let AA_currentUrl = null;
function aaAdBlockOn() { return localStorage.getItem("aaBlockAds") !== "0"; } // por defecto ACTIVO
const AA_SHIELD_SVG =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path class="aa-check" d="M9 12l2 2 4-4"></path></svg>';

function aaIframeMarkup(url) {
  const block = aaAdBlockOn();
  // allow-scripts+allow-same-origin: el player funciona; se OMITE allow-popups
  // y allow-top-navigation → no puede abrir pestañas ni redirigir la página.
  const sandbox = block ? ' sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock"' : '';
  return `
      <span id="backToPlayers" onclick="listPlayer();"></span>
      <button id="adShield" class="${block ? "on" : "off"}" onclick="toggleAdShield();"
              title="${block ? "Publicidad bloqueada — clic para desactivar" : "Bloqueo desactivado — clic para activar"}">
        ${AA_SHIELD_SVG}<em>${block ? "Anuncios bloqueados" : "Bloqueo desactivado"}</em>
      </button>
      <iframe
          id="IFR"
          src="${url}"${sandbox}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          frameborder="0"
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true"
          onload="this.dataset.loaded = 'true';">
      </iframe>`;
}

function toggleAdShield() {
  localStorage.setItem("aaBlockAds", aaAdBlockOn() ? "0" : "1");
  if (AA_currentUrl) go_to_player(AA_currentUrl); // recarga el servidor con el nuevo ajuste
}

// --- FUNCIÓN MODIFICADA PARA CARGA DE 4 SEGUNDOS ---
function go_to_player(url) {
  AA_currentUrl = url;
  const playerDisplay = document.getElementById("PlayerDisplay");
  const displayVideo = document.querySelector(".DisplayVideo");
  let loadingOverlay = document.getElementById("loadingOverlay");

  // Crear overlay si no existe
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loadingOverlay";
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = `<div class="spinner"></div><p>Cargando servidor…</p>`;
    if (playerDisplay) playerDisplay.prepend(loadingOverlay);
  }

  // Mostrar animación
  if (playerDisplay) playerDisplay.classList.add("is-loading");
  if (displayVideo) {
    displayVideo.classList.add("DisplayVideoA");
    displayVideo.style.zIndex = "9999";
  }

  // Lógica para asegurar 4 segundos de carga
  const timerPromise = new Promise((resolve) => setTimeout(resolve, 4000));
  const iframeLoadPromise = new Promise((resolve) => {
    displayVideo.innerHTML = aaIframeMarkup(url);

    // Verificar si el iframe cargó
    const checkIframe = setInterval(() => {
      const iframe = document.getElementById("IFR");
      if (iframe && iframe.dataset.loaded === "true") {
        clearInterval(checkIframe);
        resolve();
      }
    }, 100);
  });

  // Ocultar la animación solo cuando ambas promesas se cumplen
  Promise.all([timerPromise, iframeLoadPromise]).then(() => {
    if (playerDisplay) playerDisplay.classList.remove("is-loading");
  });

  // Lógica para mostrar/ocultar los controles (volver + escudo)
  let idleTimer = null;
  let idleState = false;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  let timeShow = isMobile ? 10000 : 5000;

  function showFoo(time) {
    const elem = document.getElementById("backToPlayers");
    const ifr = document.getElementById("IFR");
    const shield = document.getElementById("adShield");
    if (!elem || !ifr) return;
    if (idleState) {
      elem.className = "";
      ifr.className = "";
      if (shield) shield.classList.remove("inactive");
    }
    clearTimeout(idleTimer);
    idleState = false;
    idleTimer = setTimeout(() => {
      elem.className = "inactive";
      ifr.className = "nopoints";
      if (shield) shield.classList.add("inactive");
      idleState = true;
    }, time);
  }
  showFoo(timeShow);
  document.addEventListener("click", () => showFoo(timeShow));
  document.addEventListener("mousemove", () => showFoo(timeShow));
}

// --- RESTO DE FUNCIONES ORIGINALES (SIN CAMBIOS) ---
function listPlayer() {
  const displayVideo = document.querySelector(".DisplayVideo");
  const playerDisplay = document.getElementById("PlayerDisplay");

  if (displayVideo) {
    displayVideo.classList.remove("DisplayVideoA");
    displayVideo.style.zIndex = "1";
    displayVideo.innerHTML = "";
  }
  if (playerDisplay) {
    playerDisplay.classList.remove("is-loading");
  }
}

function CrearSuperCookie(key, value, ttl) {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + ttl * 60000,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function obtenerSuperCookie(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) {
    return null;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}

const msj = document.getElementById("msjad");
if (msj && obtenerSuperCookie("msjad") == null) {
  msj.style.display = "flex";
} else if (msj) {
  msj.style.display = "none";
}

function hideMsj(time = 0) {
  if (msj) {
    CrearSuperCookie("msjad", true, time * 60);
    msj.style.display = "none";
  }
}

function SelLang(who, id) {
  const firstLoad = document.querySelector(".FirstLoad");
  if (firstLoad) firstLoad.classList.add("FirstLoadA");

  const sldA = document.querySelector(".SLD_A");
  if (sldA) {
    sldA.classList.remove("SLD_A");
  }
  who.classList.add("SLD_A");

  setTimeout(function () {
    if (firstLoad) firstLoad.classList.remove("FirstLoadA");

    const reactiv = document.querySelector(".REactiv");
    if (reactiv) {
      reactiv.classList.remove("REactiv");
    }

    const odId = document.querySelector(".OD_" + id);
    if (odId) odId.classList.add("REactiv");
  }, 300);
}
