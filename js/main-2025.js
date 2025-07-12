import { animeData } from "./database.js";

$(document).ready(function () {
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

  function parseCustomDate(dateString) {
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
    const partsWithComma = dateString.replace(",", "").toLowerCase().split(" ");
    if (
      partsWithComma.length === 3 &&
      monthMap.hasOwnProperty(partsWithComma[0])
    ) {
      return new Date(
        partsWithComma[2],
        monthMap[partsWithComma[0]],
        partsWithComma[1]
      );
    }
    const partsWithSlash = dateString.split("/");
    if (partsWithSlash.length === 3) {
      let year = parseInt(partsWithSlash[2], 10);
      if (year < 100) year += 2000;
      return new Date(
        year,
        parseInt(partsWithSlash[1], 10) - 1,
        parseInt(partsWithSlash[0], 10)
      );
    }
    return new Date(dateString);
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

  function toggleEpisodeFavorite(episodeId) {
    let favorites = getFavoriteEpisodes();
    const index = favorites.indexOf(episodeId);
    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(episodeId);
    }
    localStorage.setItem("favoriteEpisodes", JSON.stringify(favorites));
    updateEpisodeFavoriteButtonState(episodeId);
  }

  function updateEpisodeFavoriteButtonState(episodeId) {
    const favBtn = $("#player-favorite-btn");
    if (isEpisodeFavorite(episodeId)) {
      favBtn
        .addClass("is-favorite")
        .attr("title", "Quitar de Favoritos")
        .find("i")
        .removeClass("far")
        .addClass("fas");
    } else {
      favBtn
        .removeClass("is-favorite")
        .attr("title", "Agregar a Favoritos")
        .find("i")
        .removeClass("fas")
        .addClass("far");
    }
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
    const link = `anime-details.html?id=${anime.id}&season=${episode.season}&episode=${episode.number}`;
    return `
            <div class="episode-detail-card">
                <a href="${link}">
                    <div class="episode-img-container">
                        <img src="${episode.img}" alt="${episode.title}" loading="lazy">
                        <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                        <span class="duration-tag">${episode.duration}</span>
                    </div>
                    <div class="episode-card-info">
                        <p style="color: var(--light-text); font-size: 1.4rem; margin-bottom: 0.5rem;">${anime.title}</p>
                        <h5 class="episode-card-title">${episode.number}. ${episode.title}</h5>
                        <p class="episode-card-meta">${episode.language} • ${episode.releaseDate}</p>
                    </div>
                </a>
            </div>`;
  }

  function populateContinueWatching() {
    const grid = $("#continue-watching-grid");
    const section = $("#continue-watching-section");
    if (!grid.length) return;

    const history = getWatchHistory();
    grid.empty();

    if (history.length === 0) {
      section.hide();
      return;
    }

    section.show();
    const itemsToShow = history.slice(0, 6);

    itemsToShow.forEach((item) => {
      const [animeId, seasonStr, episodeStr] = item.id.split("::");
      const seasonNum = parseInt(seasonStr.replace("s", ""));
      const episodeNum = parseFloat(episodeStr.replace("ep", ""));
      const anime = animeData.find((a) => a.id === animeId);
      if (anime && anime.episodes) {
        const episode = anime.episodes.find(
          (ep) => ep.season === seasonNum && ep.number === episodeNum
        );
        if (episode) {
          grid.append(createHistoryEpisodeCard(episode, anime));
        }
      }
    });
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
      const seasonNum = parseInt(seasonStr.replace("s", ""));
      const episodeNum = parseFloat(episodeStr.replace("ep", ""));
      const anime = animeData.find((a) => a.id === animeId);
      if (anime && anime.episodes) {
        const episode = anime.episodes.find(
          (ep) => ep.season === seasonNum && ep.number === episodeNum
        );
        if (episode) {
          grid.append(createHistoryEpisodeCard(episode, anime));
        }
      }
    });
  }

  // --- FUNCIÓN PRINCIPAL DEL REPRODUCTOR ---
  function openPlayer(anime, episode) {
    if (!anime || !episode) return;
    const playerModal = $("#episode-player-modal");

    const episodeId = `${anime.id}::s${episode.season}::ep${episode.number}`;
    playerModal.attr("data-episode-id", episodeId);

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
      `<span>${episode.language}</span> &bull; <span>Lanzado el ${episode.releaseDate}</span><button class="player-action-btn favorite-btn-player" id="player-favorite-btn" data-episode-id="${episodeId}" title="Agregar a Favoritos"><i class="far fa-bookmark"></i></button>`
    );
    updateEpisodeFavoriteButtonState(episodeId);
    $("#player-episode-description").text(episode.description);
    $("#episode-iframe").attr("src", episode.videoUrl || "");

    const prevPreviewContainer = $("#player-prev-episode-preview").empty();
    if (prevEpisode) {
      prevPreviewContainer.html(
        `<h5 class="player-nav-title">EPISODIO ANTERIOR</h5><a href="#" class="player-nav-card open-player-from-modal" data-anime-id="${anime.id}" data-season="${prevEpisode.season}" data-episode-number="${prevEpisode.number}"><div class="player-nav-img-wrapper"><img src="${prevEpisode.img}" alt=""><div class="player-nav-play-icon"><i class="fas fa-play"></i></div></div><div class="player-nav-info"><p>E${prevEpisode.number} - ${prevEpisode.title}</p><span>${prevEpisode.language}</span></div></a>`
      );
    }

    const nextPreviewContainer = $("#player-next-episode-preview").empty();
    if (nextEpisode) {
      nextPreviewContainer.html(
        `<h5 class="player-nav-title">SIGUIENTE EPISODIO</h5><a href="#" class="player-nav-card open-player-from-modal" data-anime-id="${anime.id}" data-season="${nextEpisode.season}" data-episode-number="${nextEpisode.number}"><div class="player-nav-img-wrapper"><img src="${nextEpisode.img}" alt=""><div class="player-nav-play-icon"><i class="fas fa-play"></i></div></div><div class="player-nav-info"><p>E${nextEpisode.number} - ${nextEpisode.title}</p><span>${nextEpisode.language}</span></div></a>`
      );
    }

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
                                <span><i class="fas fa-star"></i> ${
                                  anime.rating
                                }</span>
                                <span>${anime.seasons} Temporada(s)</span>
                            </div>
                            <div class="overlay-genres">
                                ${anime.genres
                                  .map((genre) => `<span>${genre}</span>`)
                                  .join("")}
                            </div>
                            <p class="overlay-description">${
                              anime.description
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
    const link = `anime-details.html?id=${anime.id}&season=${episode.season}&episode=${episode.number}`;
    return `
        <li class="episode-item" data-original-img="${initialImage}" data-hover-img="${episode.img}" data-original-meta="Episodio ${episode.number} • ${episode.language}" data-episode-num="${episode.number}">
            <a href="${link}">
                <div class="episode-thumbnail">
                    <img src="${initialImage}" alt="${anime.title} Cover" loading="lazy">
                    <div class="play-icon"><i class="fas fa-play"></i></div>
                </div>
                <div class="episode-details">
                    <p class="episode-title">${anime.title}</p>
                    <p class="episode-meta">Episodio ${episode.number} • ${episode.language}</p>
                </div>
            </a>
        </li>`;
  }

  function createFavoriteEpisodeCard(episode, anime) {
    const link = `anime-details.html?id=${anime.id}&season=${episode.season}&episode=${episode.number}`;
    return `
        <div class="episode-detail-card">
            <a href="${link}">
                <div class="episode-img-container">
                    <img src="${episode.img}" alt="${episode.title}" loading="lazy">
                    <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                    <span class="duration-tag">${episode.duration}</span>
                </div>
                <div class="episode-card-info">
                    <p style="color: var(--light-text); font-size: 1.4rem; margin-bottom: 0.5rem;">${anime.title}</p>
                    <h5 class="episode-card-title">${episode.number}. ${episode.title}</h5>
                    <p class="episode-card-meta">${episode.language} • ${episode.releaseDate}</p>
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
      const allEpisodes = animeData.flatMap((anime) =>
        (anime.episodes || []).map((episode) => ({
          anime,
          episode,
          releaseDate: parseCustomDate(episode.releaseDate),
        }))
      );
      const todayEpisodes = allEpisodes.filter(
        (item) => item.releaseDate.getTime() === today.getTime()
      );
      const yesterdayEpisodes = allEpisodes.filter(
        (item) => item.releaseDate.getTime() === yesterday.getTime()
      );

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
        yesterdayEpisodes.forEach((item) =>
          episodesListAyer.append(
            createDynamicEpisodeItem(item.episode, item.anime)
          )
        );
        yesterdayContainer.show();
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
        const seasonNum = parseInt(seasonStr.replace("s", ""), 10);
        const episodeNum = parseFloat(episodeStr.replace("ep", ""));
        const anime = animeData.find((a) => a.id === animeId);
        if (anime && anime.episodes) {
          const episode = anime.episodes.find(
            (ep) => ep.season === seasonNum && ep.number === episodeNum
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

    const styleBlock = `<style id="hero-style"> .anime-detail-hero { background-image: url('${
      anime.heroImg
    }'); } @media (max-width: 480px) { .anime-detail-hero { background-image: linear-gradient(to top, rgba(16, 16, 16, 1) 20%, transparent 80%), url('${
      anime.imgMobile || anime.img
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
                <p class="anime-description">${anime.description}</p>
                <div class="anime-actions">
                    <button class="action-btn play open-player-from-details" data-episode-index="0"><i class="fas fa-play"></i> Play</button>
                    <button class="action-btn more-info" id="open-trailer-modal"><i class="fas fa-info-circle"></i> More Info</button>
                    <button class="action-btn favorite-btn" id="favorite-anime-btn" title="Agregar Anime a Favoritos"><i class="far fa-bookmark"></i></button>
                </div>
            </div>`;
    container.html(heroContent);

    const episodesContainer = $("#episodes-list-container");
    const seasonSelect = $("#season-select");
    let currentSeasonEpisodes = [];

    const seasons =
      anime.episodes && anime.episodes.length > 0
        ? [...new Set(anime.episodes.map((e) => e.season))].sort(
            (a, b) => a - b
          )
        : [];
    if (seasons.length > 0) {
      seasons.forEach((s) =>
        seasonSelect.append(`<option value="${s}">Temporada ${s}</option>`)
      );
      seasonSelect.val(Math.max(...seasons));
    }

    function renderEpisodes(seasonNum, searchTerm = "", sortOrder = "desc") {
      if (episodesContainer.hasClass("slick-initialized"))
        episodesContainer.slick("unslick");
      episodesContainer.empty();
      const normalizedSearchTerm = searchTerm.toLowerCase().trim();
      currentSeasonEpisodes = (anime.episodes || [])
        .filter(
          (e) =>
            e.season == seasonNum &&
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
        episodesContainer.append(`
                <div class="episode-detail-card" data-episode-index="${index}">
                    <a href="#" class="open-player-from-details" data-episode-index="${index}">
                        <div class="episode-img-container">
                            <img src="${ep.img}" alt="${ep.title}" loading="lazy">
                            <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                            <span class="duration-tag">${ep.duration}</span>
                        </div>
                        <div class="episode-card-info">
                            <h5 class="episode-card-title">${ep.number}. ${ep.title}</h5>
                            <p class="episode-card-meta">${ep.language} • ${ep.releaseDate}</p>
                            <p class="episode-card-desc">${ep.description}</p>
                        </div>
                    </a>
                </div>`);
      });
      if (episodesContainer.hasClass("carousel"))
        $("#carousel-view-btn").trigger("click");
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
    $("#modal-video-container").html(
      `<iframe width="560" height="315" src="${anime.trailerUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    );
    $("#modal-info-content").html(
      `<h3>${anime.title}</h3><p>${
        anime.description
      }</p><div class="modal-details-grid">${
        anime.rating
          ? `<div><strong>Rating:</strong> <i class="fas fa-star" style="color: #ffc107;"></i> ${
              anime.rating
            } ${anime.ratingCount ? `(${anime.ratingCount} votos)` : ""}</div>`
          : ""
      }<div><strong>Audio:</strong> ${
        anime.audio
      }</div><div><strong>Año:</strong> ${
        anime.year
      }</div><div><strong>Estado:</strong> ${
        anime.status
      }</div><div><strong>Creador:</strong> ${
        anime.creator
      }</div><div><strong>Clasificación:</strong> ${
        anime.contentWarning
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
    $("#grid-view-btn, #list-view-btn, #carousel-view-btn").on(
      "click",
      function () {
        $(this).addClass("active").siblings().removeClass("active");
        const view = $(this).attr("id").split("-")[0];
        if (episodesContainer.hasClass("slick-initialized"))
          episodesContainer.slick("unslick");
        episodesContainer.removeClass("grid list carousel").addClass(view);
        if (view === "carousel")
          episodesContainer.slick({
            infinite: false,
            slidesToShow: 3,
            slidesToScroll: 1,
            responsive: [
              { breakpoint: 1024, settings: { slidesToShow: 2 } },
              { breakpoint: 768, settings: { slidesToShow: 1, arrows: false } },
            ],
          });
      }
    );
    if (seasons.length > 0) debouncedRender();

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
    function isAnimeFavorite(id) {
      return getAnimeFavorites().includes(id);
    }
    function toggleAnimeFavorite(id) {
      let f = getAnimeFavorites();
      if (f.includes(id)) f = f.filter((favId) => favId !== id);
      else f.push(id);
      localStorage.setItem("favoriteAnimes", JSON.stringify(f));
      updateAnimeFavoriteButtonState(id);
    }
    function updateAnimeFavoriteButtonState(id) {
      if (isAnimeFavorite(id))
        favoriteAnimeBtn
          .addClass("is-favorite")
          .attr("title", "Quitar de Favoritos")
          .find("i")
          .removeClass("far")
          .addClass("fas");
      else
        favoriteAnimeBtn
          .removeClass("is-favorite")
          .attr("title", "Agregar a Favoritos")
          .find("i")
          .removeClass("fas")
          .addClass("far");
    }
    updateAnimeFavoriteButtonState(animeId);
    favoriteAnimeBtn.on("click", (e) => {
      e.preventDefault();
      toggleAnimeFavorite(animeId);
    });

    const seasonToOpen = urlParams.get("season");
    const episodeToOpen = urlParams.get("episode");
    if (seasonToOpen && episodeToOpen) {
      const episode = anime.episodes.find(
        (ep) => ep.season == seasonToOpen && ep.number == episodeToOpen
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
    const animesInLists = new Set();
    const last24hAnimes = [],
      lastWeekAnimes = [];

    animeData.forEach((anime) => {
      if (anime.episodes && anime.episodes.length > 0) {
        const latestEpisode = anime.episodes.reduce((latest, current) =>
          parseCustomDate(current.releaseDate) >
          parseCustomDate(latest.releaseDate)
            ? current
            : latest
        );
        const releaseDate = parseCustomDate(latestEpisode.releaseDate);
        if (!animesInLists.has(anime.id)) {
          if (releaseDate >= oneDayAgo && releaseDate <= now) {
            last24hAnimes.push(anime);
            animesInLists.add(anime.id);
          } else if (releaseDate >= oneWeekAgo && releaseDate < oneDayAgo) {
            lastWeekAnimes.push(anime);
            animesInLists.add(anime.id);
          }
        }
      }
    });

    last24hList.empty();
    if (last24hAnimes.length > 0)
      last24hAnimes.forEach((anime) =>
        last24hList.append(createAnimeCard(anime))
      );
    else
      last24hList.html(
        '<p class="no-results">No se añadieron nuevos episodios en las últimas 24 horas.</p>'
      );
    lastWeekList.empty();
    if (lastWeekAnimes.length > 0)
      lastWeekAnimes.forEach((anime) =>
        lastWeekList.append(createAnimeCard(anime))
      );
    else
      lastWeekList.html(
        '<p class="no-results">No se añadieron nuevos episodios en la última semana.</p>'
      );
  }

  // --- EVENTOS GLOBALES Y DE NAVEGACIÓN ---
  $(window).scroll(() =>
    $("header").toggleClass("scrolled", $(window).scrollTop() > 50)
  );
  $("#menu-icon").click(function () {
    $(this).toggleClass("fa-times");
    $(".navbar").toggleClass("nav-toggle");
  });
  if ($(".hero-section").length) {
    const slides = $(".hero-slide");
    let currentSlide = 0;
    const showSlide = (index) => {
      slides.removeClass("active").eq(index).addClass("active");
      $(".nav-thumb").removeClass("active").eq(index).addClass("active");
      currentSlide = index;
    };
    let slideInterval = setInterval(
      () => showSlide((currentSlide + 1) % slides.length),
      7000
    );
    slides.each((index) =>
      $(".hero-navigation").append(
        $("<div>").addClass("nav-thumb").data("index", index)
      )
    );
    $(".nav-thumb").first().addClass("active");
    $(".nav-thumb").click(function () {
      clearInterval(slideInterval);
      showSlide($(this).data("index"));
      slideInterval = setInterval(
        () => showSlide((currentSlide + 1) % slides.length),
        7000
      );
    });
  }
  $("#show-more-episodes").on("click", function () {
    const yesterdaySection = $("#yesterday-episodes-container");
    yesterdaySection.slideToggle(400, () =>
      $(this).text(
        yesterdaySection.is(":visible") ? "Mostrar Menos" : "Mostrar Más"
      )
    );
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
    const c = $(".search-container");
    c.toggleClass("active");
    if (c.hasClass("active")) searchInput.focus();
  });
  const performSearch = debounce(() => {
    const q = searchInput.val().toLowerCase().trim();
    if (q.length < 3) {
      searchResults.empty().hide();
      return;
    }
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
    const playerModal = $("#episode-player-modal");
    const episodeId = playerModal.attr("data-episode-id");
    if (episodeId) saveToHistory(episodeId);
    if (typeof populateContinueWatching === "function")
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
    const season = $(this).data("season");
    const episodeNumber = $(this).data("episode-number");
    const anime = animeData.find((a) => a.id === animeId);
    if (anime && anime.episodes) {
      const episode = anime.episodes.find(
        (ep) => ep.season == season && ep.number == episodeNumber
      );
      if (episode) openPlayer(anime, episode);
    }
  });

  $("#episode-player-modal").on("click", "#player-favorite-btn", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleEpisodeFavorite($(this).data("episode-id"));
  });

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
});
