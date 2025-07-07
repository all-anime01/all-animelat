import { animeData, newEpisodes } from "./database.js";

$(document).ready(function () {
  // --- FUNCIONES AUXILIARES ---
  function debounce(func, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // --- FUNCIONES PARA RENDERIZAR CONTENIDO DINÁMICO ---
  function createAnimeCard(anime) {
    return `
            <div class="anime-card">
                <a href="anime-details.html?id=${anime.id}">
                    <div class="card-image-container">
                        <img src="${
                          anime.img
                        }" alt="${anime.title}" loading="lazy">
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
            </div>
        `;
  }

  function createDynamicEpisodeItem(episode, anime) {
    const originalMeta = `Episodio ${episode.number} • ${episode.language}`;
    return `
        <li class="episode-item"
            data-original-img="${episode.img}"
            data-hover-img="${episode.img}" 
            data-original-meta="${originalMeta}"
            data-episode-num="${episode.number}">
            <a href="anime-details.html?id=${anime.id}">
                <div class="episode-thumbnail">
                    <img src="${episode.img}" alt="${anime.title} Cover" loading="lazy">
                    <div class="play-icon"><i class="fas fa-play"></i></div>
                </div>
                <div class="episode-details">
                    <p class="episode-title">${anime.title}</p>
                    <p class="episode-meta">${originalMeta}</p>
                </div>
            </a>
        </li>`;
  }

  function createFavoriteEpisodeCard(episode, anime) {
    return `
            <div class="episode-detail-card">
                <a href="anime-details.html?id=${anime.id}">
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

  function populateHomePage() {
    const recommendationsCarousel = $("#recommendations-carousel");
    const dubsCarousel = $("#dubs-carousel");
    const addedGrid = $("#added-animes-grid");
    const episodesListHoy = $("#episodes-hoy");
    const episodesListAyer = $("#episodes-ayer");

    if (recommendationsCarousel.length) {
      animeData
        .filter((a) => a.tags.includes("recomendado"))
        .forEach((anime) =>
          recommendationsCarousel.append(createAnimeCard(anime))
        );
    }
    if (dubsCarousel.length) {
      animeData
        .filter((a) => a.tags.includes("doblaje"))
        .forEach((anime) => dubsCarousel.append(createAnimeCard(anime)));
    }
    if (addedGrid.length) {
      animeData
        .filter((a) => a.tags.includes("agregado"))
        .forEach((anime) => addedGrid.append(createAnimeCard(anime)));
    }

    if (episodesListHoy.length || episodesListAyer.length) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isSameDay = (d1, d2) => {
        return (
          d1.getFullYear() === d2.getFullYear() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getDate() === d2.getDate()
        );
      };

      let todayEpisodes = [];
      let yesterdayEpisodes = [];

      animeData.forEach((anime) => {
        if (anime.episodes) {
          anime.episodes.forEach((episode) => {
            const releaseDate = new Date(episode.releaseDate);
            if (!isNaN(releaseDate)) {
              if (isSameDay(releaseDate, today)) {
                todayEpisodes.push({ anime, episode });
              } else if (isSameDay(releaseDate, yesterday)) {
                yesterdayEpisodes.push({ anime, episode });
              }
            }
          });
        }
      });

      episodesListHoy.empty();
      if (todayEpisodes.length > 0) {
        todayEpisodes
          .sort((a, b) => b.episode.number - a.episode.number)
          .forEach((item) =>
            episodesListHoy.append(
              createDynamicEpisodeItem(item.episode, item.anime)
            )
          );
      } else {
        episodesListHoy.html(
          '<p class="no-results" style="padding: 2rem 0;">No hay nuevos episodios hoy.</p>'
        );
      }

      episodesListAyer.empty();
      if (yesterdayEpisodes.length > 0) {
        yesterdayEpisodes
          .sort((a, b) => b.episode.number - a.episode.number)
          .forEach((item) =>
            episodesListAyer.append(
              createDynamicEpisodeItem(item.episode, item.anime)
            )
          );
        $("#yesterday-episodes-container").show();
        $("#show-more-episodes").show();
      } else {
        $("#yesterday-episodes-container").hide();
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

    const genreButtonsContainer = $("#genre-filter-buttons");
    const yearSelect = $("#year-select");
    const typeSelect = $("#type-select");
    const statusSelect = $("#status-select");
    const exploreSearch = $("#explore-search");
    const toggleFiltersBtn = $("#toggle-filters-btn");
    const filtersSection = $(".filters-section");

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

      const filteredData = sourceData.filter((anime) => {
        const matchesSearch = anime.title.toLowerCase().includes(searchQuery);
        const matchesGenre =
          selectedGenres.length === 0 ||
          selectedGenres.every((g) => anime.genres.includes(g));
        const matchesYear =
          yearSelect.length === 0 ||
          selectedYear === "all" ||
          anime.year == selectedYear;
        const matchesType =
          typeSelect.length === 0 ||
          selectedType === "all" ||
          anime.type === selectedType;
        const matchesStatus =
          statusSelect.length === 0 ||
          selectedStatus === "all" ||
          anime.status === selectedStatus;
        return (
          matchesSearch &&
          matchesGenre &&
          matchesYear &&
          matchesType &&
          matchesStatus
        );
      });

      grid.empty();
      if (filteredData.length > 0) {
        filteredData.forEach((anime) => grid.append(createAnimeCard(anime)));
      } else {
        grid.append(
          '<p class="no-results">No se encontraron resultados con estos filtros.</p>'
        );
      }
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
    if (!favoritesGrid.length) return;

    // Cargar Animes Favoritos
    const favoriteIds =
      JSON.parse(localStorage.getItem("favoriteAnimes")) || [];
    favoritesGrid.empty();
    if (favoriteIds.length === 0) {
      favoritesGrid.html(
        '<p class="no-results" style="padding: 2rem;">No has guardado ningún anime.</p>'
      );
    } else {
      const favoriteAnimes = animeData.filter((anime) =>
        favoriteIds.includes(anime.id)
      );
      favoriteAnimes.forEach((anime) =>
        favoritesGrid.append(createAnimeCard(anime))
      );
    }

    // Cargar Episodios Favoritos
    const favoriteEpisodeIds =
      JSON.parse(localStorage.getItem("favoriteEpisodes")) || [];
    favoriteEpisodesGrid.empty();
    if (favoriteEpisodeIds.length === 0) {
      favoriteEpisodesGrid.html(
        '<p class="no-results" style="padding: 2rem;">No has guardado ningún episodio.</p>'
      );
    } else {
      favoriteEpisodeIds.forEach((episodeId) => {
        const [animeId, seasonStr, episodeStr] = episodeId.split("-");
        const seasonNum = parseInt(seasonStr.replace("s", ""));
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

    const styleBlock = `
        <style id="hero-style">
            .anime-detail-hero {
                background-image: url('${anime.heroImg}');
            }
            @media (max-width: 480px) {
                .anime-detail-hero {
                    background-image: linear-gradient(to top, rgba(16, 16, 16, 1) 20%, transparent 80%), url('${
                      anime.imgMobile || anime.img
                    }');
                    background-position: center top;
                }
            }
        </style>
    `;
    $("#hero-style").remove();
    $("head").append(styleBlock);

    const LATEST_EPISODE_INDEX_IN_RENDERED_LIST = 0;

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
                <button class="action-btn play open-player-btn" data-episode-index="${LATEST_EPISODE_INDEX_IN_RENDERED_LIST}"><i class="fas fa-play"></i> Play</button>
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
      const latestSeason = Math.max(...seasons);
      seasonSelect.val(latestSeason);
    }

    function renderEpisodes(seasonNum, searchTerm = "", sortOrder = "desc") {
      if (episodesContainer.hasClass("slick-initialized")) {
        episodesContainer.slick("unslick");
      }
      episodesContainer.empty();
      const normalizedSearchTerm = searchTerm.toLowerCase().trim();

      currentSeasonEpisodes = anime.episodes
        .filter((e) => e.season == seasonNum)
        .filter((e) => {
          if (!normalizedSearchTerm) return true;
          const titleMatch = e.title
            .toLowerCase()
            .includes(normalizedSearchTerm);
          const numberMatch = e.number
            .toString()
            .includes(normalizedSearchTerm);
          return titleMatch || numberMatch;
        })
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
        const episodeCard = `
                <div class="episode-detail-card" data-episode-index="${index}">
                    <a href="#" class="open-player-btn" data-episode-index="${index}">
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
                </div>`;
        episodesContainer.append(episodeCard);
      });

      if (episodesContainer.hasClass("carousel")) {
        $("#carousel-view-btn").trigger("click");
      }
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
    $("#modal-info-content").html(`
        <h3>${anime.title}</h3>
        <p>${anime.description}</p>
        <div class="modal-details-grid">
            ${
              anime.rating
                ? `<div><strong>Rating:</strong> <i class="fas fa-star" style="color: #ffc107;"></i> ${
                    anime.rating
                  } ${
                    anime.ratingCount ? `(${anime.ratingCount} votos)` : ""
                  }</div>`
                : ""
            }
            <div><strong>Audio:</strong> ${anime.audio}</div>
            <div><strong>Año:</strong> ${anime.year}</div>
            <div><strong>Estado:</strong> ${anime.status}</div>
            <div><strong>Creador:</strong> ${anime.creator}</div>
            <div><strong>Clasificación:</strong> ${anime.contentWarning}</div>
        </div>
    `);

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
        if (episodesContainer.hasClass("slick-initialized")) {
          episodesContainer.slick("unslick");
        }
        episodesContainer.removeClass("grid list carousel").addClass(view);

        if (view === "carousel") {
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
      }
    );

    if (seasons.length > 0) {
      debouncedRender();
    }

    const playerModal = $("#episode-player-modal");

    // --- Lógica de Votos ---
    function getEpisodeVotes() {
      return JSON.parse(localStorage.getItem("episodeVotes")) || {};
    }
    function saveEpisodeVotes(votes) {
      localStorage.setItem("episodeVotes", JSON.stringify(votes));
    }
    function getUserEpisodeVote() {
      return JSON.parse(localStorage.getItem("userEpisodeVotes")) || {};
    }
    function saveUserEpisodeVote(userVotes) {
      localStorage.setItem("userEpisodeVotes", JSON.stringify(userVotes));
    }

    // --- Lógica de Favoritos de Episodios ---
    function getFavoriteEpisodes() {
      try {
        const favorites = localStorage.getItem("favoriteEpisodes");
        return Array.isArray(JSON.parse(favorites))
          ? JSON.parse(favorites)
          : [];
      } catch (e) {
        return [];
      }
    }
    function isEpisodeFavorite(episodeId) {
      return getFavoriteEpisodes().includes(episodeId);
    }
    function toggleEpisodeFavorite(episodeId) {
      let favorites = getFavoriteEpisodes();
      if (favorites.includes(episodeId)) {
        favorites = favorites.filter((id) => id !== episodeId);
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

    function openPlayer(displayIndex) {
      const episode = currentSeasonEpisodes[parseInt(displayIndex)];
      if (!episode) return;

      const episodeId = `${anime.id}-s${episode.season}-ep${episode.number}`;

      const seasonNavList = anime.episodes
        .filter((e) => e.season === episode.season)
        .sort((a, b) => a.number - b.number);

      const trueNavIndex = seasonNavList.findIndex(
        (e) => e.number === episode.number
      );
      const prevEpisode = seasonNavList[trueNavIndex - 1];
      const nextEpisode = seasonNavList[trueNavIndex + 1];

      const prevEpisodeDisplayIndex = prevEpisode
        ? currentSeasonEpisodes.findIndex(
            (e) => e.number === prevEpisode.number
          )
        : -1;
      const nextEpisodeDisplayIndex = nextEpisode
        ? currentSeasonEpisodes.findIndex(
            (e) => e.number === nextEpisode.number
          )
        : -1;

      $("#player-anime-link")
        .attr("href", `anime-details.html?id=${anime.id}`)
        .text(anime.title);
      $("#player-episode-title").text(`E${episode.number} - ${episode.title}`);

      const metaHtml = `
          <span>${episode.language}</span> &bull; <span>Lanzado el ${episode.releaseDate}</span>
          <button class="player-action-btn favorite-btn-player" id="player-favorite-btn" data-episode-id="${episodeId}" title="Agregar a Favoritos">
              <i class="far fa-bookmark"></i>
          </button>
      `;
      $("#player-episode-meta").html(metaHtml);
      updateEpisodeFavoriteButtonState(episodeId);

      $("#player-episode-description").text(episode.description);
      $("#episode-iframe").attr("src", episode.videoUrl || "");

      const prevPreviewContainer = $("#player-prev-episode-preview");
      prevPreviewContainer.empty();
      if (prevEpisode) {
        prevPreviewContainer.html(`
              <h5 class="player-nav-title">EPISODIO ANTERIOR</h5>
              <a href="#" class="player-nav-card open-player-btn" data-episode-index="${prevEpisodeDisplayIndex}">
                  <div class="player-nav-img-wrapper">
                    <img src="${prevEpisode.img}" alt="">
                    <div class="player-nav-play-icon"><i class="fas fa-play"></i></div>
                  </div>
                  <div class="player-nav-info">
                      <p>E${prevEpisode.number} - ${prevEpisode.title}</p>
                      <span>${prevEpisode.language}</span>
                  </div>
              </a>`);
      }

      const nextPreviewContainer = $("#player-next-episode-preview");
      nextPreviewContainer.empty();
      if (nextEpisode) {
        nextPreviewContainer.html(`
              <h5 class="player-nav-title">SIGUIENTE EPISODIO</h5>
              <a href="#" class="player-nav-card open-player-btn" data-episode-index="${nextEpisodeDisplayIndex}">
                  <div class="player-nav-img-wrapper">
                    <img src="${nextEpisode.img}" alt="">
                    <div class="player-nav-play-icon"><i class="fas fa-play"></i></div>
                  </div>
                  <div class="player-nav-info">
                      <p>E${nextEpisode.number} - ${nextEpisode.title}</p>
                      <span>${nextEpisode.language}</span>
                  </div>
              </a>`);
      }

      updateVoteUI(episodeId);

      playerModal.css("display", "flex").hide().fadeIn();
      $("body").css("overflow", "hidden");
    }

    function updateVoteUI(episodeId) {
      let allVotes = getEpisodeVotes();
      // Inicializar con datos base de la DB si no existe en localStorage
      if (!allVotes[episodeId]) {
        const epData = anime.episodes.find(
          (e) => `${anime.id}-s${e.season}-ep${e.number}` === episodeId
        );
        allVotes[episodeId] = {
          ...(epData?.votes || { likes: 0, dislikes: 0 }),
        };
        saveEpisodeVotes(allVotes);
      }

      const votes = allVotes[episodeId];

      const actionsHtml = `
            <button class="player-action-btn like-btn" data-episode-id="${episodeId}">
                <i class="fas fa-thumbs-up"></i> <span class="like-count">${votes.likes}</span>
            </button>
            <button class="player-action-btn dislike-btn" data-episode-id="${episodeId}">
                <i class="fas fa-thumbs-down"></i> <span class="dislike-count">${votes.dislikes}</span>
            </button>
        `;
      $("#player-episode-actions").html(actionsHtml);

      // Actualizar estado visual del botón
      const userVotes = getUserEpisodeVote();
      const userVote = userVotes[episodeId];
      $("#player-episode-actions .like-btn").toggleClass(
        "active",
        userVote === "like"
      );
      $("#player-episode-actions .dislike-btn").toggleClass(
        "active",
        userVote === "dislike"
      );
    }

    playerModal.on("click", ".like-btn, .dislike-btn", function (e) {
      e.stopPropagation();
      const episodeId = $(this).data("episode-id");
      const voteToApply = $(this).hasClass("like-btn") ? "like" : "dislike";

      let allVotes = getEpisodeVotes();
      let userVotes = getUserEpisodeVote();

      const currentVote = userVotes[episodeId];
      let voteData = allVotes[episodeId];

      // Si el usuario ya había votado por lo mismo, anula su voto.
      if (currentVote === voteToApply) {
        voteData[voteToApply === "like" ? "likes" : "dislikes"]--;
        userVotes[episodeId] = null; // Anular
      } else {
        // Si había un voto previo diferente, lo anula primero.
        if (currentVote) {
          voteData[currentVote === "like" ? "likes" : "dislikes"]--;
        }
        // Aplica el nuevo voto
        voteData[voteToApply === "like" ? "likes" : "dislikes"]++;
        userVotes[episodeId] = voteToApply;
      }

      allVotes[episodeId] = voteData;
      saveEpisodeVotes(allVotes);
      saveUserEpisodeVote(userVotes);
      updateVoteUI(episodeId);
    });

    $(document).on("click", ".open-player-btn", function (e) {
      e.preventDefault();
      openPlayer($(this).data("episode-index"));
    });

    $("#close-player-modal").on("click", () => {
      playerModal.fadeOut(() => $("#episode-iframe").attr("src", ""));
      $("body").css("overflow", "auto");
    });

    // Favoritos de Anime (el botón principal)
    const favoriteAnimeBtn = $("#favorite-anime-btn");

    function getAnimeFavorites() {
      return JSON.parse(localStorage.getItem("favoriteAnimes")) || [];
    }
    function isAnimeFavorite(id) {
      return getAnimeFavorites().includes(id);
    }
    function toggleAnimeFavorite(id) {
      let favorites = getAnimeFavorites();
      if (favorites.includes(id)) {
        favorites = favorites.filter((favId) => favId !== id);
      } else {
        favorites.push(id);
      }
      localStorage.setItem("favoriteAnimes", JSON.stringify(favorites));
      updateAnimeFavoriteButtonState(id);
    }
    function updateAnimeFavoriteButtonState(id) {
      if (isAnimeFavorite(id)) {
        favoriteAnimeBtn
          .addClass("is-favorite")
          .attr("title", "Quitar de Favoritos")
          .find("i")
          .removeClass("far")
          .addClass("fas");
      } else {
        favoriteAnimeBtn
          .removeClass("is-favorite")
          .attr("title", "Agregar Anime a Favoritos")
          .find("i")
          .removeClass("fas")
          .addClass("far");
      }
    }
    updateAnimeFavoriteButtonState(animeId);
    favoriteAnimeBtn.on("click", function (e) {
      e.preventDefault();
      toggleAnimeFavorite(animeId);
    });

    playerModal.on("click", "#player-favorite-btn", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const episodeId = $(this).data("episode-id");
      toggleEpisodeFavorite(episodeId);
    });

    $(document).on("keyup", function (e) {
      if (e.key === "Escape" && playerModal.is(":visible")) {
        $("#close-player-modal").click();
      }
    });
  }

  // --- LÓGICA ESPECÍFICA DE LA PÁGINA DE CALENDARIO ---
  function populateCalendarPage() {
    const last24hList = $("#last-24h-list");
    const lastWeekList = $("#last-week-list");
    if (!last24hList.length) return;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last24hAnimes = [];
    const lastWeekAnimes = [];

    animeData.forEach((anime) => {
      const addedDate = new Date(anime.dateAdded);
      if (addedDate >= oneDayAgo) {
        last24hAnimes.push(anime);
      } else if (addedDate >= oneWeekAgo) {
        lastWeekAnimes.push(anime);
      }
    });

    last24hList.empty();
    if (last24hAnimes.length > 0) {
      last24hAnimes.forEach((anime) =>
        last24hList.append(createAnimeCard(anime))
      );
    } else {
      last24hList.html(
        '<p class="no-results">No se añadieron animes en las últimas 24 horas.</p>'
      );
    }

    lastWeekList.empty();
    if (lastWeekAnimes.length > 0) {
      lastWeekAnimes.forEach((anime) =>
        lastWeekList.append(createAnimeCard(anime))
      );
    } else {
      lastWeekList.html(
        '<p class="no-results">No se añadieron animes en la última semana.</p>'
      );
    }
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
      if (hoverImg) {
        item.find(".episode-thumbnail img").attr("src", hoverImg);
      }
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

  const searchInput = $("#search-input");
  const searchResults = $("#search-results");

  $("#search-icon-toggle").on("click", (e) => {
    e.stopPropagation();
    const container = $(".search-container");
    container.toggleClass("active");
    if (container.hasClass("active")) searchInput.focus();
  });

  const performSearch = debounce(() => {
    const query = searchInput.val().toLowerCase().trim();
    if (query.length < 3) {
      searchResults.empty().hide();
      return;
    }

    searchResults
      .empty()
      .show()
      .html('<div class="search-feedback"><div class="loader"></div></div>');

    const filteredAnime = animeData.filter((anime) =>
      anime.title.toLowerCase().includes(query)
    );

    setTimeout(() => {
      searchResults.empty();
      if (filteredAnime.length > 0) {
        filteredAnime.slice(0, 5).forEach((anime) => {
          searchResults.append(
            `<a href="anime-details.html?id=${anime.id}"><img src="${anime.img}" alt="${anime.title}"><span>${anime.title}</span></a>`
          );
        });
      } else {
        searchResults.html(
          '<div class="search-feedback">No se encontraron resultados.</div>'
        );
      }
    }, 500);
  }, 300);

  searchInput.on("input", performSearch);

  $(document).on("click", (e) => {
    const searchContainer = $(".search-container");
    if (
      !searchContainer.is(e.target) &&
      searchContainer.has(e.target).length === 0
    ) {
      searchContainer.removeClass("active");
      searchResults.hide();
    }
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
});
