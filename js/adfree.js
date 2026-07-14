// ============================================================================
//  "QUITAR PUBLICIDAD" (premium sin anuncios)  —  All-Anime
//  El usuario paga por PayPal y navega sin publicidad. Sin backend: el estado
//  se guarda en localStorage (síncrono, para poder NO cargar los scripts de
//  anuncios) y, si el usuario tiene sesión, se respalda en Firestore para que
//  le funcione en cualquier dispositivo.
//
//  CONFIGURA:  PAYPAL_CLIENT_ID  (de https://developer.paypal.com → Apps &
//  Credentials → crea una app "Live" → copia el Client ID). Con eso el botón de
//  pago PayPal funciona solo. PRICE = precio; DAYS = duración (0 = para siempre).
// ============================================================================
import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const PAYPAL_CLIENT_ID = ""; // <-- pega aquí tu Client ID de PayPal (Live)
const PRICE = "1.99";               // precio en USD
const DAYS = 30;                    // 30 días sin anuncios (pon 0 para "para siempre")
const CURRENCY = "USD";
const LS = "aa_adfree";

// --- Estado (síncrono) --------------------------------------------------------
export function isAdFree() {
  try {
    const v = localStorage.getItem(LS);
    if (v === "1") return true;                     // permanente
    const until = parseInt(v || "0", 10);
    if (until && Date.now() < until) return true;   // con vencimiento
    if (until) localStorage.removeItem(LS);         // expiró
    return false;
  } catch { return false; }
}
function setLocal(until) { try { localStorage.setItem(LS, until ? String(until) : "1"); } catch {} }

// Trae el estado desde Firestore al iniciar sesión (por si pagó en otro equipo).
export async function syncAdFree(uid) {
  if (!uid) return;
  try {
    const s = await getDoc(doc(db, "users", uid));
    const d = s.exists() ? s.data() : {};
    const until = d.adFreeUntil?.toDate ? d.adFreeUntil.toDate().getTime() : (d.adFree ? -1 : 0);
    if (until === -1) setLocal(null);                       // permanente
    else if (until && Date.now() < until) setLocal(until);  // vigente
    else { try { localStorage.removeItem(LS); } catch {} }  // sin plan / vencido
    reflectAds();
  } catch {}
}

// Concede el "sin publicidad" tras un pago aprobado.
export async function grantAdFree(uid) {
  const until = DAYS ? Date.now() + DAYS * 86400000 : 0;
  setLocal(until || null);
  if (uid) {
    try {
      await setDoc(doc(db, "users", uid), {
        adFree: !until, adFreeUntil: until ? new Date(until) : null, adFreeAt: serverTimestamp(),
      }, { merge: true });
    } catch {}
  }
}

// Oculta los contenedores de anuncios ya presentes (por si se compró en caliente).
function reflectAds() {
  if (!isAdFree()) return;
  document.querySelectorAll(".ad-container, #donate-fab").forEach((el) => { /* dona sí se queda */ });
  document.querySelectorAll(".ad-container").forEach((el) => el.remove());
  // Social Bar de Adsterra (barra flotante) — intenta ocultarla si ya cargó.
  document.querySelectorAll('iframe[src*="effectivecpmnetwork"], [id^="adsterra"]').forEach((el) => el.remove());
}

// --- UI: botón + modal con PayPal --------------------------------------------
let sdkLoading = null;
function loadPayPalSDK() {
  if (window.paypal) return Promise.resolve(true);
  if (!PAYPAL_CLIENT_ID) return Promise.resolve(false);
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=${CURRENCY}`;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return sdkLoading;
}

function openModal(getUid) {
  if (document.getElementById("adfree-modal")) return;
  const ov = document.createElement("div");
  ov.id = "adfree-modal";
  ov.className = "adfree-ov";
  ov.innerHTML = `
    <div class="adfree-box" role="dialog" aria-label="Quitar publicidad">
      <button class="adfree-x" aria-label="Cerrar">&times;</button>
      <div class="adfree-ic"><i class="fas fa-ban"></i></div>
      <h3>Navega sin publicidad</h3>
      <p>Apoya a All-Anime y disfruta del sitio <b>sin anuncios</b> durante ${DAYS ? DAYS + " días" : "siempre"}. El pago es seguro por <b>PayPal</b>.</p>
      <div class="adfree-price">$${PRICE} <span>${CURRENCY}</span></div>
      <div id="adfree-pay"></div>
      <p class="adfree-note" id="adfree-note"></p>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector(".adfree-x").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });

  const note = ov.querySelector("#adfree-note");
  loadPayPalSDK().then((ok) => {
    if (ok && window.paypal) {
      window.paypal.Buttons({
        style: { color: "gold", shape: "pill", label: "pay", height: 42 },
        createOrder: (data, actions) => actions.order.create({ purchase_units: [{ amount: { value: PRICE }, description: "All-Anime sin publicidad" }] }),
        onApprove: async (data, actions) => {
          try { await actions.order.capture(); } catch {}
          await grantAdFree(getUid());
          note.textContent = "¡Listo! Gracias por tu apoyo. Recargando sin anuncios…";
          setTimeout(() => location.reload(), 1500);
        },
        onError: () => { note.textContent = "Hubo un problema con el pago. Intenta de nuevo."; },
      }).render("#adfree-pay");
    } else {
      // Sin Client ID configurado → aviso.
      note.innerHTML = "El pago aún no está disponible. (Falta configurar PayPal.)";
    }
  });
}

export function initRemoveAdsUI() {
  if (isAdFree()) { reflectAds(); return; } // ya no muestra el botón si no hay ads
  let getUid = () => (window.__aaUid || null);
  // Enlace en el pie
  const footNav = document.querySelector(".footer-nav");
  if (footNav && !footNav.querySelector(".adfree-foot")) {
    const a = document.createElement("a");
    a.href = "#"; a.className = "adfree-foot";
    a.innerHTML = '<i class="fas fa-ban"></i> Quitar publicidad';
    a.addEventListener("click", (e) => { e.preventDefault(); openModal(getUid); });
    footNav.appendChild(a);
  }
}

// Permite a main-2025 pasar el uid actual (para respaldar el pago en Firestore).
export function setAdFreeUid(uid) { window.__aaUid = uid || null; }

// Abre el modal de compra desde cualquier lugar (ej. el menú de cuenta).
export function openRemoveAds() { if (!isAdFree()) openModal(() => window.__aaUid || null); }
