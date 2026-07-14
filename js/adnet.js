// ============================================================================
//  RED PUBLICITARIA ALTERNATIVA  —  All-Anime  (Adsterra / Monetag / similares)
//  Para sitios de streaming de anime, donde Google AdSense suele rechazar.
//  Adsterra acepta este contenido, aprueba rápido y paga por PayPal.
//
//  CÓMO ACTIVARLO (después de registrarte en adsterra.com y crear tus unidades):
//   1) Social Bar  → copia el "Script URL" de la unidad y pégalo en socialBarSrc.
//   2) Native Banner → pega el invoke.js en nativeBannerSrc y el KEY en
//      nativeBannerKey (el KEY es lo que va en "container-KEY").
//   3) Popunder (opcional, más ganancia pero intrusivo) → popunderSrc.
//  Con los campos vacíos no se carga nada. Puedes usar solo los que quieras.
//
//  Nota: Adsterra entrega las URLs SIN https:  //dominio/...  — así están bien;
//  el navegador usa el mismo protocolo de la página (https).
// ============================================================================

export const ADNET = {
  // (A) Social Bar: barra/anuncio flotante. UN solo script para todo el sitio.
  socialBarSrc: "",     // ej. "//pl26000000.effectiveratecpm.com/ab/cd/ef/abcdef.js"
  // (B) Native Banner: bloque nativo dentro del contenido (usa los .ad-slot).
  nativeBannerSrc: "",  // el invoke.js, ej. "//pl26000000.effectivegatecpm.com/KEY/invoke.js"
  nativeBannerKey: "",  // el KEY (lo que va en id="container-KEY")
  // (C) Popunder (opcional): abre una pestaña con publicidad. Máxima ganancia,
  //     pero molesto. Déjalo vacío para no usarlo.
  popunderSrc: "",
};

function injectScript(src, extra = {}) {
  if (!src) return;
  // evita duplicar el mismo script
  if ([...document.scripts].some((s) => s.src && s.src.includes(src.replace(/^https?:/, "")))) return;
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  s.setAttribute("data-cfasync", "false");
  Object.entries(extra).forEach(([k, v]) => s.setAttribute(k, v));
  document.body.appendChild(s);
}

export function initAdnet() {
  const cfg = ADNET;
  const has = (cfg.socialBarSrc || cfg.nativeBannerSrc || cfg.popunderSrc || "").trim();
  if (!has) {
    // Sin red configurada → oculta los espacios para no dejar huecos.
    document.querySelectorAll(".ad-slot").forEach((el) => el.closest(".ad-container")?.setAttribute("data-ad-inactive", "1"));
    return;
  }
  // (A) Social Bar y (C) Popunder: scripts únicos en todo el sitio.
  injectScript(cfg.socialBarSrc);
  injectScript(cfg.popunderSrc);

  // (B) Native Banner: se muestra en el PRIMER .ad-slot de la página.
  if (cfg.nativeBannerSrc && cfg.nativeBannerKey) {
    const slot = document.querySelector(".ad-slot");
    if (slot && !slot.dataset.filled) {
      slot.dataset.filled = "1";
      const cont = document.createElement("div");
      cont.id = "container-" + cfg.nativeBannerKey;
      slot.appendChild(cont);
      injectScript(cfg.nativeBannerSrc);
    }
  } else {
    // Sin native banner → oculta los .ad-slot vacíos (Social Bar/Popunder no los usan).
    document.querySelectorAll(".ad-slot").forEach((el) => el.closest(".ad-container")?.setAttribute("data-ad-inactive", "1"));
  }
}
