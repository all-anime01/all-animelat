// ============================================================================
//  HERO / PORTADA  —  All-Anime
//  Carrusel principal controlable desde el admin (Firestore config/hero) con
//  transición imagen → video (tráiler de Cloudinary) estilo Netflix.
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DELAY_TO_VIDEO = 6000; // ms mostrando la imagen antes de pasar al tráiler
const SLIDE_INTERVAL = 9000;

// Slides por defecto de la portada (los que trae el sitio de fábrica).
// El admin los muestra y puede editarlos/guardarlos para tomar control.
export const DEFAULT_HERO_SLIDES = [
  { title: "Jujutsu Kaisen", logoImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480/CurationAssets/JUJUTSU%20KAISEN%20/SEASON%203/ULTRA-WIDE/JujutsuKaisen-S3-UW-Logo-EN.png", desktopImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=94,width=1920/CurationAssets/JUJUTSU%20KAISEN%20/SEASON%203/ULTRA-WIDE/JujutsuKaisen-S3-KV2-UW-LTR.png", mobileImg: "https://res.cloudinary.com/drvdc5bhz/image/upload/v1769811103/G5LOK5lXsAEX9nw_aa1qgr.jpg", video: "", meta: "+16 · Sub | Dob", description: "JUJUTSU KAISEN es un manga con historia y dibujo de Gege Akutami. Actualmente hay varias temporadas del anime, comenzando con la primera...", link: "anime-details.html?id=jujutsu-kaisen" },
  { title: "Hell's Paradise", logoImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480/CurationAssets/Hell's%20Paradise/SEASON%202/ULTRA-WIDE/HellsParadise-S2-UW-Logo-ENG.png", desktopImg: "https://res.cloudinary.com/drvdc5bhz/image/upload/v1769973943/HellsParadise-S2-KV1-Character-UW-LTR_jg0unz.avif", mobileImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/d0e301af2d2589ca633a0acf43216311.png", video: "", meta: "+16 · Sub | Dob", description: "Gabimaru el Vacío es uno de los asesinos más despiadados. Una traición lo condena a muerte y solo le queda una opción para sobrevivir...", link: "anime-details.html?id=hells-paradise-jigokuraku" },
  { title: "Lord of Mysteries", logoImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480/CurationAssets/Lord%20of%20Mysteries/SEASON%201/ULTRA-WIDE/LordOfMysteries-S1C1-KV1-UW-Logo-ENG.png", desktopImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=94,width=1920/CurationAssets/Lord%20of%20Mysteries/SEASON%201/ULTRA-WIDE/LordOfMysteries-S1C1-KV1-UW-LTR.png", mobileImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=1920/keyart/GEXH3W2EZ-backdrop_wide", video: "", meta: "+14 · Subtitulado", description: "En un mundo victoriano de vapor y horrores ocultos, Zhou Mingrui despierta como Klein Moretti, entre la luz y la oscuridad.", link: "anime-details.html?id=Lord-of-Mysteries" },
  { title: "Gachiakuta", logoImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480/CurationAssets/Gachiakuta/SEASON%201/ULTRA-WIDE/Gachiakuta-S1C1-KV1-UW-Logo-ENG.png", desktopImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=94,width=1920/CurationAssets/Gachiakuta/SEASON%201/ULTRA-WIDE/Gachiakuta-S1C1-KV1-UW-LTR.png", mobileImg: "https://res.cloudinary.com/drvdc5bhz/image/upload/v1751832135/GP5HJ84P7-backdrop_wide_mfgf1g.avif", video: "", meta: "+12 · Sub | Dob", description: "En una ciudad flotante, a Ludo lo acusan de asesinato y lo arrojan al Abismo. Para sobrevivir deberá usar un nuevo poder y unirse a los Limpiadores.", link: "anime-details.html?id=gachiakuta" },
  { title: "To Your Eternity", logoImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480/CurationAssets/To%20Your%20Eternity/SEASON%203/ULTRA-WIDE/ToYourEternity-S3C1-UW-Logo-ENG.png", desktopImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=94,width=1920/CurationAssets/To%20Your%20Eternity/SEASON%203/ULTRA-WIDE/ToYourEternity-S3C1-KV1-(Character)-UW-LTR.png", mobileImg: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/d36ba3ddfdc50519d6ea24142de14170.jpg", video: "", meta: "+16 · Sub | Dob", description: "El \"orbe\" llegó a la Tierra: podía tomar cualquier forma y regenerarse. Se convirtió en roca, luego en lobo y finalmente en un chico.", link: "anime-details.html?id=to-your-eternity" },
];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Lee la configuración del hero desde Firestore.
export async function getHeroConfig() {
  if (!FIREBASE_CONFIGURED) return null;
  try {
    const snap = await getDoc(doc(db, "config", "hero"));
    if (snap.exists() && Array.isArray(snap.data().slides) && snap.data().slides.length) return snap.data().slides;
  } catch (e) { /* usa el fallback del HTML */ }
  return null;
}

function renderSlides(section, slides) {
  const html = slides.map((s, i) => `
    <div class="hero-slide${i === 0 ? " active" : ""}" data-desktop-img="${esc(s.desktopImg)}" data-mobile-img="${esc(s.mobileImg || s.desktopImg)}" data-video="${esc(s.video || "")}"
         style="background-image:url('${esc(s.desktopImg)}')">
      <video class="hero-video" muted loop playsinline preload="none"></video>
      <div class="hero-content">
        ${s.logoImg ? `<img src="${esc(s.logoImg)}" alt="${esc(s.title)}" class="hero-logo">`
                    : `<h1 class="hero-logo-text">${esc(s.title)}</h1>`}
        ${s.meta ? `<p class="hero-meta">${esc(s.meta)}</p>` : ""}
        ${s.description ? `<p class="hero-description">${esc(s.description)}</p>` : ""}
        <a href="${esc(s.link || "#")}" class="hero-button"><i class="fas fa-play"></i> VER AHORA</a>
      </div>
    </div>`).join("");
  section.innerHTML = html + `
    <div class="hero-arrows">
      <button class="hero-arrow prev" id="hero-prev"><i class="fas fa-chevron-left"></i></button>
      <button class="hero-arrow next" id="hero-next"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="hero-navigation"></div>`;
}

function initCarousel(section) {
  const slides = [...section.querySelectorAll(".hero-slide")];
  if (!slides.length) return;
  const nav = section.querySelector(".hero-navigation");
  const prevArrow = section.querySelector("#hero-prev");
  const nextArrow = section.querySelector("#hero-next");
  let current = 0;
  const total = slides.length;
  let interval = null, videoTimer = null;
  const isMobile = () => window.innerWidth <= 768;

  // Miniaturas de navegación
  if (nav) {
    nav.innerHTML = "";
    slides.forEach((_, i) => {
      const t = document.createElement("div");
      t.className = "nav-thumb" + (i === 0 ? " active" : "");
      t.addEventListener("click", () => { show(i); reset(); });
      nav.appendChild(t);
    });
  }

  function setBackgrounds() {
    slides.forEach((sl) => {
      const dk = sl.dataset.desktopImg, mb = sl.dataset.mobileImg;
      sl.style.backgroundImage = `url('${isMobile() && mb ? mb : dk}')`;
    });
  }
  function stopVideo(sl) {
    clearTimeout(videoTimer);
    const v = sl.querySelector(".hero-video");
    if (v) { v.classList.remove("playing"); try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {} }
  }
  function scheduleVideo(sl) {
    clearTimeout(videoTimer);
    const v = sl.querySelector(".hero-video");
    const url = sl.dataset.video;
    if (!v || !url || isMobile()) return;
    videoTimer = setTimeout(() => {
      v.src = url;
      v.play().then(() => v.classList.add("playing")).catch(() => {});
    }, DELAY_TO_VIDEO);
  }
  function show(i) {
    if (slides[current]) stopVideo(slides[current]);
    slides.forEach((s) => s.classList.remove("active"));
    if (nav) nav.querySelectorAll(".nav-thumb").forEach((t) => t.classList.remove("active"));
    slides[i].classList.add("active");
    if (nav) nav.querySelectorAll(".nav-thumb")[i]?.classList.add("active");
    current = i;
    if (prevArrow) prevArrow.classList.toggle("hidden", i === 0);
    scheduleVideo(slides[i]);
  }
  const next = () => show((current + 1) % total);
  function reset() { clearInterval(interval); interval = setInterval(next, SLIDE_INTERVAL); }

  if (nextArrow) nextArrow.addEventListener("click", () => { next(); reset(); });
  if (prevArrow) prevArrow.addEventListener("click", () => { show((current - 1 + total) % total); reset(); });
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(setBackgrounds, 200); });

  setBackgrounds();
  show(0);
  interval = setInterval(next, SLIDE_INTERVAL);
}

// Punto de entrada: monta el hero (dinámico desde Firestore o el del HTML).
export async function setupHero() {
  const section = document.querySelector(".hero-section");
  if (!section) return;
  const slides = (await getHeroConfig()) || DEFAULT_HERO_SLIDES;
  renderSlides(section, slides);
  initCarousel(section);
}
