// ============================================================================
//  VISTAS DE CUENTA  —  All-Anime
//  Favoritos, Historial y Notificaciones (reutilizables en páginas propias).
// ============================================================================

import { listFavAnimes, listFavEpisodes, listHistory } from "./user-data.js";
import { getAnimeData } from "./data-provider.js";

export function injectAccountStyles() {
  if (document.getElementById("account-views-styles")) return;
  const s = document.createElement("style");
  s.id = "account-views-styles";
  s.textContent = `
  .av-tabs{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}
  .av-tab{background:#161616;border:1px solid #303030;color:#a0a0a0;padding:8px 16px;border-radius:20px;cursor:pointer;font-weight:600;font-size:13px}
  .av-tab.active{background:#ca3030;border-color:#ca3030;color:#fff}
  .av-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:14px}
  .av-a{text-decoration:none;color:#f0f0f0}
  .av-a img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:10px;background:#222;transition:transform .15s}
  .av-a:hover img{transform:translateY(-3px)}
  .av-a span{display:block;font-size:12.5px;margin-top:6px;line-height:1.3}
  .av-ep{display:flex;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid #262626;text-decoration:none;color:#f0f0f0}
  .av-ep img{width:104px;height:60px;object-fit:cover;border-radius:8px;background:#222;flex:none}
  .av-ep b{font-size:14px} .av-ep small{color:#a0a0a0;font-size:12px}
  .av-new{background:#ca3030;color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:8px;font-weight:700;letter-spacing:.5px}
  .av-empty{color:#a0a0a0;font-size:14px;padding:14px 0}
  .av-nsec{font-size:15px;color:#f0f0f0;margin:22px 0 8px;display:flex;align-items:center;gap:9px;font-weight:700}
  .av-nsec:first-child{margin-top:2px}
  .av-nsec i{color:#ca3030}
  .av-when{color:#777}
  /* Historial estilo Crunchyroll: tarjetas 16:9 con barra de progreso */
  .cr-hist{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px 16px}
  @media(max-width:600px){.cr-hist{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px 10px}}
  .cr-card{text-decoration:none;color:#f0f0f0;display:flex;flex-direction:column;gap:9px}
  .cr-thumb{position:relative;aspect-ratio:16/9;border-radius:8px;overflow:hidden;background:#161616}
  .cr-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .28s ease}
  .cr-card:hover .cr-thumb img{transform:scale(1.06)}
  .cr-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);opacity:0;transition:opacity .2s}
  .cr-card:hover .cr-ov{opacity:1}
  .cr-play{width:52px;height:52px;border-radius:50%;background:rgba(244,117,33,.95);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.5)}
  .cr-play svg{width:22px;height:22px;fill:#fff;margin-left:3px}
  .cr-epn{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.72);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;letter-spacing:.3px}
  .cr-bar{position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(255,255,255,.28)}
  .cr-bar i{display:block;height:100%;background:#f47521}
  .cr-meta{display:flex;flex-direction:column;gap:3px;min-width:0}
  .cr-title{font-size:14px;font-weight:700;line-height:1.25;color:#f5f5f5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cr-sub{font-size:12.5px;color:#9a9a9a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cr-cont{font-size:11.5px;color:#f47521;font-weight:600}`;
  document.head.appendChild(s);
}

const epLink = (it) => `anime-details.html?id=${it.animeId}&season=${encodeURIComponent(it.season)}&episode=${it.number}`;

// ---- Favoritos (animes + episodios) ----------------------------------------
export async function renderFavorites(host) {
  injectAccountStyles();
  host.innerHTML = `
    <div class="av-tabs">
      <button class="av-tab active" data-t="a">Animes</button>
      <button class="av-tab" data-t="e">Episodios</button>
    </div>
    <div id="av-fa"><p class="av-empty">Cargando…</p></div>
    <div id="av-fe" style="display:none"></div>`;
  host.querySelectorAll(".av-tab").forEach((t) => t.addEventListener("click", () => {
    host.querySelectorAll(".av-tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    host.querySelector("#av-fa").style.display = t.dataset.t === "a" ? "block" : "none";
    host.querySelector("#av-fe").style.display = t.dataset.t === "e" ? "block" : "none";
  }));
  try {
    const [animes, eps] = await Promise.all([listFavAnimes(), listFavEpisodes()]);
    host.querySelector("#av-fa").innerHTML = animes.length
      ? `<div class="av-grid">${animes.map((a) => `<a class="av-a" href="anime-details.html?id=${a.id}"><img src="${a.img || a.imgMobile || ""}" loading="lazy" alt=""><span>${a.title}</span></a>`).join("")}</div>`
      : '<p class="av-empty">Aún no has guardado animes. Usa el botón 🔖 en cada anime.</p>';
    host.querySelector("#av-fe").innerHTML = eps.length
      ? eps.map((e) => `<a class="av-ep" href="${epLink(e)}"><img src="${e.img}" loading="lazy" alt=""><div><b>${e.animeTitle}</b><br><small>${e.season} · E${e.number} ${e.title || ""}</small></div></a>`).join("")
      : '<p class="av-empty">Aún no has guardado episodios.</p>';
  } catch (e) { console.error(e); host.querySelector("#av-fa").innerHTML = '<p class="av-empty">Error al cargar.</p>'; }
}

// ---- Historial --------------------------------------------------------------
export async function renderHistory(host) {
  injectAccountStyles();
  try {
    const hist = await listHistory(80);
    host.innerHTML = hist.length
      ? `<div class="cr-hist">${hist.map((e) => {
          const pct = Math.round(Math.max(0, Math.min(1, e.progress || 0)) * 100);
          const seguir = pct > 2 && pct < 92;
          const sub = `${e.season} · E${e.number}${e.title ? " · " + e.title : ""}`;
          return `<a class="cr-card" href="${epLink(e)}">
            <div class="cr-thumb">
              <img src="${e.img || ""}" loading="lazy" alt="">
              <span class="cr-epn">E${e.number}</span>
              <div class="cr-ov"><span class="cr-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></div>
              <div class="cr-bar"><i style="width:${pct}%"></i></div>
            </div>
            <div class="cr-meta">
              <span class="cr-title">${e.animeTitle || ""}</span>
              <span class="cr-sub">${sub}</span>
              ${seguir ? '<span class="cr-cont">Seguir viendo</span>' : ""}
            </div>
          </a>`;
        }).join("")}</div>`
      : '<p class="av-empty">Aún no has visto ningún episodio.</p>';
  } catch (e) { console.error(e); host.innerHTML = '<p class="av-empty">No se pudo cargar el historial.</p>'; }
}

// ---- Notificaciones (episodios nuevos de animes seguidos) ------------------
const MONTHS = { enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11 };
function parseRelease(str) {
  if (!str) return null;
  const p = String(str).replace(",", "").toLowerCase().split(/\s+/);
  if (p.length === 3 && MONTHS.hasOwnProperty(p[0])) return new Date(+p[2], MONTHS[p[0]], +p[1]);
  const d = new Date(str); return isNaN(d) ? null : d;
}
const relTime = (dt) => {
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  return dt.toLocaleDateString("es", { day: "numeric", month: "short" });
};

export async function renderNotifications(host, countEl, opts = {}) {
  injectAccountStyles();
  try {
    const [animes, favA, hist] = await Promise.all([getAnimeData(), listFavAnimes(), listHistory(200)]);
    const followed = new Set([...favA.map((a) => a.id), ...hist.map((h) => h.animeId)]);
    // Géneros preferidos (para personalizar las novedades).
    const likedGenres = {};
    [...favA, ...hist].forEach((x) => {
      const a = animes.find((an) => an.id === (x.id || x.animeId));
      (a?.genres || []).forEach((g) => (likedGenres[g] = (likedGenres[g] || 0) + 1));
    });

    const now = Date.now(), cutoff = now - 45 * 86400000, weekAgo = now - 7 * 86400000;
    const recent = [];
    animes.forEach((a) => {
      (a.episodes || []).forEach((ep) => {
        const dt = parseRelease(ep.releaseDate);
        if (dt && dt.getTime() >= cutoff && dt.getTime() <= now + 86400000) {
          const score = (a.genres || []).reduce((s, g) => s + (likedGenres[g] || 0), 0);
          recent.push({
            animeId: a.id, animeTitle: a.title, img: ep.img || a.img, season: ep.season,
            number: ep.number, title: ep.title, dt, followed: followed.has(a.id),
            premiere: Number(ep.number) === 1, score,
          });
        }
      });
    });
    recent.sort((x, y) => y.dt - x.dt);

    const mine = recent.filter((n) => n.followed);
    const news = recent.filter((n) => !n.followed).sort((x, y) => (y.score - x.score) || (y.dt - x.dt)); // recomendado por tus gustos
    const total = recent.length;
    if (countEl) countEl.textContent = total || "";

    const item = (n) => `
      <a class="av-ep" href="${epLink(n)}">
        <img src="${n.img}" loading="lazy" alt="">
        <div><b>${n.animeTitle}</b>${n.dt.getTime() >= weekAgo ? '<span class="av-new">NUEVO</span>' : ""}
          <br><small>${n.premiere ? "🎬 Estreno" : "Nuevo episodio"} · ${n.season} · E${n.number} ${n.title || ""} <span class="av-when">· ${relTime(n.dt)}</span></small>
        </div>
      </a>`;

    if (!total) {
      host.innerHTML = '<p class="av-empty">No hay estrenos ni episodios nuevos por ahora. ¡Vuelve pronto!</p>';
      return;
    }
    let html = "";
    if (mine.length) html += `<h3 class="av-nsec"><i class="fas fa-bell"></i> Para ti · episodios nuevos de lo que sigues</h3>` + mine.slice(0, 25).map(item).join("");
    if (news.length) html += `<h3 class="av-nsec"><i class="fas fa-fire"></i> Novedades y estrenos en All-Anime</h3>` + news.slice(0, 25).map(item).join("");
    host.innerHTML = html;
  } catch (e) { console.error(e); host.innerHTML = '<p class="av-empty">No se pudieron cargar las notificaciones.</p>'; }
}
