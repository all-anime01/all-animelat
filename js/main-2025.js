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
        slidesToScroll: 1,
        focusOnSelect: true,
        responsive: [
          { breakpoint: 1400, settings: { slidesToShow: 5 } },
          { breakpoint: 1024, settings: { slidesToShow: 4 } },
          { breakpoint: 768, settings: { slidesToShow: 3, arrows: false } },
          { breakpoint: 480, settings: { slidesToShow: 2, arrows: false } },
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

    filtersSection.hide();
    toggleFiltersBtn.on("click", function () {
      filtersSection.slideToggle();
    });

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

    applyFilters();
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

    // --- LÓGICA PARA ENCONTRAR EL ÚLTIMO EPISODIO ---
    let latestEpisodeIndex = 0;
    if (anime.episodes && anime.episodes.length > 0) {
      // Ordenar todos los episodios para encontrar el más reciente
      const sortedEpisodes = [...anime.episodes].sort((a, b) => {
        if (a.season !== b.season) {
          return b.season - a.season;
        }
        return b.number - a.number;
      });
      const latestEpisode = sortedEpisodes[0];

      // Encontrar el índice de este episodio DENTRO de su temporada
      latestEpisodeIndex = anime.episodes
        .filter((ep) => ep.season === latestEpisode.season)
        .sort((a, b) => a.number - b.number) // Asegurarse de que esté ordenado ascendentemente como lo hará renderEpisodes
        .findIndex((ep) => ep.number === latestEpisode.number);
    }
    // --- FIN DE LA LÓGICA ---

    container.css("background-image", `url(${anime.heroImg})`);
    // --- MODIFICAR LA CREACIÓN DEL BOTÓN ---
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
                    <button class="action-btn play open-player-btn" data-episode-index="${latestEpisodeIndex}"><i class="fas fa-play"></i> Play</button>
                    <button class="action-btn more-info" id="open-trailer-modal"><i class="fas fa-info-circle"></i> More Info</button>
                    <button class="action-btn gemini-btn" id="generate-synopsis-btn" data-anime-title="${anime.title}"><i class="fas fa-robot"></i> Sinopsis IA</button>
                </div>
            </div>`;
    container.html(heroContent);

    const episodesContainer = $("#episodes-list-container");
    const seasonSelect = $("#season-select");
    let currentSeasonEpisodes = [];

    const seasons = [...new Set(anime.episodes.map((e) => e.season))].sort(
      (a, b) => a - b
    );
    seasons.forEach((s) =>
      seasonSelect.append(`<option value="${s}">Temporada ${s}</option>`)
    );

    function renderEpisodes(seasonNum, searchTerm = "", sortOrder = "desc") {
      episodesContainer.empty();
      if (episodesContainer.hasClass("slick-initialized")) {
        episodesContainer.slick("unslick");
      }
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
        .sort((a, b) => {
          if (sortOrder === "asc") {
            return a.number - b.number;
          }
          return b.number - a.number;
        });

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
                            <img src="${ep.img}" alt="${ep.title}">
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
    }

    renderEpisodes(
      seasonSelect.val(),
      $("#episode-search").val(),
      $("#sort-episodes").val()
    );

    seasonSelect.on("change", () =>
      renderEpisodes(
        seasonSelect.val(),
        $("#episode-search").val(),
        $("#sort-episodes").val()
      )
    );
    $("#episode-search").on("input", () =>
      renderEpisodes(
        seasonSelect.val(),
        $("#episode-search").val(),
        $("#sort-episodes").val()
      )
    );
    $("#sort-episodes").on("change", function () {
      renderEpisodes(
        seasonSelect.val(),
        $("#episode-search").val(),
        $(this).val()
      );
      if ($("#carousel-view-btn").hasClass("active")) {
        $("#carousel-view-btn").trigger("click");
      }
    });

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
      if (episodesContainer.hasClass("slick-initialized")) {
        episodesContainer.slick("unslick");
      }
      episodesContainer.removeClass("list carousel").addClass("grid");
      $(this).addClass("active").siblings().removeClass("active");
    });
    $("#list-view-btn").on("click", function () {
      if (episodesContainer.hasClass("slick-initialized")) {
        episodesContainer.slick("unslick");
      }
      episodesContainer.removeClass("grid carousel").addClass("list");
      $(this).addClass("active").siblings().removeClass("active");
    });
    $("#carousel-view-btn").on("click", function () {
      episodesContainer.removeClass("grid list").addClass("carousel");
      $(this).addClass("active").siblings().removeClass("active");

      episodesContainer.slick({
        infinite: false,
        slidesToShow: 4,
        slidesToScroll: 1,
        responsive: [
          {
            breakpoint: 1400,
            settings: {
              slidesToShow: 3,
            },
          },
          {
            breakpoint: 1024,
            settings: {
              slidesToShow: 2,
            },
          },
          {
            breakpoint: 768,
            settings: {
              slidesToShow: 1,
              arrows: false,
            },
          },
        ],
      });
    });

    // Lógica del Reproductor de Episodios
    let currentEpisodeIndex = 0;
    const playerModal = $("#episode-player-modal");
    const episodeNavContainer = $("#episode-navigation-cards");

    function openPlayer(index) {
      currentEpisodeIndex = parseInt(index);
      const episode = currentSeasonEpisodes[currentEpisodeIndex];
      if (!episode) return;

      $("#player-anime-title").text(anime.title);
      $("#player-episode-title").text(
        `Episodio ${episode.number} - ${episode.title}`
      );
      $("#episode-iframe").attr("src", episode.videoUrl || "");

      $("#prev-episode-btn").prop("disabled", currentEpisodeIndex === 0);
      $("#next-episode-btn").prop(
        "disabled",
        currentEpisodeIndex >= currentSeasonEpisodes.length - 1
      );

      episodeNavContainer.empty();
      const prevEpisode = currentSeasonEpisodes[currentEpisodeIndex - 1];
      const nextEpisode = currentSeasonEpisodes[currentEpisodeIndex + 1];

      const prevCard = `
            <a href="#" class="nav-episode-card prev ${
              !prevEpisode ? "disabled" : ""
            }" data-nav-index="${currentEpisodeIndex - 1}">
                <img src="${
                  prevEpisode
                    ? prevEpisode.img
                    : "https://placehold.co/120x70/181818/181818"
                }" alt="">
                <div class="nav-episode-card-info">
                    <h5><i class="fas fa-backward"></i> Anterior</h5>
                    <p>${
                      prevEpisode
                        ? `Ep ${prevEpisode.number}: ${prevEpisode.title}`
                        : "Inicio de la temporada"
                    }</p>
                </div>
            </a>
        `;
      const nextCard = `
             <a href="#" class="nav-episode-card next ${
               !nextEpisode ? "disabled" : ""
             }" data-nav-index="${currentEpisodeIndex + 1}">
                <img src="${
                  nextEpisode
                    ? nextEpisode.img
                    : "https://placehold.co/120x70/181818/181818"
                }" alt="">
                <div class="nav-episode-card-info">
                    <h5>Siguiente <i class="fas fa-forward"></i></h5>
                    <p>${
                      nextEpisode
                        ? `Ep ${nextEpisode.number}: ${nextEpisode.title}`
                        : "Fin de la temporada"
                    }</p>
                </div>
            </a>
        `;
      episodeNavContainer.append(prevCard).append(nextCard);

      const disqusConfig = function () {
        this.page.url =
          window.location.href.split("?")[0] +
          `?id=${anime.id}&ep=${episode.number}`;
        this.page.identifier = `${anime.id}-ep-${episode.number}`;
        this.page.title = `${anime.title} - Episodio ${episode.number}`;
      };

      if (window.DISQUS) {
        DISQUS.reset({
          reload: true,
          config: disqusConfig,
        });
      } else {
        const script = document.createElement("script");
        $("#dsq-config-script").html(
          `var disqus_config = ${disqusConfig.toString()};`
        );
        script.src = "https://all-anime-net.disqus.com/embed.js";
        script.setAttribute("data-timestamp", +new Date());
        (document.head || document.body).appendChild(script);
      }

      playerModal.css("display", "flex").hide().fadeIn();
      $("body").css("overflow", "hidden");
    }

    $(document).on("click", ".open-player-btn", function (e) {
      e.preventDefault();
      const index = $(this).data("episode-index");
      openPlayer(index);
    });

    $(document).on("click", ".nav-episode-card", function (e) {
      e.preventDefault();
      if ($(this).hasClass("disabled")) return;
      const index = $(this).data("nav-index");
      openPlayer(index);
    });

    $("#close-player-modal").on("click", () => {
      playerModal.fadeOut();
      $("#episode-iframe").attr("src", ""); // Detener video
      $("body").css("overflow", "auto");
    });

    $("#prev-episode-btn").on("click", () => {
      if (currentEpisodeIndex > 0) {
        openPlayer(currentEpisodeIndex - 1);
      }
    });

    $("#next-episode-btn").on("click", () => {
      if (currentEpisodeIndex < currentSeasonEpisodes.length - 1) {
        openPlayer(currentEpisodeIndex + 1);
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

    animeData.forEach((anime) => {
      if (new Date(anime.dateAdded) >= oneDayAgo) {
        last24hList.append(createAnimeCard(anime));
      } else if (new Date(anime.dateAdded) >= oneWeekAgo) {
        lastWeekList.append(createAnimeCard(anime));
      }
    });
  }

  // --- EVENTOS GLOBALES Y DE NAVEGACIÓN ---

  $(window).scroll(function () {
    $("header").toggleClass("scrolled", $(this).scrollTop() > 50);
  });

  $("#menu-icon").click(function () {
    $(this).toggleClass("fa-times");
    $(".navbar").toggleClass("nav-toggle");
  });

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

  $("#show-more-episodes").on("click", function () {
    const yesterdaySection = $("#yesterday-episodes");
    const button = $(this);
    yesterdaySection.slideToggle(400, () => {
      button.text(
        yesterdaySection.is(":visible") ? "Mostrar Menos" : "Mostrar Más"
      );
    });
  });

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

  // --- LÓGICA DE BÚSQUEDA DEL NAVBAR ---
  const searchInput = $("#search-input");
  const searchIcon = $("#search-icon-toggle");
  const searchContainer = $(".search-container");
  const searchResults = $("#search-results");

  searchIcon.on("click", function (e) {
    e.stopPropagation();
    searchContainer.toggleClass("active");
    if (searchContainer.hasClass("active")) {
      searchInput.focus();
    }
  });

  searchInput.on("input", function () {
    const query = $(this).val().toLowerCase().trim();
    searchResults.empty().hide();

    if (query.length > 2) {
      const filteredAnime = animeData.filter((anime) =>
        anime.title.toLowerCase().includes(query)
      );

      if (filteredAnime.length > 0) {
        filteredAnime.slice(0, 5).forEach((anime) => {
          // Limitar a 5 resultados
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

  $(document).on("click", function (e) {
    if (
      !searchContainer.is(e.target) &&
      searchContainer.has(e.target).length === 0
    ) {
      searchContainer.removeClass("active");
      searchResults.hide();
    }
  });

  // --- LÓGICA DE LA API DE GEMINI ---
  async function getAiSynopsis(animeTitle) {
    const aiSynopsisContent = $("#ai-synopsis-content");
    const aiModal = $("#ai-synopsis-modal");

    aiModal.css("display", "flex").hide().fadeIn();
    aiSynopsisContent.html('<div class="loader"></div>');

    const prompt = `Genera una sinopsis creativa y emocionante para el anime "${animeTitle}". Describe el mundo, el conflicto principal y el viaje del protagonista de una manera que atraiga a nuevos espectadores. No incluyas spoilers importantes. Formatea la respuesta en párrafos.`;

    try {
      // SIMULACIÓN DE LLAMADA A API PARA EVITAR ERRORES DE API KEY
      setTimeout(() => {
        const text = `En un mundo devastado por la magia, donde los reinos se alzan y caen con el poder de los cristales arcanos, emerge una figura solitaria. Para "${animeTitle}", la supervivencia es una batalla diaria en un paisaje lleno de bestias corruptas y cazadores de reliquias sin escrúpulos.\nPero cuando un encuentro predestinado le otorga una habilidad única —la capacidad de ver los hilos del destino—, su vida cambia para siempre. Ahora, no solo debe luchar por su propia vida, sino también desentrañar una conspiración que amenaza con deshacer el tejido mismo de la realidad. Su viaje lo llevará desde los suburbios olvidados hasta las cortes reales, forjando alianzas inesperadas y enfrentándose a enemigos que preferiría olvidar.`;
        const formattedText = text
          .split("\n")
          .map((p) => `<p>${p}</p>`)
          .join("");
        aiSynopsisContent.html(formattedText);
      }, 1500);
    } catch (error) {
      console.error("Error al generar sinopsis:", error);
      aiSynopsisContent.html(
        "<p>Lo sentimos, no se pudo generar la sinopsis en este momento. Por favor, inténtalo de nuevo más tarde.</p>"
      );
    }
  }

  $(document).on("click", "#generate-synopsis-btn", function () {
    const animeTitle = $(this).data("anime-title");
    getAiSynopsis(animeTitle);
  });

  $("#close-ai-modal, .ai-modal").on("click", function (e) {
    if ($(e.target).is(".ai-modal, .close-modal")) {
      $("#ai-synopsis-modal").fadeOut();
    }
  });

  // --- INICIALIZAR LAS PÁGINAS ---
  populateHomePage();
  setupExplorePage();
  populateAnimeDetailsPage();
  populateCalendarPage();
});
