// ============================================================================
//  PUBLICIDAD — All-Anime
//  Un solo sitio donde se decide QUÉ red se carga, DÓNDE y CUÁNTO, según el
//  dispositivo. La idea: que el anuncio no estorbe nunca al que viene a ver.
//
//  Reglas que se cumplen siempre (no dependen de la configuración):
//   · Usuario sin anuncios (adFree) → no se carga NADA, ni un script.
//   · Dentro del reproductor → nunca. Ahí es donde más molesta y más gente se va.
//   · En TV (Fire TV, Android TV) → nunca formatos que roben el foco del mando:
//     un popunder o una barra flotante deja al usuario atrapado sin ratón.
//   · Los banners se cargan solo cuando el hueco entra en pantalla, así no
//     retrasan la primera carga de la página.
//   · El popunder, si se activa, tiene un tope por horas y por sesión.
//
//  Se configura desde el panel → «Publicidad» (Firestore: config/ads). Si no hay
//  configuración, valen los valores de abajo.
// ============================================================================

const LS_ADFREE = "aa_adfree";
const LS_POP = "aa_ads_pop";          // marca de tiempo del último popunder

// Por defecto: AdSense en escritorio y TV (solo banners), Adsterra en móvil.
const POR_DEFECTO = {
  activo: true,
  adsenseClient: "ca-pub-7691106587507822",   // ca-pub-…
  redes: { escritorio: "adsense", movil: "adsterra", tv: "adsense" },
  formatos: {                         // qué se permite en cada dispositivo
    escritorio: { banner: true, popunder: false, social: false },
    movil: { banner: true, popunder: true, social: false },
    tv: { banner: true, popunder: false, social: false },
  },
  adsterra: {   // el «src» de cada invoke.js que te da su panel
    banner: "//pl30363041.effectivecpmnetwork.com/992fdc113b3f25751f3dc8f1b44721d7/invoke.js",
    social: "", popunder: "",
  },
  popunderHoras: 12,                  // como mucho uno cada 12 h por visitante
  paginasSinAnuncios: ["frame/player.html", "cuenta.html", "perfil.html"],
};

let cfg = null;
let cargadas = new Set();

/** ¿Este visitante pagó por no ver anuncios? Se lee sincrónico a propósito. */
export function sinAnuncios() {
  try {
    const v = localStorage.getItem(LS_ADFREE);
    return v === "1" || (!!v && Date.now() < parseInt(v, 10));
  } catch { return false; }
}

/** «tv» | «movil» | «escritorio» */
export function dispositivo() {
  const ua = navigator.userAgent || "";
  if (document.documentElement.classList.contains("aa-tv") || /AllAnime(App|TV)/i.test(ua)
      || /AFT[BMNS]|BRAVIA|GoogleTV|Android TV|SMART-TV|Tizen|Web0S/i.test(ua)) return "tv";
  if (window.matchMedia("(max-width: 820px)").matches || /Android|iPhone|iPad|Mobile/i.test(ua)) return "movil";
  return "escritorio";
}

function enPaginaProhibida() {
  const ruta = location.pathname.toLowerCase();
  return (cfg.paginasSinAnuncios || []).some((p) => ruta.includes(String(p).toLowerCase()));
}

/** Carga la configuración del panel; si no hay, usa la de arriba. */
async function config() {
  if (cfg) return cfg;
  cfg = { ...POR_DEFECTO };
  try {
    const { db } = await import("./firebase-config.js");
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const s = await getDoc(doc(db, "config", "ads"));
    if (s.exists()) {
      const d = s.data() || {};
      cfg = {
        ...POR_DEFECTO, ...d,
        redes: { ...POR_DEFECTO.redes, ...(d.redes || {}) },
        formatos: { ...POR_DEFECTO.formatos, ...(d.formatos || {}) },
        adsterra: { ...POR_DEFECTO.adsterra, ...(d.adsterra || {}) },
      };
    }
  } catch { /* sin conexión: valen los valores por defecto */ }
  return cfg;
}

function script(src, attrs) {
  if (cargadas.has(src)) return;
  cargadas.add(src);
  const s = document.createElement("script");
  s.src = src; s.async = true; s.setAttribute("data-cfasync", "false");
  if (attrs) for (const k in attrs) s.setAttribute(k, attrs[k]);
  document.head.appendChild(s);
}

/** Permiso para un formato en el dispositivo actual. */
function permite(formato) {
  const d = dispositivo();
  const f = (cfg.formatos || {})[d] || {};
  if (d === "tv" && formato !== "banner") return false;    // regla dura: el mando manda
  return !!f[formato];
}

/** Banner en el hueco indicado. Se carga cuando el hueco se ve, no antes. */
export async function banner(el) {
  const nodo = typeof el === "string" ? document.getElementById(el) : el;
  if (!nodo || nodo.dataset.aaAd === "hecho") return;
  await config();
  if (!cfg.activo || sinAnuncios() || enPaginaProhibida() || !permite("banner")) return;
  const ver = () => {
    if (nodo.dataset.aaAd === "hecho") return;
    nodo.dataset.aaAd = "hecho";
    const red = (cfg.redes || {})[dispositivo()] || "adsense";
    if (red === "adsense" && cfg.adsenseClient) {
      script("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.adsenseClient),
             { crossorigin: "anonymous" });
      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.cssText = "display:block;min-height:90px";
      ins.setAttribute("data-ad-client", cfg.adsenseClient);
      if (nodo.dataset.slot) ins.setAttribute("data-ad-slot", nodo.dataset.slot);
      ins.setAttribute("data-ad-format", nodo.dataset.format || "auto");
      ins.setAttribute("data-full-width-responsive", "true");
      nodo.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    } else if (red === "adsterra" && cfg.adsterra.banner) {
      const cont = document.createElement("div");
      const id = (cfg.adsterra.banner.match(/([0-9a-f]{20,})\/invoke\.js/) || [])[1];
      if (id) cont.id = "container-" + id;
      nodo.appendChild(cont);
      script(cfg.adsterra.banner);
    }
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); ver(); } },
                                        { rootMargin: "200px" });
    io.observe(nodo);
  } else ver();
}

/** Popunder / barra social: solo donde está permitido y con tope de frecuencia. */
async function intrusivos() {
  await config();
  if (!cfg.activo || sinAnuncios() || enPaginaProhibida()) return;
  if (permite("social") && cfg.adsterra.social) script(cfg.adsterra.social);
  if (permite("popunder") && cfg.adsterra.popunder) {
    let ultimo = 0;
    try { ultimo = parseInt(localStorage.getItem(LS_POP) || "0", 10) || 0; } catch {}
    const horas = Number(cfg.popunderHoras) || 12;
    if (Date.now() - ultimo < horas * 3600 * 1000) return;   // aún no toca
    try { localStorage.setItem(LS_POP, String(Date.now())); } catch {}
    script(cfg.adsterra.popunder);
  }
}

/** Arranque: monta los huecos marcados con data-aa-ad y evalúa los intrusivos. */
export async function initAds() {
  if (sinAnuncios()) return;
  await config();
  if (!cfg.activo) return;
  document.querySelectorAll("[data-aa-ad]").forEach((el) => banner(el));
  // los intrusivos, tras el primer render, para no competir con la carga
  if (document.readyState === "complete") setTimeout(intrusivos, 1500);
  else window.addEventListener("load", () => setTimeout(intrusivos, 1500), { once: true });
}

export const _test = { dispositivo, permite, config, POR_DEFECTO };
