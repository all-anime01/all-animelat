// ============================================================================
//  HERO / PORTADA  —  All-Anime
//  Carrusel principal controlable desde el admin (Firestore config/hero) con
//  transición imagen → video (tráiler de Cloudinary) estilo Netflix.
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DELAY_TO_VIDEO = 6000; // ms mostrando la imagen antes de pasar al tráiler
const SLIDE_INTERVAL = 9000;

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
  const html = slides.map((s) => `
    <div class="hero-slide" data-desktop-img="${esc(s.desktopImg)}" data-mobile-img="${esc(s.mobileImg || s.desktopImg)}" data-video="${esc(s.video || "")}"
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
  const slides = await getHeroConfig();
  if (slides) renderSlides(section, slides);
  initCarousel(section);
}
