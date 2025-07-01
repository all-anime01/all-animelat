import { animeData, newEpisodes } from "./database.js";

$(document).ready(function () {
  // --- FUNCIONES PARA RENDERIZAR CONTENIDO DINÁMICO ---

  function createAnimeCard(anime) {
    return `
            <div class="anime-card">
                <a href="anime-details.html?id=${anime.id}">
                    <div class="card-image-container">
                        <img src="${anime.img}" alt="${anime.title}">
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
                        <img src="${episode.img}" alt="Anime Cover">
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
        slidesToScroll: 6,
        responsive: [
          {
            breakpoint: 1400,
            settings: { slidesToShow: 5, slidesToScroll: 5 },
          },
          {
            breakpoint: 1024,
            settings: { slidesToShow: 4, slidesToScroll: 4 },
          },
          {
            breakpoint: 768,
            settings: { slidesToShow: 3, slidesToScroll: 3, arrows: false },
          },
          {
            breakpoint: 480,
            settings: { slidesToShow: 2, slidesToScroll: 2, arrows: false },
          },
        ],
      });
    }
  }

  // --- LÓGICA ESPECÍFICA DE LA PÁGINA DE EXPLORAR ---
  function setupExplorePage() {
    const exploreGrid = $("#explore-anime-grid");
    const genreButtonsContainer = $("#genre-filter-buttons");
    const yearSelect = $("#year-select");
    const typeSelect = $("#type-select");
    const statusSelect = $("#status-select");
    const exploreSearch = $("#explore-search");
    const toggleFiltersBtn = $("#toggle-filters-btn");
    const filtersSection = $(".filters-section");

    if (!exploreGrid.length) return;

    // Ocultar filtros inicialmente
    filtersSection.hide();
    toggleFiltersBtn.on("click", function () {
      filtersSection.slideToggle();
    });

    // Poblar filtros
    const genres = [...new Set(animeData.flatMap((a) => a.genres))];
    genres.forEach((g) =>
      genreButtonsContainer.append(
        `<button class="genre-btn" data-genre="${g}">${g}</button>`
      )
    );

    const years = [...new Set(animeData.map((a) => a.year))].sort(
      (a, b) => b - a
    );
    yearSelect.append('<option value="all">Todos los años</option>');
    years.forEach((y) =>
      yearSelect.append(`<option value="${y}">${y}</option>`)
    );

    function applyFilters() {
      const searchQuery = exploreSearch.val().toLowerCase();
      const selectedGenres = $(".genre-btn.active")
        .map(function () {
          return $(this).data("genre");
        })
        .get();
      const selectedYear = yearSelect.val();
      const selectedType = typeSelect.val();
      const selectedStatus = statusSelect.val();

      const filteredData = animeData.filter((anime) => {
        const matchesSearch = anime.title.toLowerCase().includes(searchQuery);
        const matchesGenre =
          selectedGenres.length === 0 ||
          selectedGenres.every((g) => anime.genres.includes(g));
        const matchesYear =
          selectedYear === "all" || anime.year == selectedYear;
        const matchesType =
          selectedType === "all" || anime.type === selectedType;
        const matchesStatus =
          selectedStatus === "all" || anime.status === selectedStatus;

        return (
          matchesSearch &&
          matchesGenre &&
          matchesYear &&
          matchesType &&
          matchesStatus
        );
      });

      exploreGrid.empty();
      if (filteredData.length > 0) {
        filteredData.forEach((anime) =>
          exploreGrid.append(createAnimeCard(anime))
        );
      } else {
        exploreGrid.append(
          '<p class="no-results">No se encontraron animes con estos filtros.</p>'
        );
      }
    }

    exploreSearch.on("input", applyFilters);
    genreButtonsContainer.on("click", ".genre-btn", function () {
      $(this).toggleClass("active");
      applyFilters();
    });
    yearSelect.on("change", applyFilters);
    typeSelect.on("change", applyFilters);
    statusSelect.on("change", applyFilters);

    applyFilters(); // Carga inicial
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

    // Poblar Hero
    container.css("background-image", `url(${anime.heroImg})`);
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
                    <a href="#" class="action-btn play"><i class="fas fa-play"></i> Play</a>
                    <button class="action-btn more-info" id="open-trailer-modal"><i class="fas fa-info-circle"></i> More Info</button>
                </div>
            </div>`;
    container.html(heroContent);

    // Poblar Episodios
    const episodesContainer = $("#episodes-list-container");
    const seasonSelect = $("#season-select");

    const seasons = [...new Set(anime.episodes.map((e) => e.season))].sort(
      (a, b) => a - b
    );
    seasons.forEach((s) =>
      seasonSelect.append(`<option value="${s}">Temporada ${s}</option>`)
    );

    function renderEpisodes(seasonNum) {
      episodesContainer.empty();
      anime.episodes
        .filter((e) => e.season == seasonNum)
        .forEach((ep) => {
          const episodeCard = `
                    <div class="episode-detail-card">
                        <a href="#">
                            <div class="episode-img-container">
                                <img src="${ep.img}" alt="${ep.title}">
                                <div class="play-icon-overlay"><i class="fas fa-play"></i></div>
                                <span class="duration-tag">${ep.duration}</span>
                            </div>
                            <div class="episode-card-info">
                                <h5>${ep.number}. ${ep.title}</h5>
                            </div>
                        </a>
                    </div>
                `;
          episodesContainer.append(episodeCard);
        });
    }

    renderEpisodes(seasonSelect.val());
    seasonSelect.on("change", () => renderEpisodes(seasonSelect.val()));

    // Poblar Modal
    $("#modal-video-container").html(
      `<iframe width="560" height="315" src="${anime.trailerUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    );
    $("#modal-info-content").html(`
            <h3>${anime.title}</h3>
            <div class="overlay-stats">
                <span><i class="fas fa-star"></i> ${anime.rating}</span>
                <span>${anime.year}</span>
                <span>${anime.seasons} Temporada(s)</span>
            </div>
            <p>${anime.description}</p>
            <div class="modal-details-grid">
                <span><strong>Géneros:</strong> ${anime.genres.join(
                  ", "
                )}</span>
                <span><strong>Estado:</strong> ${anime.status}</span>
            </div>
        `);

    $("#open-trailer-modal").on("click", () =>
      $("#trailer-modal").css("display", "flex").hide().fadeIn()
    );
    $("#close-trailer-modal, .trailer-modal").on("click", function (e) {
      if ($(e.target).is(".trailer-modal, .close-modal")) {
        $("#trailer-modal").fadeOut();
      }
    });

    $("#grid-view-btn").on("click", function () {
      episodesContainer.removeClass("list").addClass("grid");
      $(this).addClass("active").siblings().removeClass("active");
    });
    $("#list-view-btn").on("click", function () {
      episodesContainer.removeClass("grid").addClass("list");
      $(this).addClass("active").siblings().removeClass("active");
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

    animeData.forEach((anime) => {
      if (anime.dateAdded >= oneDayAgo) {
        last24hList.append(createAnimeCard(anime));
      } else if (anime.dateAdded >= oneWeekAgo) {
        lastWeekList.append(createAnimeCard(anime));
      }
    });
  }

  // --- EVENTOS GLOBALES Y DE NAVEGACIÓN ---

  // Efecto de scroll en el encabezado
  $(window).scroll(function () {
    $("header").toggleClass("scrolled", $(this).scrollTop() > 50);
  });

  // Menú de navegación móvil
  $("#menu-icon").click(function () {
    $(this).toggleClass("fa-times");
    $(".navbar").toggleClass("nav-toggle");
  });

  // Lógica del carrusel de héroe (si existe)
  if ($(".hero-section").length) {
    const slides = $(".hero-slide");
    const navContainer = $(".hero-navigation");
    let currentSlide = 0;
    let slideInterval;

    slides.each(function (index) {
      const thumb = $("<div>").addClass("nav-thumb").data("index", index);
      if (index === 0) thumb.addClass("active");
      navContainer.append(thumb);
    });

    const thumbs = $(".nav-thumb");

    function showSlide(index) {
      slides.removeClass("active").eq(index).addClass("active");
      thumbs.removeClass("active").eq(index).addClass("active");
      currentSlide = index;
    }

    function startSlideShow() {
      slideInterval = setInterval(function () {
        showSlide((currentSlide + 1) % slides.length);
      }, 7000);
    }

    thumbs.click(function () {
      clearInterval(slideInterval);
      showSlide($(this).data("index"));
      startSlideShow();
    });

    startSlideShow();
  }

  // Botón "Mostrar Más" con lógica de toggle
  $("#show-more-episodes").on("click", function () {
    const yesterdaySection = $("#yesterday-episodes");
    const button = $(this);
    yesterdaySection.slideToggle(400, () => {
      button.text(
        yesterdaySection.is(":visible") ? "Mostrar Menos" : "Mostrar Más"
      );
    });
  });

  // Efecto Hover en Nuevos Episodios
  $(".episodes-list")
    .on("mouseenter", ".episode-item", function () {
      const item = $(this);
      const hoverImg = item.data("hover-img");
      const episodeNum = item.data("episode-num");

      item.find(".episode-thumbnail img").attr("src", hoverImg);
      item
        .find(".episode-meta")
        .html(`<i class="fas fa-play"></i> Reproducir E${episodeNum}`);
    })
    .on("mouseleave", ".episode-item", function () {
      const item = $(this);
      const originalImg = item.data("original-img");
      const originalMeta = item.data("original-meta");

      item.find(".episode-thumbnail img").attr("src", originalImg);
      item.find(".episode-meta").html(originalMeta);
    });

  // --- LÓGICA DE BÚSQUEDA ---
  const searchInput = $("#search-input");
  const searchResults = $("#search-results");

  searchInput.on("input", function () {
    const query = $(this).val().toLowerCase().trim();
    searchResults.empty().hide();

    if (query.length > 2) {
      const filteredAnime = animeData.filter((anime) =>
        anime.title.toLowerCase().includes(query)
      );

      if (filteredAnime.length > 0) {
        filteredAnime.forEach((anime) => {
          const resultItem = `
                        <a href="anime-details.html?id=${anime.id}">
                            <img src="${anime.img}" alt="${anime.title}">
                            <span>${anime.title}</span>
                        </a>`;
          searchResults.append(resultItem);
        });
        searchResults.show();
      }
    }
  });

  // Ocultar resultados al hacer clic fuera
  $(document).on("click", function (e) {
    if (!$(e.target).closest(".search-container").length) {
      searchResults.hide();
    }
  });

  // --- INICIALIZAR LAS PÁGINAS ---
  populateHomePage();
  setupExplorePage();
  populateAnimeDetailsPage();
  populateCalendarPage();
});
