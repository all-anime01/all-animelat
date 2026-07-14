// ============================================================================
//  DONACIONES  —  All-Anime  (PayPal)
//  Botón flotante + enlace en el pie para que el público apoye el mantenimiento
//  de la página. El dinero llega directo a TU cuenta de PayPal mediante un
//  enlace PayPal.me (no requiere backend ni comisiones de plataforma).
//
//  CONFIGURA UNA DE ESTAS DOS OPCIONES (con cualquiera funciona el botón):
//   A) PAYPAL_ME  = tu usuario de PayPal.me (recomendado, oculta tu email).
//        Crea el enlace gratis en https://www.paypal.me  (ej. paypal.me/bryan)
//        Aquí va solo el usuario, sin la URL:   PAYPAL_ME = "bryan"
//   B) PAYPAL_EMAIL = tu email de PayPal (funciona ya, sin crear PayPal.me;
//        usa el botón clásico de donaciones de PayPal). Nota: el email queda
//        visible en el código de la página (así funcionan los botones PayPal).
//  Con ambos vacíos, el botón no se muestra. Si pones los dos, gana PAYPAL_ME.
// ============================================================================

// >>> OPCIÓN A: usuario de PayPal.me (sin la parte paypal.me/) <<<
export const PAYPAL_ME = "";
// >>> OPCIÓN B: email de tu cuenta PayPal <<<
export const PAYPAL_EMAIL = "bryan101719@gmail.com";

// (Opcional) moneda y monto sugerido.
const SUGGESTED = ""; // ej. "3"; vacío = el donante elige el monto.
const CURRENCY = "USD";
const ITEM_NAME = "Donación para el mantenimiento de All-Anime";

function donateUrl() {
  const me = (PAYPAL_ME || "").trim().replace(/^.*paypal\.me\//i, "").replace(/^@/, "");
  if (me) {
    let url = "https://www.paypal.me/" + encodeURIComponent(me);
    if (SUGGESTED) url += "/" + encodeURIComponent(SUGGESTED) + CURRENCY;
    return url;
  }
  const email = (PAYPAL_EMAIL || "").trim();
  if (email && /@/.test(email)) {
    // Botón clásico de donaciones de PayPal (funciona con el email de la cuenta).
    const p = new URLSearchParams({ cmd: "_donations", business: email, currency_code: CURRENCY, item_name: ITEM_NAME });
    if (SUGGESTED) p.set("amount", SUGGESTED);
    return "https://www.paypal.com/donate?" + p.toString();
  }
  return "";
}

export function initDonations() {
  const url = donateUrl();
  if (!url) return; // sin usuario configurado → no se muestra nada
  if (document.getElementById("donate-fab")) return;

  // --- Botón flotante ---
  const fab = document.createElement("a");
  fab.id = "donate-fab";
  fab.href = url;
  fab.target = "_blank";
  fab.rel = "noopener noreferrer";
  fab.setAttribute("aria-label", "Apoya a All-Anime con una donación por PayPal");
  fab.innerHTML = '<i class="fas fa-heart"></i><span class="donate-fab-text">Apóyanos</span>';
  document.body.appendChild(fab);

  // --- Enlace en el pie (si existe un footer-nav) ---
  const footNav = document.querySelector(".footer-nav");
  if (footNav && !footNav.querySelector(".donate-foot")) {
    const a = document.createElement("a");
    a.className = "donate-foot";
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.innerHTML = '<i class="fas fa-heart"></i> Apóyanos / Donar';
    footNav.appendChild(a);
  }
}
