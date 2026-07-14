// ============================================================================
//  PUBLICIDAD WEB  —  All-Anime  (Google AdSense)
//  IMPORTANTE: Firebase/AdMob es para apps MÓVILES; para una página web el
//  producto de Google para monetizar es Google AdSense. Rellena tu ID de
//  editor (ca-pub-…) abajo y, tras aprobar tu sitio en AdSense, los anuncios
//  aparecen solos en cada <div class="ad-slot">. Con el ID vacío, los espacios
//  quedan ocultos (no se muestra nada al público).
// ============================================================================

export const AD_CONFIG = {
  // 1) Pega aquí tu ID de editor de AdSense, p. ej. "ca-pub-1234567890123456".
  client: "ca-pub-7691106587507822",
  // 2) (Opcional) IDs de bloque de anuncio por posición; si los dejas vacíos,
  //    AdSense usa "Anuncios automáticos".
  // Se leen desde el atributo data-slot de cada .ad-slot en el HTML.
};

let scriptLoaded = false;
function loadAdSense(client) {
  // Si ya está el <script> estático de AdSense en el <head> (para verificación
  // del sitio y Auto Ads), no lo cargamos otra vez.
  if (scriptLoaded || document.querySelector('script[src*="adsbygoogle.js"]')) { scriptLoaded = true; return; }
  scriptLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client);
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

// Monta los anuncios en todos los .ad-slot de la página.
export function initAds() {
  const slots = [...document.querySelectorAll(".ad-slot")];
  if (!slots.length) return;
  const client = (AD_CONFIG.client || "").trim();
  if (!client) {
    // Sin ID configurado → oculta los espacios para no mostrar huecos vacíos.
    slots.forEach((el) => el.closest(".ad-container")?.setAttribute("data-ad-inactive", "1"));
    return;
  }
  loadAdSense(client);
  slots.forEach((el) => {
    if (el.dataset.filled) return;
    el.dataset.filled = "1";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", client);
    if (el.dataset.slot) ins.setAttribute("data-ad-slot", el.dataset.slot);
    ins.setAttribute("data-ad-format", el.dataset.format || "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* aún sin aprobar */ }
  });
}
