import { getAnimeData } from "./data-provider.js";
import { initPlayerEngagement, clearAutoplay, getWatchedSet } from "./engagement.js";
import { episodeId as makeEpId } from "./catalog-utils.js";
import * as UD from "./user-data.js";
import { mountRatingWidget } from "./rating-widget.js";
import { recommendForUser, rememberSearch } from "./recommend.js";
import { setupHero } from "./hero.js";
import { observeAuth, logoutUser } from "./auth.js";
import { FIREBASE_CONFIGURED } from "./firebase-config.js";
import { logVisit } from "./analytics.js";

// Registra la visita (una vez por sesión) para la analítica del admin.
logVisit();

// --- WIDGET DE CUENTA EN EL HEADER (todas las páginas) ---
function injectAccountWidget() {
  const host = document.querySelector(".header-right") || document.querySelector("header");
  if (!host || document.getElementById("acct-widget")) return;

  if (!document.getElementById("acct-widget-styles")) {
    const s = document.createElement("style");
    s.id = "acct-widget-styles";
    s.textContent = `
    #acct-widget{position:relative;display:inline-flex;align-items:center;margin-left:6px;z-index:1200}
    .acct-btn{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);
      border-radius:30px;padding:4px 10px 4px 4px;cursor:pointer;color:#f0f0f0;font-family:inherit;font-size:1.3rem;line-height:1}
    .acct-btn:hover{border-color:var(--primary-color,#ca3030)}
    .acct-btn img,.acct-btn .acct-ph{width:30px;height:30px;border-radius:50%;object-fit:cover;background:#333;flex:none;
      display:flex;align-items:center;justify-content:center;border:2px solid var(--primary-color,#ca3030)}
    .acct-btn .acct-nm{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
    .acct-btn .fa-chevron-down{font-size:.9rem;opacity:.7}
    .acct-login{display:inline-flex;align-items:center;gap:7px;background:var(--primary-color,#ca3030);color:#fff;border-radius:30px;
      padding:8px 15px;text-decoration:none;font-size:1.3rem;font-weight:600}
    .acct-menu{position:absolute;top:calc(100% + 10px);right:0;min-width:220px;background:#1b1b1b;border:1px solid #303030;
      border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.55);overflow:hidden;display:none}
    .acct-menu.open{display:block}
    .acct-head{display:flex;align-items:center;gap:11px;padding:14px;border-bottom:1px solid #2a2a2a}
    .acct-head img,.acct-head .acct-ph{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#333;flex:none;
      display:flex;align-items:center;justify-content:center;border:2px solid var(--primary-color,#ca3030)}
    .acct-head b{font-size:1.4rem;display:block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .acct-head span{font-size:1.15rem;color:#999;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
    .acct-menu a,.acct-menu button{display:flex;align-items:center;gap:11px;width:100%;padding:12px 15px;background:none;border:none;
      color:#f0f0f0;text-decoration:none;font-size:1.35rem;cursor:pointer;font-family:inherit;text-align:left}
    .acct-menu a:hover,.acct-menu button:hover{background:#262626}
    .acct-menu a i,.acct-menu button i{width:18px;text-align:center;color:#bbb}
    .acct-menu .acct-admin i{color:var(--primary-color,#ca3030)}
    .acct-menu .sep{height:1px;background:#2a2a2a}
    .nav-acct{display:none}
    @media (max-width:768px){
      #acct-widget .acct-nm,#acct-widget .acct-btn .fa-chevron-down{display:none}
      #acct-widget .acct-btn{padding:3px}
      .acct-menu{position:fixed;top:64px;right:12px;left:12px;min-width:0}
      .navbar ul .nav-acct{display:block;border-top:1px solid rgba(255,255,255,.12);margin-top:6px;padding-top:6px}
    }`;
    document.head.appendChild(s);
  }
  // Accesos de cuenta dentro del menú hamburguesa (solo visibles en móvil).
  const navUl = document.querySelector(".navbar ul");
  function renderNavAccount(user) {
    if (!navUl) return;
    navUl.querySelectorAll(".nav-acct").forEach((n) => n.remove());
    const admin = user && (user.email || "").toLowerCase() === "all.anime.lat01@gmail.com";
    const items = user
      ? [`<li class="nav-acct"><a href="perfil.html"><i class="fas fa-user-gear"></i> Mi perfil</a></li>`,
         `<li class="nav-acct"><a href="mis-favoritos.html"><i class="fas fa-heart"></i> Mis favoritos</a></li>`,
         `<li class="nav-acct"><a href="historial.html"><i class="fas fa-clock-rotate-left"></i> Historial</a></li>`,
         `<li class="nav-acct"><a href="notificaciones.html"><i class="fas fa-bell"></i> Notificaciones</a></li>`,
         admin ? `<li class="nav-acct"><a href="admin/index.html"><i class="fas fa-user-shield"></i> Admin</a></li>` : "",
         `<li class="nav-acct"><a href="#" id="nav-logout"><i class="fas fa-right-from-bracket"></i> Cerrar sesión</a></li>`]
      : [`<li class="nav-acct"><a href="cuenta.html"><i class="fas fa-user"></i> Iniciar sesión</a></li>`];
    navUl.insertAdjacentHTML("beforeend", items.join(""));
    const nl = document.getElementById("nav-logout");
    if (nl) nl.addEventListener("click", async (e) => { e.preventDefault(); await logoutUser(); location.href = "index.html"; });
  }

  const w = document.createElement("div");
  w.id = "acct-widget";
  host.insertBefore(w, host.querySelector("#menu-icon") || null);

  const renderLoggedOut = () => {
    w.innerHTML = `<a class="acct-login" href="cuenta.html"><i class="fas fa-user"></i> Entrar</a>`;
  };
  renderLoggedOut();
  renderNavAccount(null);
  if (!FIREBASE_CONFIGURED) return;

  observeAuth((user) => {
    renderNavAccount(user);
    if (!user) { renderLoggedOut(); return; }
    const admin = (user.email || "").toLowerCase() === "all.anime.lat01@gmail.com";
    const name = user.displayName || user.email.split("@")[0];
    const ph = (cls) => user.photoURL
      ? `<img class="${cls}" src="${user.photoURL}" alt="">`
      : `<span class="acct-ph ${cls}"><i class="fas fa-user"></i></span>`;
    w.innerHTML = `
      <button class="acct-btn" id="acct-toggle" title="${user.email}">
        ${ph("")}<span class="acct-nm">${name}</span><i class="fas fa-chevron-down"></i>
      </button>
      <div class="acct-menu" id="acct-menu">
        <div class="acct-head">${ph("")}<div><b>${name}</b><span>${user.email}</span></div></div>
        <a href="perfil.html"><i class="fas fa-user-gear"></i> Mi perfil</a>
        <a href="mis-favoritos.html"><i class="fas fa-heart"></i> Mis favoritos</a>
        <a href="historial.html"><i class="fas fa-clock-rotate-left"></i> Historial</a>
        <a href="notificaciones.html"><i class="fas fa-bell"></i> Notificaciones</a>
        ${admin ? '<div class="sep"></div><a class="acct-admin" href="admin/index.html"><i class="fas fa-user-shield"></i> Panel de administración</a>' : ""}
        <div class="sep"></div>
        <button id="acct-logout"><i class="fas fa-right-from-bracket"></i> Cerrar sesión</button>
      </div>`;
    const menu = w.querySelector("#acct-menu");
    w.querySelector("#acct-toggle").addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("open"); });
    document.addEventListener("click", (e) => { if (!w.contains(e.target)) menu.classList.remove("open"); });
    w.querySelector("#acct-logout").addEventListener("click", async () => { await logoutUser(); location.href = "index.html"; });
  });
}
injectAccountWidget();

// Monta el hero cuanto antes (no depende del catálogo). Ver hero.js
setupHero();

$(document).ready(function () {
  getAnimeData().then(function (animeData) {
  // --- LÓGICA DE ANIMACIÓN DE CARGA ---
  if (window.innerWidth <= 991 && !sessionStorage.getItem("loaderShown")) {
    $("body").css("overflow", "hidden");
    setTimeout(() => {
      $("body").css("overflow", "");
    }, 5000);
    sessionStorage.setItem("loaderShown", "true");
  } else {
    $(".loader-wrapper").hide();
  }

  // --- LÓGICA DE CAMBIO DE TEMA ---
  const themeToggle = $("#theme-toggle");
  const currentTheme = localStorage.getItem("theme");

  function applyTheme(theme) {
    if (theme === "red-theme") {
      $("body").addClass("red-theme");
      themeToggle.find("i").removeClass("fa-sun").addClass("fa-moon");
    } else {
      $("body").removeClass("red-theme");
      themeToggle.find("i").removeClass("fa-moon").addClass("fa-sun");
    }
  }

  if (currentTheme) {
    applyTheme(currentTheme);
  }

  themeToggle.on("click", function () {
    let theme = "dark-theme";
    if (!$("body").hasClass("red-theme")) {
      theme = "red-theme";
    }
    localStorage.setItem("theme", theme);
    applyTheme(theme);
  });

  // --- FUNCIONES AUXILIARES ---
  function debounce(func, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function parseCustomDate(dateString, timeString = "00:00") {
    const monthMap = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };
    const [hours, minutes] = timeString.split(":").map(Number);

    const partsWithComma = dateString.replace(",", "").toLowerCase().split(" ");
    if (
      partsWithComma.length === 3 &&
      monthMap.hasOwnProperty(partsWithComma[0])
    ) {
      const year = parseInt(partsWithComma[2], 10);
      const month = monthMap[partsWithComma[0]];
      const day = parseInt(partsWithComma[1], 10);
      return new Date(year, month, day, hours, minutes);
    }

    const partsWithSlash = dateString.split("/");
    if (partsWithSlash.length === 3) {
      let year = parseInt(partsWithSlash[2], 10);
      if (year < 100) year += 2000;
      const month = parseInt(partsWithSlash[1], 10) - 1;
      const day = parseInt(partsWithSlash[0], 10);
      return new Date(year, month, day, hours, minutes);
    }

    const genericDate = new Date(dateString);
    genericDate.setHours(hours, minutes, 0, 0);
    return genericDate;
  }

  // --- FUNCIONES GLOBALES DE MODAL Y FAVORITOS ---
  function getFavoriteEpisodes() {
    try {
      return JSON.parse(localStorage.getItem("favoriteEpisodes")) || [];
    } catch (e) {
      return [];
    }
  }

  function isEpisodeFavorite(episodeId) {
    return getFavoriteEpisodes().includes(episodeId);
  }

  // Anime/episodio abiertos actualmente en el reproductor (para sync con Firestore).
  let currentPlayerAnime = null;
  let currentPlayerEpisode = null;

  function setEpisodeFavLocal(episodeId, on) {
    let f = getFavoriteEpisodes();
    if (on && !f.includes(episodeId)) f.push(episodeId);
    if (!on) f = f.filter((x) => x !== episodeId);
    localStorage.setItem("favoriteEpisodes", JSON.stringify(f));
  }

  function paintEpisodeFav(on) {
    $("#player-favorite-btn")
      .toggleClass("is-favorite", on)
      .attr("title", on ? "Quitar de Favoritos" : "Agregar a Favoritos")
      .find("i").toggleClass("fas", on).toggleClass("far", !on);
  }

  async function toggleEpisodeFavorite(episodeId) {
    if (UD.isLoggedIn() && currentPlayerAnime && currentPlayerEpisode) {
      try {
        const on = await UD.toggleFavEpisode(currentPlayerAnime, currentPlayerEpisode);
        setEpisodeFavLocal(episodeId, on);
        paintEpisodeFav(on);
        return;
      } catch (err) { console.error(err); }
    }
    const on = !getFavoriteEpisodes().includes(episodeId);
    setEpisodeFavLocal(episodeId, on);
    paintEpisodeFav(on);
  }

  async function updateEpisodeFavoriteButtonState(episodeId) {
    if (UD.isLoggedIn() && currentPlayerAnime && currentPlayerEpisode) {
      try { paintEpisodeFav(await UD.isFavEpisode(currentPlayerAnime, currentPlayerEpisode)); return; } catch {}
    }
    paintEpisodeFav(isEpisodeFavorite(episodeId));
  }

  // --- LÓGICA DE HISTORIAL ---
  function getWatchHistory() {
    try {
      const history = localStorage.getItem("watchHistory");
      return history ? JSON.parse(history) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToHistory(episodeId) {
    if (!episodeId) return;
    let history = getWatchHistory();
    history = history.filter((item) => item.id !== episodeId);
    history.unshift({ id: episodeId, lastWatched: new Date().toISOString() });
    if (history.length > 100) history.pop();
    localStorage.setItem("watchHistory", JSON.stringify(history));
  }

  function createHistoryEpisodeCard(episode, anime) {
    const link = `anime-details.html?id=${anime.id}&season=${encodeURIComponent(
      episode.season
    )}&episode=${episode.number}`;
    const releaseDateTime = parseCustomDate(
      episode.releaseDate,
      episode.releaseTime
    );
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const isNew = releaseDateTime >= sevenDaysAgo;

    return `
            <div class="episode-detail-card">
                <a href="${link}">
                    <div class="episode-img-container">
                        <img src="${episode.img
      }" alt="${episode.title}" loading="lazy">
                        ${isNew ? '<span class="new-tag">NUEVO</span>' : ""}
                        <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                        <span class="duration-tag">${episode.duration}</span>
                    </div>
                    <div class="episode-card-info">
                        <p style="color: var(--light-text); font-size: 1.4rem; margin-bottom: 0.5rem;">${anime.title
      }</p>
                        <h5 class="episode-card-title">${episode.number
      }. ${episode.title}</h5>
                        <p class="episode-card-meta">${episode.language
      } • ${episode.releaseDate}</p>
                    </div>
                </a>
            </div>`;
  }

  // Tarjeta de "seguir viendo"/historial a partir de un item plano.
  function createHistoryCardFromItem(it) {
    const link = `anime-details.html?id=${it.animeId}&season=${encodeURIComponent(it.season)}&episode=${it.number}`;
    return `
      <div class="episode-detail-card">
        <a href="${link}">
          <div class="episode-img-container">
            <img src="${it.img || ""}" alt="" loading="lazy">
            <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
          </div>
          <div class="episode-card-info">
            <p style="color: var(--light-text); font-size: 1.4rem; margin-bottom: 0.5rem;">${it.animeTitle || ""}</p>
            <h5 class="episode-card-title">${it.number}. ${it.title || ""}</h5>
            <p class="episode-card-meta">${it.language || ""}</p>
          </div>
        </a>
      </div>`;
  }

  // Convierte el historial local (localStorage) a items planos.
  function localHistoryItems() {
    return getWatchHistory().map((it) => {
      const [animeId, seasonStr, episodeStr] = it.id.split("::");
      const episodeNum = parseFloat(episodeStr.replace("ep", ""));
      const anime = animeData.find((a) => a.id === animeId);
      const episode = anime?.episodes?.find((ep) => ep.season === seasonStr && ep.number === episodeNum);
      return episode ? {
        animeId, animeTitle: anime.title, img: episode.img, season: episode.season,
        number: episode.number, title: episode.title, language: episode.language,
      } : null;
    }).filter(Boolean);
  }

  async function populateContinueWatching() {
    const grid = $("#continue-watching-grid");
    const section = $("#continue-watching-section");
    if (!grid.length) return;
    // Firestore si hay sesión (sincronizado entre dispositivos); si no, localStorage.
    const items = UD.isLoggedIn() ? await UD.listHistory(12) : localHistoryItems();
    grid.empty();
    if (!items.length) { section.hide(); return; }
    section.show();
    items.slice(0, 6).forEach((it) => grid.append(createHistoryCardFromItem(it)));
  }

  function populateHistoryPage() {
    const grid = $("#history-episodes-grid");
    if (!grid.length) return;
    const history = getWatchHistory();
    grid.empty();
    if (history.length === 0) {
      grid.html(
        '<p class="no-results" style="padding: 4rem; text-align: center;">Tu historial está vacío.</p>'
      );
      return;
    }
    history.forEach((item) => {
      const [animeId, seasonStr, episodeStr] = item.id.split("::");
      const episodeNum = parseFloat(episodeStr.replace("ep", ""));
      const anime = animeData.find((a) => a.id === animeId);
      if (anime && anime.episodes) {
        const episode = anime.episodes.find(
          (ep) => ep.season === seasonStr && ep.number === episodeNum
        );
        if (episode) {
          grid.append(createHistoryEpisodeCard(episode, anime));
        }
      }
    });
  }

  // --- LÓGICA DE DISQUS ---
  let disqusLoaded = false;

  function loadDisqus(episodeId, anime, episode) {
    window.disqus_config = function () {
      this.page.url = `https://all-anime.net/anime-details.html?id=${anime.id}&season=${encodeURIComponent(episode.season)}&episode=${episode.number}`;
      this.page.identifier = episodeId;
    };

    if (!disqusLoaded) {
      const d = document, s = d.createElement('script');
      s.src = 'https://all-anime2025.disqus.com/embed.js';
      s.setAttribute('data-timestamp', +new Date());
      (d.head || d.body).appendChild(s);
      disqusLoaded = true;
    } else {
      resetDisqus(episodeId, `https://all-anime.net/anime-details.html?id=${anime.id}&season=${encodeURIComponent(episode.season)}&episode=${episode.number}`);
    }
  }

  function resetDisqus(newIdentifier, newUrl) {
    if (window.DISQUS) {
      DISQUS.reset({
        reload: true,
        config: function () {
          this.page.identifier = newIdentifier;
          this.page.url = newUrl;
        }
      });
    }
  }

  // --- FUNCIÓN PRINCIPAL DEL REPRODUCTOR ---
  function openPlayer(anime, episode) {
    if (!anime || !episode) return;
    currentPlayerAnime = anime;
    currentPlayerEpisode = episode;
    UD.recordHistory(anime, episode); // historial sincronizado (si hay sesión)
    const playerModal = $("#episode-player-modal");
    const episodeId = `${anime.id}::${episode.season}::ep${episode.number}`;
    playerModal.attr("data-episode-id", episodeId);

    // Comentarios propios (Firestore) en lugar de Disqus. Ver engagement.js.
    // loadDisqus(episodeId, anime, episode);

    const seasonEpisodes = anime.episodes
      .filter((e) => e.season === episode.season)
      .sort((a, b) => a.number - b.number);
    const currentEpisodeIndex = seasonEpisodes.findIndex(
      (e) => e.number === episode.number
    );
    const prevEpisode = seasonEpisodes[currentEpisodeIndex - 1];
    const nextEpisode = seasonEpisodes[currentEpisodeIndex + 1];

    $("#player-anime-link")
      .attr("href", `anime-details.html?id=${anime.id}`)
      .text(anime.title);
    $("#player-episode-title").text(`E${episode.number} - ${episode.title}`);
    $("#player-episode-meta").html(
      `<span>${episode.language}</span> &bull; <span>Lanzado el ${episode.releaseDate}</span>`
    );
    $("#player-episode-description").text(episode.description);
    $("#episode-iframe").attr("src", episode.videoUrl || "");

    const prevPreviewContainer = $("#player-prev-episode-preview").empty();
    if (prevEpisode) {
      prevPreviewContainer.html(
        `<h5 class="player-nav-title">EPISODIO ANTERIOR</h5><a href="#" class="player-nav-card open-player-from-modal" data-anime-id="${anime.id
        }" data-season="${encodeURIComponent(
          prevEpisode.season
        )}" data-episode-number="${prevEpisode.number
        }"><div class="player-nav-img-wrapper"><img src="${prevEpisode.img
        }" alt=""><div class="player-nav-play-icon"><i class="fas fa-play"></i></div></div><div class="player-nav-info"><p>E${prevEpisode.number
        } - ${prevEpisode.title}</p><span>${prevEpisode.language
        }</span></div></a>`
      );
    }

    const nextPreviewContainer = $("#player-next-episode-preview").empty();
    if (nextEpisode) {
      nextPreviewContainer.html(
        `<h5 class="player-nav-title">SIGUIENTE EPISODIO</h5><a href="#" class="player-nav-card open-player-from-modal" data-anime-id="${anime.id
        }" data-season="${encodeURIComponent(
          nextEpisode.season
        )}" data-episode-number="${nextEpisode.number
        }"><div class="player-nav-img-wrapper"><img src="${nextEpisode.img
        }" alt=""><div class="player-nav-play-icon"><i class="fas fa-play"></i></div></div><div class="player-nav-info"><p>E${nextEpisode.number
        } - ${nextEpisode.title}</p><span>${nextEpisode.language
        }</span></div></a>`
      );
    }

    // --- Engagement: likes, comentarios, visto, siguiente/autoplay ---
    initPlayerEngagement({
      anime,
      episode,
      nextEpisode,
      onPlayNext: nextEpisode ? () => openPlayer(anime, nextEpisode) : null,
    });

    playerModal.css("display", "flex").hide().fadeIn();
    $("body").css("overflow", "hidden");
  }

  // --- FUNCIONES PARA RENDERIZAR CONTENIDO DINÁMICO ---
  function createAnimeCard(anime) {
    return `
        <div class="anime-card">
            <a href="anime-details.html?id=${anime.id}">
                <div class="card-image-container">
                    <img src="${anime.img}" alt="${anime.title}" loading="lazy">
                    <div class="quality-tag">${anime.quality}</div>
                    <div class="card-overlay">
                        <div class="overlay-content">
                             <div class="play-button"><i class="fas fa-play"></i></div>
                            <h3 class="overlay-title">${anime.title}</h3>
                            <div class="overlay-stats">
                                <span><i class="fas fa-star"></i> ${anime.rating
      }</span>
                                <span>${anime.seasons} Temporada(s)</span>
                            </div>
                            <div class="overlay-genres">
                                ${anime.genres
        .map((genre) => `<span>${genre}</span>`)
        .join("")}
                            </div>
                            <p class="overlay-description">${anime.description
      }</p>
                        </div>
                    </div>
                </div>
                <div class="card-info">
                    <h4 class="card-title">${anime.title}</h4>
                </div>
            </a>
        </div>`;
  }

  function createDynamicEpisodeItem(episode, anime) {
    const initialImage = anime.fonImg || anime.img;
    const link = `anime-details.html?id=${anime.id}&season=${encodeURIComponent(
      episode.season
    )}&episode=${episode.number}`;

    return `
        <li class="episode-item" data-original-img="${initialImage}" data-hover-img="${episode.img}" data-original-meta="Episodio ${episode.number} • ${episode.language}" data-episode-num="${episode.number}">
            <a href="${link}">
                <div class="episode-thumbnail">
                    <img src="${initialImage}" alt="${anime.title} Cover" loading="lazy">
                    <div class="play-icon"><i class="fas fa-play"></i></div>
                </div>
                <div class="episode-details">
                    <p class="episode-title">${anime.title}</p>
                    <p class="episode-meta">${episode.language}</p>
                </div>
                <span class="release-time">${episode.releaseTime || ""}</span>
            </a>
        </li>`;
  }

  function createFavoriteEpisodeCard(episode, anime) {
    const link = `anime-details.html?id=${anime.id}&season=${encodeURIComponent(
      episode.season
    )}&episode=${episode.number}`;
    const releaseDateTime = parseCustomDate(
      episode.releaseDate,
      episode.releaseTime
    );
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const isNew = releaseDateTime >= sevenDaysAgo;

    return `
        <div class="episode-detail-card">
            <a href="${link}">
                <div class="episode-img-container">
                    <img src="${episode.img
      }" alt="${episode.title}" loading="lazy">
                    ${isNew ? '<span class="new-tag">NUEVO</span>' : ""}
                    <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                    <span class="duration-tag">${episode.duration}</span>
                </div>
                <div class="episode-card-info">
                    <p style="color: var(--light-text); font-size: 1.4rem; margin-bottom: 0.5rem;">${anime.title
      }</p>
                    <h5 class="episode-card-title">${episode.number
      }. ${episode.title}</h5>
                    <p class="episode-card-meta">${episode.language
      } • ${episode.releaseDate}</p>
                </div>
            </a>
        </div>`;
  }

  // --- LÓGICA DE LA PÁGINA DE INICIO ---
  function populateHomePage() {
    const recommendationsCarousel = $("#recommendations-carousel");
    const dubsCarousel = $("#dubs-carousel");
    const addedGrid = $("#added-animes-grid");
    const episodesListHoy = $("#episodes-hoy");
    const episodesListAyer = $("#episodes-ayer");

    if (recommendationsCarousel.length)
      animeData
        .filter((a) => a.tags.includes("recomendado"))
        .forEach((anime) =>
          recommendationsCarousel.append(createAnimeCard(anime))
        );
    if (dubsCarousel.length)
      animeData
        .filter((a) => a.tags.includes("doblaje"))
        .forEach((anime) => dubsCarousel.append(createAnimeCard(anime)));
    if (addedGrid.length)
      animeData
        .filter((a) => a.tags.includes("agregado"))
        .forEach((anime) => addedGrid.append(createAnimeCard(anime)));

    if (episodesListHoy.length || episodesListAyer.length) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let allEpisodes = [];
      animeData.forEach((anime) => {
        if (anime.episodes) {
          anime.episodes.forEach((episode) => {
            allEpisodes.push({
              anime,
              episode,
              dateTime: parseCustomDate(
                episode.releaseDate,
                episode.releaseTime
              ),
            });
          });
        }
      });

      const todayEpisodes = allEpisodes
        .filter(
          (item) =>
            item.dateTime.getTime() >= today.getTime() &&
            item.dateTime.getTime() <
            new Date(today).setDate(today.getDate() + 1)
        )
        .sort((a, b) => b.dateTime - a.dateTime);

      const yesterdayEpisodes = allEpisodes
        .filter(
          (item) =>
            item.dateTime.getTime() >= yesterday.getTime() &&
            item.dateTime.getTime() < today.getTime()
        )
        .sort((a, b) => b.dateTime - a.dateTime);

      episodesListHoy.empty();
      if (todayEpisodes.length > 0)
        todayEpisodes.forEach((item) =>
          episodesListHoy.append(
            createDynamicEpisodeItem(item.episode, item.anime)
          )
        );
      else
        episodesListHoy.html(
          '<p class="no-results" style="padding: 2rem 0;">No hay nuevos episodios hoy.</p>'
        );

      episodesListAyer.empty();
      const yesterdayContainer = $("#yesterday-episodes-container");
      if (yesterdayEpisodes.length > 0) {
        yesterdayContainer.show();
        yesterdayEpisodes.forEach((item) =>
          episodesListAyer.append(
            createDynamicEpisodeItem(item.episode, item.anime)
          )
        );
        $("#show-more-episodes").show();
      } else {
        yesterdayContainer.hide();
        $("#show-more-episodes").hide();
      }
    }
    if (recommendationsCarousel.length || dubsCarousel.length) {
      $(".card-carousel").slick({
        infinite: false,
        slidesToShow: 6,
        slidesToScroll: 2,
        responsive: [
          { breakpoint: 1400, settings: { slidesToShow: 5 } },
          { breakpoint: 1024, settings: { slidesToShow: 4 } },
          { breakpoint: 768, settings: { slidesToShow: 3, arrows: false } },
          { breakpoint: 480, settings: { slidesToShow: 2, arrows: false } },
        ],
      });
    }
  }

  // --- LÓGICA DE FILTROS GENÉRICA ---
  function setupFilterPage(gridSelector, sourceData) {
    const grid = $(gridSelector);
    if (!grid.length) return;
    const genreButtonsContainer = $("#genre-filter-buttons"),
      yearSelect = $("#year-select"),
      typeSelect = $("#type-select"),
      statusSelect = $("#status-select"),
      exploreSearch = $("#explore-search"),
      toggleFiltersBtn = $("#toggle-filters-btn"),
      filtersSection = $(".filters-section");

    if (toggleFiltersBtn.length) {
      filtersSection.hide();
      toggleFiltersBtn.on("click", () => filtersSection.slideToggle());
    }
    const genres = [...new Set(sourceData.flatMap((a) => a.genres))];
    if (genreButtonsContainer.length) {
      genreButtonsContainer.empty();
      genres.forEach((g) =>
        genreButtonsContainer.append(
          `<button class="genre-btn" data-genre="${g}">${g}</button>`
        )
      );
    }
    const years = [...new Set(sourceData.map((a) => a.year))].sort(
      (a, b) => b - a
    );
    if (yearSelect.length) {
      yearSelect.empty().append('<option value="all">Todos los años</option>');
      years.forEach((y) =>
        yearSelect.append(`<option value="${y}">${y}</option>`)
      );
    }

    function applyFilters() {
      const searchQuery = exploreSearch.val()
        ? exploreSearch.val().toLowerCase()
        : "";
      const selectedGenres = genreButtonsContainer.length
        ? $(".genre-btn.active")
          .map(function () {
            return $(this).data("genre");
          })
          .get()
        : [];
      const selectedYear = yearSelect.length ? yearSelect.val() : "all";
      const selectedType = typeSelect.length ? typeSelect.val() : "all";
      const selectedStatus = statusSelect.length ? statusSelect.val() : "all";
      const filteredData = sourceData.filter(
        (anime) =>
          anime.title.toLowerCase().includes(searchQuery) &&
          (selectedGenres.length === 0 ||
            selectedGenres.every((g) => anime.genres.includes(g))) &&
          (!yearSelect.length ||
            selectedYear === "all" ||
            anime.year == selectedYear) &&
          (!typeSelect.length ||
            selectedType === "all" ||
            anime.type === selectedType) &&
          (!statusSelect.length ||
            selectedStatus === "all" ||
            anime.status === selectedStatus)
      );
      grid.empty();
      if (filteredData.length > 0)
        filteredData.forEach((anime) => grid.append(createAnimeCard(anime)));
      else
        grid.append(
          '<p class="no-results">No se encontraron resultados con estos filtros.</p>'
        );
    }

    if (exploreSearch.length)
      exploreSearch.on("input", debounce(applyFilters, 300));
    if (genreButtonsContainer.length)
      genreButtonsContainer.on("click", ".genre-btn", function () {
        $(this).toggleClass("active");
        applyFilters();
      });
    if (yearSelect.length) yearSelect.on("change", applyFilters);
    if (typeSelect.length) typeSelect.on("change", applyFilters);
    if (statusSelect.length) statusSelect.on("change", applyFilters);
    applyFilters();
  }

  // --- LÓGICA ESPECÍFICA DE LA PÁGINA DE FAVORITOS ---
  function setupFavoritesPage() {
    const favoritesGrid = $("#favorites-anime-grid");
    const favoriteEpisodesGrid = $("#favorites-episodes-grid");
    if (!favoritesGrid.length && !favoriteEpisodesGrid.length) return;

    const favoriteAnimeIds =
      JSON.parse(localStorage.getItem("favoriteAnimes")) || [];
    favoritesGrid.empty();
    if (favoriteAnimeIds.length === 0) {
      favoritesGrid.html(
        '<p class="no-results" style="padding: 2rem;">No has guardado ningún anime.</p>'
      );
    } else {
      const favoriteAnimes = animeData.filter((anime) =>
        favoriteAnimeIds.includes(anime.id)
      );
      favoriteAnimes.forEach((anime) =>
        favoritesGrid.append(createAnimeCard(anime))
      );
    }

    const favoriteEpisodeIds =
      JSON.parse(localStorage.getItem("favoriteEpisodes")) || [];
    favoriteEpisodesGrid.empty();
    if (favoriteEpisodeIds.length === 0) {
      favoriteEpisodesGrid.html(
        '<p class="no-results" style="padding: 2rem;">No has guardado ningún episodio.</p>'
      );
    } else {
      favoriteEpisodeIds.forEach((episodeId) => {
        const [animeId, seasonStr, episodeStr] = episodeId.split("::");
        const episodeNum = parseFloat(episodeStr.replace("ep", ""));
        const anime = animeData.find((a) => a.id === animeId);
        if (anime && anime.episodes) {
          const episode = anime.episodes.find(
            (ep) => ep.season === seasonStr && ep.number === episodeNum
          );
          if (episode) {
            favoriteEpisodesGrid.append(
              createFavoriteEpisodeCard(episode, anime)
            );
          }
        }
      });
    }
  }

  // --- LÓGICA ESPECÍFICA DE LA PÁGINA DE DETALLES ---
  function populateAnimeDetailsPage() {
    const container = $("#anime-detail-hero");
    if (!container.length) return;

    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get("id");
    const anime = animeData.find((a) => a.id === animeId);

    if (!anime) {
      $(".main-content").html("<h1>Anime no encontrado</h1>");
      return;
    }

    document.title = `Ver ${anime.title} - All-anime`;

    const styleBlock = `<style id="hero-style"> .anime-detail-hero { background-image: url('${anime.heroImg
      }'); } @media (max-width: 480px) { .anime-detail-hero { background-image: linear-gradient(to top, rgba(16, 16, 16, 1) 20%, transparent 80%), url('${anime.imgMobile || anime.img
      }'); background-position: center top; } } </style>`;
    $("#hero-style").remove();
    $("head").append(styleBlock);

    const heroContent = `
            <div class="hero-content">
                <img src="${anime.logoImg}" alt="${anime.title} Logo" class="anime-logo">
                <div class="anime-meta-tags">
                    <span>${anime.year}</span>
                    <span>${anime.seasons} Temporada(s)</span>
                    <span class="quality-tag-detail">${anime.quality}</span>
                </div>
                <div class="anime-genre-pills">${(anime.genres || []).map((g) => `<a href="explorar.html">${g}</a>`).join("")}</div>
                <p class="anime-description">${anime.description}</p>
                <div id="anime-rating"></div>
                <div class="anime-actions">
                    <button class="action-btn play open-player-from-details" data-episode-index="0"><i class="fas fa-play"></i> Play</button>
                    <button class="action-btn more-info" id="open-trailer-modal"><i class="fas fa-info-circle"></i> More Info</button>
                    <button class="action-btn favorite-btn" id="favorite-anime-btn" title="Agregar Anime a Favoritos"><i class="far fa-bookmark"></i></button>
                </div>
            </div>`;
    container.html(heroContent);
    mountRatingWidget(document.getElementById("anime-rating"), anime);

    const episodesContainer = $("#episodes-list-container");
    const seasonSelect = $("#season-select");
    let currentSeasonEpisodes = [];

    // Marca con badge "VISTO" los episodios ya vistos por el usuario.
    let watchedSetPromise = null;
    function applyWatchedBadges() {
      if (!watchedSetPromise) watchedSetPromise = getWatchedSet(anime.id);
      watchedSetPromise.then((set) => {
        if (!set || !set.size) return;
        currentSeasonEpisodes.forEach((ep, i) => {
          if (set.has(makeEpId(anime.id, ep))) {
            $(`.episode-detail-card[data-episode-index="${i}"]`).addClass("is-watched");
          }
        });
      });
    }

    const seasons =
      anime.episodes && anime.episodes.length > 0
        ? [...new Set(anime.episodes.map((e) => e.season))]
        : [];
    if (seasons.length > 0) {
      seasonSelect.empty();
      seasons.forEach((s) =>
        seasonSelect.append(`<option value="${s}">${s}</option>`)
      );
      seasonSelect.val(seasons[seasons.length - 1]);
    }

    function renderEpisodes(seasonName, searchTerm = "", sortOrder = "desc") {
      if (episodesContainer.hasClass("slick-initialized"))
        episodesContainer.slick("unslick");
      episodesContainer.empty();
      const normalizedSearchTerm = searchTerm.toLowerCase().trim();
      currentSeasonEpisodes = (anime.episodes || [])
        .filter(
          (e) =>
            e.season === seasonName &&
            (!normalizedSearchTerm ||
              e.title.toLowerCase().includes(normalizedSearchTerm) ||
              e.number.toString().includes(normalizedSearchTerm))
        )
        .sort((a, b) =>
          sortOrder === "asc" ? a.number - b.number : b.number - a.number
        );

      if (currentSeasonEpisodes.length === 0) {
        episodesContainer.html(
          '<p class="no-results">No se encontraron episodios.</p>'
        );
        return;
      }
      currentSeasonEpisodes.forEach((ep, index) => {
        const releaseDateTime = parseCustomDate(ep.releaseDate, ep.releaseTime);
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const isNew = releaseDateTime >= sevenDaysAgo;

        episodesContainer.append(`
                <div class="episode-detail-card" data-episode-index="${index}">
                    <a href="#" class="open-player-from-details" data-episode-index="${index}">
                        <div class="episode-img-container">
                            <img src="${ep.img}" alt="${ep.title
          }" loading="lazy">
                            ${isNew ? '<span class="new-tag">NUEVO</span>' : ""}
                            <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                            <span class="duration-tag">${ep.duration}</span>
                        </div>
                        <div class="episode-card-info">
                            <h5 class="episode-card-title">${ep.number}. ${ep.title
          }</h5>
                            <p class="episode-card-meta">${ep.language} • ${ep.releaseDate
          }</p>
                            <p class="episode-card-desc">${ep.description}</p>
                        </div>
                    </a>
                </div>`);
      });

      const savedView = localStorage.getItem("episodeViewPreference") || "grid";
      $(`#${savedView}-view-btn`).trigger("click");
      applyWatchedBadges();
    }

    const debouncedRender = debounce(
      () =>
        renderEpisodes(
          seasonSelect.val(),
          $("#episode-search").val(),
          $("#sort-episodes").val()
        ),
      300
    );
    seasonSelect.on("change", debouncedRender);
    $("#episode-search").on("input", debouncedRender);
    $("#sort-episodes").on("change", debouncedRender);

    $("#grid-view-btn, #list-view-btn, #carousel-view-btn").on(
      "click",
      function () {
        $(this).addClass("active").siblings().removeClass("active");
        const view = $(this).attr("id").split("-")[0];
        localStorage.setItem("episodeViewPreference", view); // Guardar preferencia
        if (episodesContainer.hasClass("slick-initialized"))
          episodesContainer.slick("unslick");
        episodesContainer.removeClass("grid list carousel").addClass(view);
        if (view === "carousel") {
          episodesContainer.slick({
            infinite: false,
            slidesToShow: 5,
            slidesToScroll: 1,
            responsive: [
              { breakpoint: 1024, settings: { slidesToShow: 2 } },
              { breakpoint: 768, settings: { slidesToShow: 1, arrows: false } },
            ],
          });
        }
      }
    );

    if (seasons.length > 0) {
      renderEpisodes(seasonSelect.val());
    }

    $("#modal-video-container").html(
      `<iframe width="560" height="315" src="${anime.trailerUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    );
    $("#modal-info-content").html(
      `<h3>${anime.title}</h3><p>${anime.description
      }</p><div class="modal-details-grid">${anime.rating
        ? `<div><strong>Rating:</strong> <i class="fas fa-star" style="color: #ffc107;"></i> ${anime.rating
        } ${anime.ratingCount ? `(${anime.ratingCount} votos)` : ""}</div>`
        : ""
      }<div><strong>Audio:</strong> ${anime.audio
      }</div><div><strong>Año:</strong> ${anime.year
      }</div><div><strong>Estado:</strong> ${anime.status
      }</div><div><strong>Creador:</strong> ${anime.creator
      }</div><div><strong>Clasificación:</strong> ${anime.contentWarning
      }</div></div>`
    );
    $("#open-trailer-modal").on("click", () =>
      $("#trailer-modal").css("display", "flex").hide().fadeIn()
    );
    $("#close-trailer-modal, .trailer-modal").on(
      "click",
      (e) =>
        (e.target === e.currentTarget || $(e.target).hasClass("close-modal")) &&
        $("#trailer-modal").fadeOut()
    );

    $(document).on("click", ".open-player-from-details", function (e) {
      e.preventDefault();
      const episode =
        currentSeasonEpisodes[parseInt($(this).data("episode-index"))];
      if (episode) openPlayer(anime, episode);
    });

    const favoriteAnimeBtn = $("#favorite-anime-btn");
    function getAnimeFavorites() {
      return JSON.parse(localStorage.getItem("favoriteAnimes")) || [];
    }
    function setAnimeFavLocal(id, on) {
      let f = getAnimeFavorites();
      if (on && !f.includes(id)) f.push(id);
      if (!on) f = f.filter((favId) => favId !== id);
      localStorage.setItem("favoriteAnimes", JSON.stringify(f));
    }
    function paintAnimeFav(on) {
      favoriteAnimeBtn
        .toggleClass("is-favorite", on)
        .attr("title", on ? "Quitar de Favoritos" : "Agregar a Favoritos")
        .find("i").toggleClass("fas", on).toggleClass("far", !on);
    }
    async function refreshAnimeFavState() {
      if (UD.isLoggedIn()) { try { paintAnimeFav(await UD.isFavAnime(animeId)); return; } catch {} }
      paintAnimeFav(getAnimeFavorites().includes(animeId));
    }
    UD.userReady.then(refreshAnimeFavState);
    refreshAnimeFavState();
    favoriteAnimeBtn.on("click", async (e) => {
      e.preventDefault();
      if (UD.isLoggedIn()) {
        try {
          const on = await UD.toggleFavAnime(anime);
          setAnimeFavLocal(animeId, on);
          paintAnimeFav(on);
        } catch (err) { console.error(err); }
      } else {
        const on = !getAnimeFavorites().includes(animeId);
        setAnimeFavLocal(animeId, on);
        paintAnimeFav(on);
      }
    });

    const seasonToOpen = urlParams.get("season");
    const episodeToOpen = urlParams.get("episode");
    if (seasonToOpen && episodeToOpen) {
      const episode = anime.episodes.find(
        (ep) =>
          ep.season === decodeURIComponent(seasonToOpen) &&
          ep.number == episodeToOpen
      );
      if (episode) setTimeout(() => openPlayer(anime, episode), 100);
    }
  }

  // --- LÓGICA ESPECÍFICA DE LA PÁGINA DE CALENDARIO ---
  function populateCalendarPage() {
    const last24hList = $("#last-24h-list");
    const lastWeekList = $("#last-week-list");
    if (!last24hList.length && !lastWeekList.length) return;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let allRecentEpisodes = [];
    animeData.forEach((anime) => {
      if (anime.episodes) {
        anime.episodes.forEach((episode) => {
          const releaseDateTime = parseCustomDate(
            episode.releaseDate,
            episode.releaseTime
          );
          if (releaseDateTime >= oneWeekAgo && releaseDateTime <= now) {
            allRecentEpisodes.push({
              anime,
              episode,
              dateTime: releaseDateTime,
            });
          }
        });
      }
    });

    allRecentEpisodes.sort((a, b) => b.dateTime - a.dateTime);

    const last24hAnimes = allRecentEpisodes.filter(
      (item) => item.dateTime >= oneDayAgo
    );
    const lastWeekAnimes = allRecentEpisodes.filter(
      (item) => item.dateTime < oneDayAgo
    );

    last24hList.empty();
    if (last24hAnimes.length > 0) {
      last24hAnimes.forEach((item) =>
        last24hList.append(createAnimeCard(item.anime))
      );
    } else {
      last24hList.html(
        '<p class="no-results">No se añadieron nuevos animes en las últimas 24 horas.</p>'
      );
    }

    lastWeekList.empty();
    if (lastWeekAnimes.length > 0) {
      lastWeekAnimes.forEach((item) =>
        lastWeekList.append(createAnimeCard(item.anime))
      );
    } else {
      lastWeekList.html(
        '<p class="no-results">No se añadieron nuevos animes en la última semana.</p>'
      );
    }
  }

  // --- EVENTOS GLOBALES Y DE NAVEGACIÓN ---
  $(window).scroll(() =>
    $("header").toggleClass("scrolled", $(window).scrollTop() > 50)
  );
  // --- Menú móvil (drawer) con backdrop y cierre al tocar enlace/fondo ---
  const $backdrop = $('<div class="nav-backdrop"></div>').appendTo("body");
  function closeMobileNav() {
    $("#menu-icon").removeClass("fa-times");
    $(".navbar").removeClass("nav-toggle");
    $backdrop.removeClass("show");
    $("body").css("overflow", "");
  }
  $("#menu-icon").click(function () {
    const open = !$(".navbar").hasClass("nav-toggle");
    $(this).toggleClass("fa-times", open);
    $(".navbar").toggleClass("nav-toggle", open);
    $backdrop.toggleClass("show", open);
    $("body").css("overflow", open ? "hidden" : "");
  });
  $backdrop.on("click", closeMobileNav);
  $(".navbar").on("click", "a", closeMobileNav);

  // (El hero se monta a nivel superior, no espera al catálogo. Ver setupHero abajo.)

  // CORRECCIÓN DEL BOTÓN MOSTRAR MÁS
  $("#show-more-episodes").on("click", function () {
    const yesterdaySection = $("#yesterday-episodes-container");
    yesterdaySection.slideToggle(400, () => {
      $(this).text(
        yesterdaySection.is(":visible") ? "Mostrar Menos" : "Mostrar Más"
      );
    });
  });

  $(".episodes-list")
    .on("mouseenter", ".episode-item a", function () {
      const item = $(this).closest(".episode-item");
      const hoverImg = item.data("hover-img");
      if (hoverImg) item.find(".episode-thumbnail img").attr("src", hoverImg);
      item
        .find(".episode-meta")
        .html(
          `<i class="fas fa-play"></i> Reproducir E${item.data("episode-num")}`
        );
    })
    .on("mouseleave", ".episode-item a", function () {
      const item = $(this).closest(".episode-item");
      item
        .find(".episode-thumbnail img")
        .attr("src", item.data("original-img"));
      item.find(".episode-meta").html(item.data("original-meta"));
    });

  const searchInput = $("#search-input"),
    searchResults = $("#search-results");
  $("#search-icon-toggle").on("click", (e) => {
    e.stopPropagation();
    if (window.innerWidth <= 768) { openMobileSearch(); return; }
    const c = $(".search-container");
    c.toggleClass("active");
    if (c.hasClass("active")) searchInput.focus();
  });

  // --- Búsqueda dedicada para móvil (overlay a pantalla completa) ---
  let mSearchBuilt = false;
  function buildMobileSearch() {
    if (mSearchBuilt) return;
    mSearchBuilt = true;
    $("body").append(`
      <div class="msearch-overlay" id="msearch-overlay">
        <div class="msearch-top">
          <input type="text" id="msearch-input" placeholder="Buscar anime…" autocomplete="off">
          <button class="msearch-close" id="msearch-close" aria-label="Cerrar">&times;</button>
        </div>
        <div class="msearch-results" id="msearch-results"></div>
      </div>`);
    const mInput = $("#msearch-input"), mRes = $("#msearch-results");
    const run = debounce(() => {
      const q = mInput.val().toLowerCase().trim();
      if (q.length < 2) { mRes.html('<p class="msearch-empty">Escribe para buscar…</p>'); return; }
      rememberSearch(q);
      const filtered = animeData.filter((a) => a.title.toLowerCase().includes(q)).slice(0, 30);
      mRes.html(filtered.length
        ? filtered.map((a) => `<a href="anime-details.html?id=${a.id}"><img src="${a.img}" alt=""><span class="t">${a.title}</span></a>`).join("")
        : '<p class="msearch-empty">No se encontraron resultados.</p>');
    }, 200);
    mInput.on("input", run);
    $("#msearch-close").on("click", closeMobileSearch);
  }
  function openMobileSearch() {
    buildMobileSearch();
    $("#msearch-overlay").addClass("open");
    $("body").css("overflow", "hidden");
    $("#msearch-results").html('<p class="msearch-empty">Escribe para buscar…</p>');
    setTimeout(() => $("#msearch-input").focus(), 60);
  }
  function closeMobileSearch() {
    $("#msearch-overlay").removeClass("open");
    $("body").css("overflow", "");
    $("#msearch-input").val("");
  }
  const performSearch = debounce(() => {
    const q = searchInput.val().toLowerCase().trim();
    if (q.length < 3) {
      searchResults.empty().hide();
      return;
    }
    rememberSearch(q);
    searchResults
      .empty()
      .show()
      .html('<div class="search-feedback"><div class="loader"></div></div>');
    const filtered = animeData.filter((a) => a.title.toLowerCase().includes(q));
    setTimeout(() => {
      searchResults.empty();
      if (filtered.length > 0)
        filtered
          .slice(0, 5)
          .forEach((a) =>
            searchResults.append(
              `<a href="anime-details.html?id=${a.id}"><img src="${a.img}" alt="${a.title}"><span>${a.title}</span></a>`
            )
          );
      else
        searchResults.html(
          '<div class="search-feedback">No se encontraron resultados.</div>'
        );
    }, 500);
  }, 300);
  searchInput.on("input", performSearch);
  $(document).on("click", (e) => {
    const c = $(".search-container");
    if (!c.is(e.target) && c.has(e.target).length === 0) {
      c.removeClass("active");
      searchResults.hide();
    }
  });

  $("#close-player-modal").on("click", () => {
    clearAutoplay();
    const playerModal = $("#episode-player-modal");
    const episodeId = playerModal.attr("data-episode-id");
    if (episodeId) saveToHistory(episodeId);
    populateContinueWatching();
    playerModal.fadeOut(() => $("#episode-iframe").attr("src", ""));
    $("body").css("overflow", "auto");
  });

  $(document).on("keyup", (e) => {
    if (e.key === "Escape") {
      if ($("#episode-player-modal").is(":visible"))
        $("#close-player-modal").click();
      if ($("#trailer-modal").is(":visible")) $("#close-trailer-modal").click();
    }
  });

  $(document).on("click", ".open-player-from-modal", function (e) {
    e.preventDefault();
    const animeId = $(this).data("anime-id");
    const season = decodeURIComponent($(this).data("season"));
    const episodeNumber = $(this).data("episode-number");
    const anime = animeData.find((a) => a.id === animeId);
    if (anime && anime.episodes) {
      const episode = anime.episodes.find(
        (ep) => ep.season === season && ep.number == episodeNumber
      );
      if (episode) openPlayer(anime, episode);
    }
  });

  $("#episode-player-modal").on("click", "#player-favorite-btn", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleEpisodeFavorite($(this).data("episode-id"));
  });

  // --- DESCUBRIMIENTO: Top 10, favoritos del público y recomendaciones ---
  function renderCarousel(rowSel, sectionSel, list) {
    const row = $(rowSel);
    if (!row.length || !list.length) return;
    if (row.hasClass("slick-initialized")) row.slick("unslick");
    row.empty();
    list.forEach((a) => row.append(createAnimeCard(a)));
    $(sectionSel).show();
    row.slick({
      infinite: false, slidesToShow: 6, slidesToScroll: 2,
      responsive: [
        { breakpoint: 1400, settings: { slidesToShow: 5 } },
        { breakpoint: 1024, settings: { slidesToShow: 4 } },
        { breakpoint: 768, settings: { slidesToShow: 3, arrows: false } },
        { breakpoint: 480, settings: { slidesToShow: 2, arrows: false } },
      ],
    });
  }
  function renderTop10(list) {
    const row = $("#top10-row");
    if (!row.length || !list.length) return;
    row.empty();
    list.slice(0, 10).forEach((a, i) => row.append(
      `<a class="top10-item" href="anime-details.html?id=${a.id}" title="${a.title}">
         <span class="top10-rank">${i + 1}</span>
         <img class="top10-poster" src="${a.img}" alt="${a.title}" loading="lazy"></a>`
    ));
    $("#top10-section").show();
    const el = row[0];
    const step = () => Math.max(el.clientWidth * 0.8, 300);
    $("#top10-prev").off("click").on("click", () => el.scrollBy({ left: -step(), behavior: "smooth" }));
    $("#top10-next").off("click").on("click", () => el.scrollBy({ left: step(), behavior: "smooth" }));
  }
  async function populateDiscovery() {
    if (!$("#top10-row").length && !$("#for-you-row").length) return; // solo en el inicio
    const byId = new Map(animeData.map((a) => [a.id, a]));
    const pop = await UD.getPopularAnimes(20);

    // Top 10 en Colombia (popularidad real; se completa con mejor valorados)
    let top = pop.map((p) => byId.get(p.id)).filter(Boolean);
    if (top.length < 10) {
      const have = new Set(top.map((a) => a.id));
      const extra = [...animeData]
        .filter((a) => a.type !== "Película" && !have.has(a.id))
        .sort((x, y) => (Number(y.rating) || 0) - (Number(x.rating) || 0));
      top = top.concat(extra).slice(0, 10);
    }
    renderTop10(top);

    // Favoritos del público (solo si ya hay datos de vistas)
    if (pop.length) {
      renderCarousel("#public-favs-row", "#public-favs-section", pop.map((p) => byId.get(p.id)).filter(Boolean).slice(0, 18));
    }

    // Recomendado para ti (personalizado, requiere sesión)
    if (UD.isLoggedIn()) {
      const [favA, hist] = await Promise.all([UD.listFavAnimes(), UD.listHistory(100)]);
      const seedIds = new Set([...favA.map((a) => a.id), ...hist.map((h) => h.animeId)]);
      const seeds = [...seedIds].map((id) => byId.get(id)).filter(Boolean);
      const recs = recommendForUser(animeData, seeds, [...seedIds], 18);
      renderCarousel("#for-you-row", "#for-you-section", recs);
    }
  }

  // --- INICIALIZACIÓN DE PÁGINAS ---
  populateHomePage();
  setupFilterPage("#explore-anime-grid", animeData);
  setupFilterPage(
    "#peliculas-anime-grid",
    animeData.filter((a) => a.type === "Película")
  );
  setupFavoritesPage();
  populateAnimeDetailsPage();
  populateCalendarPage();
  populateContinueWatching();
  populateHistoryPage();
  populateDiscovery();
  // Al confirmarse la sesión, recarga "seguir viendo" y recomendaciones.
  UD.userReady.then(() => { populateContinueWatching(); populateDiscovery(); });
  }); // fin de getAnimeData().then
});