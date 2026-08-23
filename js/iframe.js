// ============================================================================
//  REPRODUCTOR (frame/player.html)
//  - Carga el servidor externo en un iframe SIN sandbox (así ningún servidor
//    queda bloqueado; se quitó el "escudo" que impedía reproducir en algunos).
//  - Embed de YouTube con controles completos (calidad, volumen, pantalla
//    completa) vía enablejsapi.
//  - REANUDACIÓN: guarda la posición del video por episodio+servidor y la
//    restaura al volver. En YouTube es exacta (API); en otros servidores es
//    "lo mejor posible" con el fragmento de tiempo (#t=), pues son de otro
//    origen y su reproductor no se puede leer/controlar.
// ============================================================================
let AA_currentUrl = null;

// --- Reanudación --------------------------------------------------------------
const AA_Q = new URLSearchParams(location.search);
const AA_EPKEY = `aa_pos_${AA_Q.get("a")}_${AA_Q.get("s")}_${AA_Q.get("e")}`;
const AA_track = { url: null, timer: null, base: 0, t0: 0, isYT: false };

function ytIdFrom(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function hostKey(url) { try { return new URL(url, location.href).host.replace(/[^a-z0-9]/gi, ""); } catch { return "x"; } }

// Puente con la APP nativa (Fire TV / Android TV / Android).
function aaBridge() { try { return window.AAApp || (window.top && window.top.AAApp) || null; } catch { return null; } }
// Hosts que SÍ se ven bien dentro de la WebView (no necesitan el reproductor nativo):
// YouTube y PelisPlus/PelisPlusHD. El resto (Filemoon, Streamwish, VOE, Vidara,
// VidHide…) quedan en negro en la WebView → los reproduce el nativo (ExoPlayer).
function aaWebViewFriendly(url) {
  const u = String(url || "").toLowerCase();
  // embed69/PelisPlus tienen su PROPIO reproductor que SÍ se ve en la WebView (hacen
  // la extracción del lado del servidor). Mega usa streams cifrados que ExoPlayer no
  // puede reproducir, así que también va por su iframe. Ninguno va por el nativo.
  return !!ytIdFrom(url) || u.includes("pelisplus") || u.includes("pelisplushd")
      || u.includes("embed69") || u.includes("mega.nz") || u.includes("mega.co");
}
// Pantalla propia de "All-Anime TV" mientras el nativo extrae (así NUNCA se ve el
// reproductor en negro del server por detrás). Si el nativo no logra el video,
// el usuario ve el mensaje y prueba otro servidor.
function aaNativeMarkup() {
  return `
      <span id="backToPlayers" onclick="listPlayer();"></span>
      <div class="aa-native-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;color:#fff;text-align:center;gap:14px;padding:20px;">
        <div class="spinner"></div>
        <p style="margin:0;font-size:1.05rem;font-weight:600;">Reproduciendo en All-Anime TV…</p>
        <p style="margin:0;opacity:.7;font-size:.9rem;">Si no carga en unos segundos, prueba otro servidor.</p>
      </div>`;
}
function posKey(url) { return AA_EPKEY + "_" + hostKey(url); }
function savedPos(url) { try { return parseInt(localStorage.getItem(posKey(url)) || "0", 10) || 0; } catch { return 0; } }
function savePos(url, sec) { try { if (sec > 5) localStorage.setItem(posKey(url), String(Math.floor(sec))); } catch {} }

// Construye el src del iframe aplicando la posición guardada y, en YouTube, los
// controles completos + la API de JS (para leer/guardar el tiempo real).
function buildSrc(url) {
  const pos = savedPos(url);
  const yid = ytIdFrom(url);
  if (yid) {
    const params = new URLSearchParams({
      autoplay: "1", controls: "1", fs: "1", rel: "0", modestbranding: "1",
      iv_load_policy: "3", playsinline: "1", enablejsapi: "1", origin: location.origin,
    });
    if (pos > 5) params.set("start", String(pos));
    return `https://www.youtube.com/embed/${yid}?${params.toString()}`;
  }
  // Otros servidores: se carga la URL TAL CUAL. Antes se le añadía `#t=segundos`
  // para intentar reanudar, pero varios reproductores (p. ej. Vidara) se quedaban
  // en negro con ese fragmento; la reanudación exacta solo es fiable en YouTube.
  return url;
}

// Recibe el tiempo real desde el iframe de YouTube (enablejsapi) y lo guarda.
window.addEventListener("message", (e) => {
  if (!/youtube\.com$/.test((() => { try { return new URL(e.origin).host; } catch { return ""; } })())) return;
  let d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
  if (d && d.event === "infoDelivery" && d.info && typeof d.info.currentTime === "number") {
    if (AA_track.url && AA_track.isYT) savePos(AA_track.url, d.info.currentTime);
  }
});

function stopTracking() {
  if (AA_track.timer) { clearInterval(AA_track.timer); AA_track.timer = null; }
  AA_track.url = null;
}
function startTracking(url, iframe) {
  stopTracking();
  AA_track.url = url;
  AA_track.isYT = !!ytIdFrom(url);
  // Solo se sigue/guarda la posición en YouTube (los demás son de otro origen y
  // no se pueden leer/controlar; además meterles un tiempo los dejaba en negro).
  if (AA_track.isYT) {
    const ping = () => { try { iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "IFR", channel: "widget" }), "*"); } catch {} };
    setTimeout(ping, 800); setTimeout(ping, 2500);
    AA_track.timer = setInterval(ping, 5000);
  }
}

function resumeToast(url) {
  if (!ytIdFrom(url)) return;   // la reanudación solo aplica a YouTube
  const pos = savedPos(url);
  if (pos <= 15) return;
  const mm = String(Math.floor(pos / 60)).padStart(2, "0");
  const ss = String(Math.floor(pos % 60)).padStart(2, "0");
  const t = document.createElement("div");
  t.className = "aa-resume-toast";
  t.innerHTML = `<i class="fas fa-clock-rotate-left"></i> Reanudando desde ${mm}:${ss}`;
  const dv = document.querySelector(".DisplayVideo");
  if (dv) dv.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

function aaIframeMarkup(url) {
  // SIN sandbox (permanente): algunos servidores fallaban/daban 404 y el video no
  // cargaba cuando se aislaba el iframe. El reproductor del server carga libre.
  // (El bloqueo de anuncios emergentes para quienes pagan/tienen adFree se maneja
  //  en las APPS nativas vía onCreateWindow, sin afectar la reproducción.)
  return `
      <span id="backToPlayers" onclick="listPlayer();"></span>
      <iframe
          id="IFR"
          src="${buildSrc(url)}"
          allow="autoplay; fullscreen *; encrypted-media; picture-in-picture; clipboard-write; gyroscope"
          frameborder="0"
          allowfullscreen="true"
          webkitallowfullscreen="true"
          mozallowfullscreen="true"
          scrolling="no"
          onload="this.dataset.loaded = 'true';">
      </iframe>`;
}

// --- FUNCIÓN MODIFICADA PARA CARGA DE 4 SEGUNDOS ---
function go_to_player(url) {
  AA_currentUrl = url;
  // APP nativa: le pedimos que EXTRAIGA y reproduzca el video en ExoPlayer (la WebView
  // deja estos hosts en negro). Si la app logra extraer, superpone su reproductor; si
  // no puede, no pasa nada y queda este iframe de respaldo. En web/escritorio no existe
  // el puente, así que solo se usa el iframe de siempre.
  // ¿Modo NATIVO? Solo en la app y solo para hosts directos (no YouTube ni PelisPlus).
  // En ese modo NO se carga el iframe del server (evita ver su reproductor en negro
  // detrás): la app extrae y reproduce en ExoPlayer; aquí solo se ve la pantalla propia.
  const A = aaBridge();
  const nativeMode = !!(A && typeof A.playNative === "function" && !aaWebViewFriendly(url));
  try { if (nativeMode) A.playNative(url); } catch {}
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

  // MODO NATIVO: pantalla propia de All-Anime TV (sin iframe del server).
  if (nativeMode) {
    displayVideo.innerHTML = aaNativeMarkup();
    // El reproductor nativo tarda en extraer; ocultamos el spinner de "Cargando
    // servidor…" enseguida (la propia pantalla nativa ya indica el estado).
    setTimeout(() => { if (playerDisplay) playerDisplay.classList.remove("is-loading"); }, 800);
    let idleN = null, idleSN = false;
    const showN = (t) => { const el = document.getElementById("backToPlayers"); if (!el) return; if (idleSN) el.className = ""; clearTimeout(idleN); idleSN = false; idleN = setTimeout(() => { el.className = "inactive"; idleSN = true; }, t); };
    showN(5000);
    document.addEventListener("click", () => showN(5000));
    document.addEventListener("mousemove", () => showN(5000));
    return;
  }

  // Lógica para asegurar 4 segundos de carga
  const timerPromise = new Promise((resolve) => setTimeout(resolve, 4000));
  const iframeLoadPromise = new Promise((resolve) => {
    displayVideo.innerHTML = aaIframeMarkup(url);
    resumeToast(url);
    const iframe = document.getElementById("IFR");
    if (iframe) startTracking(url, iframe);

    // Verificar si el iframe cargó
    const checkIframe = setInterval(() => {
      const ifr = document.getElementById("IFR");
      if (ifr && ifr.dataset.loaded === "true") {
        clearInterval(checkIframe);
        resolve();
      }
    }, 100);
  });

  // Ocultar la animación solo cuando ambas promesas se cumplen
  Promise.all([timerPromise, iframeLoadPromise]).then(() => {
    if (playerDisplay) playerDisplay.classList.remove("is-loading");
    aaRepaintNudge();
  });

  // EMPUJÓN DE REPINTADO: en la WebView de Fire TV/Android el video se queda en
  // NEGRO hasta que un scroll lo repinta (por eso al bajar a la info aparece).
  // Le pedimos al documento padre (la ficha) que haga un micro-scroll varias veces
  // durante los primeros segundos (el video del server tarda en aparecer) para que
  // se pinte SOLO, sin que el usuario tenga que hacer scroll a mano.
  function aaRepaintNudge() {
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ aa: "repaint" }, "*"); } catch {}
    // App nativa: pide un GESTO DE SCROLL real (lo hace la app), que es lo único que
    // repinta el SurfaceView del video en la WebView de Fire TV.
    try { const A = window.top && window.top.AAApp; if (A && A.videoLoaded) A.videoLoaded(); } catch {}
  }
  [700, 1800, 3200, 5000, 7000].forEach((ms) => setTimeout(aaRepaintNudge, ms));

  // Lógica para mostrar/ocultar los controles (volver)
  let idleTimer = null;
  let idleState = false;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  let timeShow = isMobile ? 10000 : 5000;

  function showFoo(time) {
    const elem = document.getElementById("backToPlayers");
    const ifr = document.getElementById("IFR");
    if (!elem || !ifr) return;
    // NOTA: nunca se desactivan los clics del iframe (antes usaba "nopoints",
    // que impedía usar los controles del reproductor —incluida la pantalla
    // completa de StreamWish— y no se podía reactivar con el mouse sobre el
    // video, por ser de otro origen). Solo se oculta el botón "volver".
    if (idleState) elem.className = "";
    clearTimeout(idleTimer);
    idleState = false;
    idleTimer = setTimeout(() => {
      elem.className = "inactive";
      idleState = true;
    }, time);
  }
  showFoo(timeShow);
  document.addEventListener("click", () => showFoo(timeShow));
  document.addEventListener("mousemove", () => showFoo(timeShow));
}

// --- RESTO DE FUNCIONES ORIGINALES ---
function listPlayer() {
  stopTracking();
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
  const item = { value: value, expiry: now.getTime() + ttl * 60000 };
  localStorage.setItem(key, JSON.stringify(item));
}

function obtenerSuperCookie(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiry) { localStorage.removeItem(key); return null; }
  return item.value;
}

// Aviso "escudo antipublicidad" retirado: ya no se muestra.
const msj = document.getElementById("msjad");
if (msj) msj.style.display = "none";

function hideMsj(time = 0) {
  if (msj) { CrearSuperCookie("msjad", true, time * 60); msj.style.display = "none"; }
}

function SelLang(who, id) {
  const firstLoad = document.querySelector(".FirstLoad");
  if (firstLoad) firstLoad.classList.add("FirstLoadA");

  const sldA = document.querySelector(".SLD_A");
  if (sldA) sldA.classList.remove("SLD_A");
  who.classList.add("SLD_A");

  setTimeout(function () {
    if (firstLoad) firstLoad.classList.remove("FirstLoadA");
    const reactiv = document.querySelector(".REactiv");
    if (reactiv) reactiv.classList.remove("REactiv");
    const odId = document.querySelector(".OD_" + id);
    if (odId) odId.classList.add("REactiv");
  }, 300);
}
