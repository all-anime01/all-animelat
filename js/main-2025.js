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

  function createEpisodeItem(episode) {
    return `
            <li class="episode-item" 
                data-original-img="${episode.img}" 
                data-hover-img="${episode.hoverImg}"
                data-original-meta="${episode.meta}"
                data-episode-num="${episode.episodeNum}">
                <a href="${episode.url}">
                    <div class="episode-thumbnail">
                        <img src="${episode.img}" alt="Anime Cover" loading="lazy">
                        <div class="play-icon"><i class="fas fa-play"></i></div>
                    </div>
                    <div class="episode-details">
                        <p class="episode-title">${episode.title}</p>
                        <p class="episode-meta">${episode.meta}</p>
                    </div>
                    <p class="episode-time">${episode.time}</p>
                </a>
            </li>
        `;
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
    if (episodesListHoy.length) {
      newEpisodes
        .filter((ep) => ep.day === "hoy")
        .forEach((ep) => episodesListHoy.append(createEpisodeItem(ep)));
    }
    if (episodesListAyer.length) {
      newEpisodes
        .filter((ep) => ep.day === "ayer")
        .forEach((ep) => episodesListAyer.append(createEpisodeItem(ep)));
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
    if (!favoritesGrid.length) return;

    const favoriteIds =
      JSON.parse(localStorage.getItem("favoriteAnimes")) || [];

    favoritesGrid.empty();

    if (favoriteIds.length === 0) {
      favoritesGrid.html(
        '<p class="no-results" style="padding: 5rem 2rem;">Aún no has añadido ningún anime a tu lista de favoritos. <br><br> Usa el ícono del marcador ( <i class="fas fa-bookmark"></i> ) en la página de un anime para guardarlo aquí.</p>'
      );
      return;
    }

    const favoriteAnimes = animeData.filter((anime) =>
      favoriteIds.includes(anime.id)
    );

    favoriteAnimes.forEach((anime) => {
      favoritesGrid.append(createAnimeCard(anime));
    });
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

    // Inyectar CSS para la imagen de fondo adaptable
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
                <button class="action-btn favorite-btn" id="favorite-btn" title="Agregar a Favoritos"><i class="far fa-bookmark"></i></button>
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
    const episodeNavContainer = $("#episode-navigation-cards");

    function openPlayer(displayIndex) {
      const episode = currentSeasonEpisodes[parseInt(displayIndex)];
      if (!episode) return;

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

      $("#player-anime-title").text(anime.title);
      $("#player-episode-title").text(
        `Episodio ${episode.number}: ${episode.title}`
      );
      $("#player-episode-meta").text(
        `${episode.language} • ${episode.releaseDate}`
      );
      $("#player-episode-description").text(episode.description);
      $("#episode-iframe").attr("src", episode.videoUrl || "");

      episodeNavContainer.empty();
      const prevCard = `<a href="#" class="nav-episode-card prev ${
        !prevEpisode ? "disabled" : ""
      }" data-nav-index="${prevEpisodeDisplayIndex}"><img src="${
        prevEpisode
          ? prevEpisode.img
          : "https://placehold.co/120x70/181818/181818"
      }" alt=""><div class="nav-episode-card-info"><h5><i class="fas fa-backward"></i> Anterior</h5><p>${
        prevEpisode
          ? `Ep ${prevEpisode.number}: ${prevEpisode.title}`
          : "Inicio de temporada"
      }</p></div></a>`;
      const nextCard = `<a href="#" class="nav-episode-card next ${
        !nextEpisode ? "disabled" : ""
      }" data-nav-index="${nextEpisodeDisplayIndex}"><div class="nav-episode-card-info"><h5>Siguiente <i class="fas fa-forward"></i></h5><p>${
        nextEpisode
          ? `Ep ${nextEpisode.number}: ${nextEpisode.title}`
          : "Fin de temporada"
      }</p></div><img src="${
        nextEpisode
          ? nextEpisode.img
          : "https://placehold.co/120x70/181818/181818"
      }" alt=""></a>`;
      episodeNavContainer.append(prevCard).append(nextCard);

      playerModal.css("display", "flex").hide().fadeIn();
      $("body").css("overflow", "hidden");
    }

    $(document).on("click", ".open-player-btn", function (e) {
      e.preventDefault();
      openPlayer($(this).data("episode-index"));
    });

    $(document).on("click", ".nav-episode-card", function (e) {
      e.preventDefault();
      if ($(this).hasClass("disabled")) return;
      const navIndex = $(this).data("nav-index");
      if (navIndex !== -1) {
        openPlayer(navIndex);
      }
    });

    $("#close-player-modal").on("click", () => {
      playerModal.fadeOut(() => $("#episode-iframe").attr("src", ""));
      $("body").css("overflow", "auto");
    });

    const favoriteBtn = $("#favorite-btn");

    function getFavorites() {
      return JSON.parse(localStorage.getItem("favoriteAnimes")) || [];
    }

    function isFavorite(id) {
      return getFavorites().includes(id);
    }

    function toggleFavorite(id) {
      let favorites = getFavorites();
      if (favorites.includes(id)) {
        favorites = favorites.filter((favId) => favId !== id);
      } else {
        favorites.push(id);
      }
      localStorage.setItem("favoriteAnimes", JSON.stringify(favorites));
      updateFavoriteButtonState(id);
    }

    function updateFavoriteButtonState(id) {
      if (isFavorite(id)) {
        favoriteBtn.addClass("is-favorite");
        favoriteBtn.find("i").removeClass("far").addClass("fas");
        favoriteBtn.attr("title", "Quitar de Favoritos");
      } else {
        favoriteBtn.removeClass("is-favorite");
        favoriteBtn.find("i").removeClass("fas").addClass("far");
        favoriteBtn.attr("title", "Agregar a Favoritos");
      }
    }

    updateFavoriteButtonState(animeId);

    favoriteBtn.on("click", function (e) {
      e.preventDefault();
      toggleFavorite(animeId);
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
    const yesterdaySection = $("#yesterday-episodes");
    yesterdaySection.slideToggle(400, () =>
      $(this).text(
        yesterdaySection.is(":visible") ? "Mostrar Menos" : "Mostrar Más"
      )
    );
  });

  $(".episodes-list")
    .on("mouseenter", ".episode-item", function () {
      $(this)
        .find(".episode-thumbnail img")
        .attr("src", $(this).data("hover-img"));
      $(this)
        .find(".episode-meta")
        .html(
          `<i class="fas fa-play"></i> Reproducir E${$(this).data(
            "episode-num"
          )}`
        );
    })
    .on("mouseleave", ".episode-item", function () {
      $(this)
        .find(".episode-thumbnail img")
        .attr("src", $(this).data("original-img"));
      $(this).find(".episode-meta").html($(this).data("original-meta"));
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
