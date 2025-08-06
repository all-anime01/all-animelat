// --- FUNCIÓN MODIFICADA PARA CARGA DE 4 SEGUNDOS ---
function go_to_player(url) {
  const playerDisplay = document.getElementById("PlayerDisplay");
  const displayVideo = document.querySelector(".DisplayVideo");
  let loadingOverlay = document.getElementById("loadingOverlay");

  // Crear overlay si no existe
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loadingOverlay";
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = `<div class="spinner"></div><p>Cargando servidor...</p>`;
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
    displayVideo.innerHTML = `
      <span id="backToPlayers" onclick="listPlayer();"></span>
      <iframe 
          id="IFR" 
          src="${url}" 
          frameborder="0" 
          allowfullscreen="true" 
          webkitallowfullscreen="true" 
          mozallowfullscreen="true"
          onload="this.dataset.loaded = 'true';">
      </iframe>`;

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

  // Lógica para mostrar/ocultar el botón de volver
  let idleTimer = null;
  let idleState = false;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  let timeShow = isMobile ? 10000 : 5000;

  function showFoo(time) {
    const elem = document.getElementById("backToPlayers");
    const ifr = document.getElementById("IFR");
    if (!elem || !ifr) return;
    if (idleState) {
      elem.className = "";
      ifr.className = "";
    }
    clearTimeout(idleTimer);
    idleState = false;
    idleTimer = setTimeout(() => {
      elem.className = "inactive";
      ifr.className = "nopoints";
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
