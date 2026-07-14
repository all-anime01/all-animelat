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
  socialBarSrc: "https://pl30358311.effectivecpmnetwork.com/cf/a6/75/cfa675a2a58c7c2c579b07801b66706f.js",
  // (B) Native Banner: bloque nativo dentro del contenido (usa los .ad-slot).
  nativeBannerSrc: "https://pl30363041.effectivecpmnetwork.com/992fdc113b3f25751f3dc8f1b44721d7/invoke.js",
  nativeBannerKey: "992fdc113b3f25751f3dc8f1b44721d7",
  // (C) Popunder: abre una pestaña con publicidad. Máxima ganancia, pero molesto.
  popunderSrc: "https://pl30358310.effectivecpmnetwork.com/b6/9b/2a/b69b2a93a6ad48947bfeea27f00c50c8.js",
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
