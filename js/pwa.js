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

  // ¿Estamos DENTRO de la app nativa (móvil o TV) o en una PWA instalada? En ese
  // caso NO se muestra ningún botón de "descargar/instalar app".
  const IN_APP = (typeof window.AAApp !== "undefined") ||   // puente de la app nativa
    /AllAnime(App|TV)/i.test(navigator.userAgent || "") ||
    window.matchMedia("(display-mode: standalone)").matches;

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
    if (IN_APP || sessionStorage.getItem("pwaDismissed")) return;   // dentro de la app: nunca
    mount();
    btn.classList.add("show");
  });
  window.addEventListener("appinstalled", () => { btn.classList.remove("show"); deferred = null; });

  // --- Descarga de la APK para Android / Fire TV ---------------------------
  // En dispositivos Android (incluye Fire TV, que es Android) se ofrece la app
  // instalable (APK). En escritorio el usuario tiene la PWA (botón de arriba).
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  // MISMA app de TV para Fire TV, Android TV, Google TV y cualquier smart TV Android.
  const isFireTV = /AFT[A-Z0-9]|Fire\s?TV|Silk|SmartTV|Smart-TV|Google ?TV|Android ?TV|BRAVIA|AOSP|Web0S|WebOS|Tizen|VIDAA/i.test(ua);
  const inApp = IN_APP;
  if ((isAndroid || isFireTV) && !inApp) {
    // TV (Fire TV / Android TV / Google TV) → app de TV; teléfono/tablet → app móvil.
    const forTV = isFireTV;
    const file = forTV ? "All-Anime-TV.apk" : "All-Anime-Android.apk";
    const label = forTV ? '<i class="fas fa-tv"></i> Descargar app (Smart TV)' : '<i class="fas fa-mobile-screen"></i> Descargar app (Android)';
    const absUrl = location.origin + "/descargas/" + file;
    const shortUrl = (location.host + "/descargas/" + file).replace(/^www\./, "");
    const apk = document.createElement("a");
    apk.id = "apk-install";
    apk.href = absUrl;
    if (!forTV) apk.setAttribute("download", file);   // móvil: descarga directa
    apk.setAttribute("target", "_blank");
    apk.setAttribute("rel", "noopener");
    apk.innerHTML = label + ' <span class="pwa-x" title="Ocultar">&times;</span>';
    const mountApk = () => { if (!apk.isConnected && document.body) document.body.appendChild(apk); };
    document.addEventListener("DOMContentLoaded", mountApk); mountApk();

    // Guía de instalación para Fire TV (Silk no instala APKs directo: se usa
    // la app "Downloader" con la URL). En móvil se descarga y se instala normal.
    function showFireTVHelp() {
      if (document.getElementById("apk-help")) return;
      const ov = document.createElement("div");
      ov.id = "apk-help";
      ov.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:24px";
      ov.innerHTML = `
        <div style="max-width:640px;background:#161b22;border:1px solid #30363d;border-radius:16px;padding:28px;color:#e6edf3;font-family:Roboto,sans-serif;text-align:center">
          <div style="font-size:40px">📺</div>
          <h2 style="font-family:Poppins,sans-serif;margin:8px 0 6px">Instalar en Fire TV</h2>
          <p style="color:#9aa4b2;font-size:15px;margin:0 0 16px">El navegador del Fire TV no instala apps por sí solo. Hazlo así:</p>
          <ol style="text-align:left;color:#cdd5df;font-size:15px;line-height:1.7;margin:0 auto 16px;max-width:520px">
            <li>Instala la app gratuita <b>Downloader</b> desde la tienda del Fire TV.</li>
            <li>En Ajustes → Mi Fire TV → Opciones de desarrollador, activa <b>Instalar apps desconocidas</b> para Downloader.</li>
            <li>Abre <b>Downloader</b> y escribe esta dirección:</li>
          </ol>
          <div style="background:#0d1117;border:1px dashed #3b82f6;border-radius:10px;padding:14px;font-size:18px;font-weight:700;color:#60a5fa;word-break:break-all">${shortUrl}</div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px">
            <a href="${absUrl}" target="_blank" rel="noopener" style="background:#1f6feb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:40px;font-weight:700">Intentar descargar aquí</a>
            <button id="apk-help-close" style="background:#30363d;color:#fff;border:none;padding:12px 20px;border-radius:40px;font-weight:700;cursor:pointer">Cerrar</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      const close = () => ov.remove();
      ov.querySelector("#apk-help-close").addEventListener("click", close);
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    }

    apk.addEventListener("click", (e) => {
      if (e.target.classList.contains("pwa-x")) { e.preventDefault(); apk.classList.remove("show"); try { sessionStorage.setItem("apkDismissed", "1"); } catch {} return; }
      if (forTV) { e.preventDefault(); showFireTVHelp(); }
      // en móvil: deja que el enlace descargue el APK normalmente
    });
    if (!sessionStorage.getItem("apkDismissed")) setTimeout(() => apk.classList.add("show"), 1200);
  }
}
