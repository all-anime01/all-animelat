// ============================================================================
//  PWA  —  All-Anime
//  Hace la web instalable como app (Android / iOS / escritorio): inyecta el
//  manifest y las metas necesarias en TODAS las páginas, registra el service
//  worker y muestra un botón flotante "Instalar app".
// ============================================================================

function injectHead() {
  const add = (tag, attrs) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  };
  if (!document.querySelector('link[rel="manifest"]')) add("link", { rel: "manifest", href: "/manifest.webmanifest" });
  if (!document.querySelector('meta[name="theme-color"]')) add("meta", { name: "theme-color", content: "#0d1117" });
  if (!document.querySelector('meta[name="mobile-web-app-capable"]')) add("meta", { name: "mobile-web-app-capable", content: "yes" });
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
  if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) add("meta", { name: "apple-mobile-web-app-title", content: "All-Anime" });
  if (!document.querySelector('link[rel="apple-touch-icon"]')) add("link", { rel: "apple-touch-icon", href: "/image/logo.png" });
}

function injectStyles() {
  if (document.getElementById("pwa-styles")) return;
  const s = document.createElement("style");
  s.id = "pwa-styles";
  s.textContent = `
    #pwa-install{position:fixed;right:16px;bottom:16px;z-index:5000;display:none;align-items:center;gap:9px;
      padding:12px 18px;border-radius:40px;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;
      color:#fff;background:linear-gradient(135deg,#ca3030,#e23b3b);box-shadow:0 10px 30px rgba(202,48,48,.45);
      transition:transform .15s ease,filter .15s ease}
    #pwa-install:hover{transform:translateY(-2px);filter:brightness(1.08)}
    #pwa-install.show{display:inline-flex;animation:pwa-pop .3s ease}
    #pwa-install .pwa-x{margin-left:2px;opacity:.85}
    @keyframes pwa-pop{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
    @media (display-mode:standalone){#pwa-install{display:none!important}}
    /* Botón de descarga de la APK (Android / Fire TV) */
    #apk-install{position:fixed;right:16px;bottom:72px;z-index:5000;display:none;align-items:center;gap:9px;
      padding:12px 18px;border-radius:40px;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;
      color:#fff;background:linear-gradient(135deg,#1f6feb,#3b82f6);box-shadow:0 10px 30px rgba(31,111,235,.45);
      text-decoration:none;transition:transform .15s ease,filter .15s ease}
    #apk-install:hover{transform:translateY(-2px);filter:brightness(1.08)}
    #apk-install.show{display:inline-flex;animation:pwa-pop .3s ease}
    #apk-install .pwa-x{margin-left:2px;opacity:.85}
    html.aa-tv #apk-install{font-size:20px;padding:16px 26px;right:max(3vw,24px);bottom:max(4vh,24px)}`;
  document.head.appendChild(s);
}

export function initPWA() {
  injectHead();
  injectStyles();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  // Botón de instalación (Android / escritorio: usa beforeinstallprompt).
  let deferred = null;
  const btn = document.createElement("button");
  btn.id = "pwa-install";
  btn.innerHTML = '<i class="fas fa-download"></i> Instalar app <span class="pwa-x" title="Ocultar">&times;</span>';
  const mount = () => { if (!btn.isConnected && document.body) document.body.appendChild(btn); };
  document.addEventListener("DOMContentLoaded", mount); mount();

  btn.addEventListener("click", async (e) => {
    if (e.target.classList.contains("pwa-x")) { btn.classList.remove("show"); return; }
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (_) {}
    deferred = null;
    btn.classList.remove("show");
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    if (sessionStorage.getItem("pwaDismissed")) return;
    mount();
    btn.classList.add("show");
  });
  window.addEventListener("appinstalled", () => { btn.classList.remove("show"); deferred = null; });

  // --- Descarga de la APK para Android / Fire TV ---------------------------
  // En dispositivos Android (incluye Fire TV, que es Android) se ofrece la app
  // instalable (APK). En escritorio el usuario tiene la PWA (botón de arriba).
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isFireTV = /AFT[A-Z0-9]|Fire\s?TV|Silk/i.test(ua);
  const inApp = /AllAnimeTV/i.test(ua) || window.matchMedia("(display-mode: standalone)").matches;
  if ((isAndroid || isFireTV) && !inApp) {
    const apk = document.createElement("a");
    apk.id = "apk-install";
    apk.href = "/descargas/All-Anime-TV.apk";
    apk.setAttribute("download", "All-Anime-TV.apk");
    apk.innerHTML = '<i class="fas fa-tv"></i> Descargar app (Android / Fire TV) <span class="pwa-x" title="Ocultar">&times;</span>';
    const mountApk = () => { if (!apk.isConnected && document.body) document.body.appendChild(apk); };
    document.addEventListener("DOMContentLoaded", mountApk); mountApk();
    apk.addEventListener("click", (e) => {
      if (e.target.classList.contains("pwa-x")) { e.preventDefault(); apk.classList.remove("show"); try { sessionStorage.setItem("apkDismissed", "1"); } catch {} }
    });
    if (!sessionStorage.getItem("apkDismissed")) setTimeout(() => apk.classList.add("show"), 1200);
  }
}
