// --- BASE DE DATOS DE ANIMES ---
// En un proyecto real, esto vendría de un servidor o una API.

export const animeData = [
  {
    id: "solo-leveling",
    title: "Solo Leveling",
    img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/010e9f451f47228a462243b853a8176f.jpe",
    heroImg:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=94,width=1920/CurationAssets/Solo%20Leveling/SEASON%202/ULTRA-WIDE/SoloLeveling-S2-KV1-UW-LTR.png",
    logoImg:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480/CurationAssets/Solo%20Leveling/SEASON%202/ULTRA-WIDE/SoloLeveling-S2-KV1-UW-Logo.png",
    trailerUrl: "https://www.youtube.com/embed/eQy9WfQkL3w",
    description:
      "Conocido como el cazador más débil de la humanidad, se encuentra en una lucha constante por la supervivencia. Después de una experiencia cercana a la muerte, adquiere un poder único para subir de nivel.",
    genres: ["Acción", "Aventura", "Fantasía"],
    rating: 4.9,
    seasons: 2,
    episodesTotal: 25,
    status: "Finalizado",
    year: 2024,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "agregado", "doblaje"],
    dateAdded: new Date(), // Hoy
    episodes: [
      {
        season: 1,
        number: 1,
        title: "Estoy acostumbrado",
        duration: "23 min",
        img: "https://img1.ak.crunchyroll.com/i/spire4/1b92d63914833ff3a45c3a0b3a95995e1704823419_main.jpg",
      },
      {
        season: 1,
        number: 2,
        title: "Si tuviera una oportunidad más",
        duration: "23 min",
        img: "https://img1.ak.crunchyroll.com/i/spire1/2d06248a58744216c414963e6303841a1705165684_main.jpg",
      },
      {
        season: 1,
        number: 3,
        title: "Es como un juego",
        duration: "23 min",
        img: "https://img1.ak.crunchyroll.com/i/spire3/901a5559c6b3c3b05f2495f26941f5311705773413_main.jpg",
      },
      {
        season: 2,
        number: 25,
        title: "Al siguiente objetivo",
        duration: "23 min",
        img: "https://img1.ak.crunchyroll.com/i/spire1/1a293b685a23d4f8fc4152912a7288f31690858883_main.jpg",
      },
      {
        season: 2,
        number: 24,
        title: "¿Eres el rey de los humanos?",
        duration: "23 min",
        img: "https://img1.ak.crunchyroll.com/i/spire4/e7887411c401319d67554559383679631689625399_main.jpg",
      },
    ],
  },
  {
    id: "pokemon-horizons",
    title: "Pokémon: Horizons",
    img: "https://cdn.jkdesu.com/assets/images/animes/image/pokemon-shinsaku-anime.jpg",
    description:
      "Pocket Mosnters es una historia sobre dos misteriosos personajes de Pokémon, Liko y Roy, que están enredados en el mundo de Pokémon. Sus aventuras y destinos cambiarán a medida que se encuentren con nuevas criaturas y encuentros.",
    genres: ["Aventura"],
    rating: 4.9,
    seasons: 1,
    episodes: 99,
    status: "En emisión",
    year: 2024,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "agregado", "doblaje"],
    dateAdded: new Date(), // Hoy
  },
  {
    id: "pokemon-viajes",
    title: "Pokémon: Viajes",
    img: "https://all-anime.net/image/Pokemon-mezase-pokemon-master/p.jpg",
    description:
      "La historia final protagonizada por Satoshi y Pikachu para concluir Pokémon (2019). Aquí comienza la cuenta regresiva para despedirnos de Satoshi y Pikachu como protagonistas.",
    genres: ["Aventura"],
    rating: 4.8,
    seasons: 25,
    episodes: 1223,
    status: "Finalizado",
    year: 2019,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "doblaje"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 1)), // Ayer
  },
  {
    id: "ranger-reject",
    title: "Ranger Reject (Sentai Daishikkaku)",
    img: "/image/ranger-reject/p.webp",
    description:
      "Con su antiguo escondite y sus jefes aniquilados, los Dusters supervivientes llegan a un acuerdo secreto con el equipo Ranger para participar en el enfrentamiento dominical, uno en el que siempre serán derrotados. ¡Cansado de esta farsa, el Luchador D finalmente da un paso al frente para hacer un cambio de una vez por todas!.",
    genres: ["Acción", "Aventura", "Comedia", "Fantasía"],
    rating: 4.9,
    seasons: 2,
    episodes: 19,
    status: "En emisión",
    year: 1999,
    type: "TV",
    quality: "1080p",
    tags: ["agregado", "recomendado", "doblaje"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 22)), // Hace 22 dias
  },
  {
    id: "dr-stone",
    title: "Dr. STONE",
    img: "https://a.storyblok.com/f/178900/960x1357/d42021c586/dr-stone-science-future-kv.jpeg/m/filters:quality(95)format(webp)",
    description:
      "Un día fatídico, toda la humanidad quedó petrificada por un destello de luz cegadora. Después de varios milenios, el estudiante Taiju despierta y se encuentra perdido en un mundo de estatuas.",
    genres: ["Aventura", "Ciencia Ficción", "Comedia"],
    rating: 4.8,
    seasons: 3,
    episodes: 57,
    status: "Finalizado",
    year: 2019,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "doblaje"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 1)), // Ayer
  },
  {
    id: "one-piece",
    title: "One Piece",
    img: "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/757bae5a21039bac6ebace5de9affcd8.jpe",
    description:
      "Monkey D. Luffy se niega a que nadie se interponga en su camino para convertirse en el rey de los piratas. ¡Una aventura épica por los mares en busca del tesoro legendario!",
    genres: ["Acción", "Aventura", "Comedia", "Fantasía"],
    rating: 4.9,
    seasons: 21,
    episodes: 1100,
    status: "En emisión",
    year: 1999,
    type: "TV",
    quality: "1080p",
    tags: ["agregado", "recomendado"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 2)), // Hace 2 dias
  },
  {
    id: "demon-slayer",
    title: "Demon Slayer",
    img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/f356e33a59518a1a361e6123485c2d43.jpe",
    description:
      "Tanjiro Kamado, un joven de buen corazón, encuentra a su familia masacrada por un demonio. Para empeorar las cosas, su hermana menor, Nezuko, ha sido transformada en un demonio.",
    genres: ["Acción", "Fantasía", "Histórico"],
    rating: 4.9,
    seasons: 4,
    episodes: 55,
    status: "En emisión",
    year: 2019,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "agregado", "doblaje"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 5)), // Hace 5 dias
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    img: "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/ebcd65fa9fb83580062e7052fa6ee5a5.jpe",
    description:
      "Yuji Itadori se traga un talismán maldito para proteger a sus amigos y ahora comparte su cuerpo con un poderoso demonio. Se une a una sociedad secreta de Hechiceros Jujutsu para cazar maldiciones.",
    genres: ["Acción", "Fantasía", "Escolar"],
    rating: 4.8,
    seasons: 2,
    episodes: 47,
    status: "Finalizado",
    year: 2020,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "agregado", "doblaje"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 3)), // Hace 3 dias
  },
  {
    id: "spy-x-family",
    title: "SPY x FAMILY",
    img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/6b53c5c9676c86f45c81f33775928d3c.jpe",
    description:
      "El maestro espía 'Twilight' debe formar una familia falsa para llevar a cabo una misión. Lo que no sabe es que la 'esposa' que elige es una asesina y la 'hija' es una telépata.",
    genres: ["Acción", "Comedia", "Slice of Life"],
    rating: 4.9,
    seasons: 2,
    episodes: 37,
    status: "Finalizado",
    year: 2022,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "agregado", "doblaje"],
    dateAdded: new Date(), // Hoy
  },
  {
    id: "blue-lock",
    title: "Blue Lock",
    img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/b5621ff1277ed6ad1006b0c6f14900bb.jpg",
    description:
      "Tras una desastrosa derrota en el Mundial, 300 de los mejores delanteros de Japón son reunidos en una instalación similar a una prisión llamada 'Blue Lock' para crear al delantero más egoísta del mundo.",
    genres: ["Deportes", "Drama"],
    rating: 4.7,
    seasons: 1,
    episodes: 24,
    status: "Finalizado",
    year: 2022,
    type: "TV",
    quality: "1080p",
    tags: ["recomendado", "doblaje", "agregado"],
    dateAdded: new Date(new Date().setDate(new Date().getDate() - 38)), // Hace 38 dias
  },
];

export const newEpisodes = [
  {
    id: 1,
    title: "I've Been Killing Slimes For 300 Years",
    meta: "Episodio 5 • Sub | Dob",
    time: "14:00",
    img: "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=1200,height=675/catalog/crunchyroll/fa62dd1fc7a9bc0b587f36f53bf572c1.jpg",
    hoverImg:
      "https://img1.ak.crunchyroll.com/i/spire1/b753dcccb08721820482a868353388f61618002633_main.jpg",
    url: "#",
    day: "hoy",
    episodeNum: 5,
  },
  {
    id: 2,
    title: "Private Tutor to the Duke's Daughter",
    meta: "Episodio 1 • Subtitulado",
    time: "12:00",
    img: "https://www.crunchyroll.com/imgsrv/display/thumbnail/240x360/catalog/crunchyroll/36181b3b55c6b841315842838423403a.jpe",
    hoverImg:
      "https://img1.ak.crunchyroll.com/i/spire2/d6c810e46c1f10255c27f31ab2c24c7e1720377038_main.jpg",
    url: "#",
    day: "hoy",
    episodeNum: 1,
  },
  {
    title: "Classic Stars",
    meta: "Episodio 13",
    time: "12:15",
    img: "https://www.crunchyroll.com/imgsrv/display/thumbnail/240x360/catalog/crunchyroll/d719910d5538e1b343a4155b1784d1a0.jpe",
    url: "#",
    day: "hoy",
  },
  {
    title: "Dr. STONE",
    meta: "Episodio 12 • Sub | Dob",
    time: "15:00",
    img: "https://a.storyblok.com/f/178900/960x1357/d42021c586/dr-stone-science-future-kv.jpeg/m/filters:quality(95)format(webp)",
    url: "#",
    day: "ayer",
  },
  {
    title: "Jujutsu Kaisen",
    meta: "Episodio 24 • Subtitulado",
    time: "18:30",
    img: "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/ebcd65fa9fb83580062e7052fa6ee5a5.jpe",
    url: "#",
    day: "ayer",
  },
];
