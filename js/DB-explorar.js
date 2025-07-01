// Datos de ejemplo de anime DB
const animes = [
  {
    id: 1,
    name: "Naruto",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/8532171bec0d05bfe45769a330fbab82.jpe",
    link: "https://all-anime.net/Naruto-tv",
    description:
      "Un joven ninja con el sueño de convertirse en el líder de su aldea.",
    type: "Sub | Dob",
    seasons: 9,
    episodes: "Subiendo...",
  },
  {
    id: 2,
    name: "Naruto Shippuden",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/01ec367b44f0a568430a957e042639af.jpe",
    link: "#naruto",
    description:
      "La continuación de las aventuras de Naruto en su búsqueda por salvar a su amigo Sasuke.",
    type: "Sub | Dob",
    seasons: 17,
    episodes: "Subiendo...",
  },
  {
    id: 3,
    name: "One Piece",
    category: "aventura",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/757bae5a21039bac6ebace5de9affcd8.jpe",
    link: "https://all-anime.net/ver/One-piece/tv",
    description:
      "Las aventuras de Monkey D. Luffy y su tripulación en busca del tesoro conocido como One Piece.",
    type: "Sub | Dob",
    seasons: 14,
    episodes: 1132,
  },
  {
    id: 4,
    name: "My Hero Academia",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/6e008ad5211c3998b8f3e4bc166821cd.jpg",
    link: "https://all-anime.net/ver/My-hero-academia/tv",
    description:
      "En un mundo donde la mayoría de la población tiene superpoderes, un joven sin poderes lucha por convertirse en un héroe.",
    type: "Sub | Dob",
    seasons: 7,
    episodes: 159,
  },
  {
    id: 5,
    name: "Death Note",
    category: "sobrenatural",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/697c8b5ff2f49a97348b5507c06e1183.jpg",
    link: "https://all-anime.net/ver/Death-note/tv",
    description:
      "Light Yagami es un estudiante brillante con mucho futuro que se aburre a más no poder. Pero todo cambia cuando encuentra la Death Note, un cuaderno que dejó caer un rebelde dios de la muerte.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 37,
  },
  {
    id: 6,
    name: "Platinum End",
    category: "sobrenatural",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/a003327d23ee474087f40d5efa8afa2d.jpe",
    link: "https://all-anime.net/ver/Platinum-end/tv",
    description:
      "Mirai Kakehashi perdió a sus padres en un accidente y lleva una vida miserable desde que tuvo que irse a vivir con los parientes que se encargaron de él. Habiendo perdido la esperanza en todo, decide saltar desde lo alto de un edificio el mismo día que se gradúa de secundaria. Es entonces cuando se encuentra con un ángel",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 24,
  },
  {
    id: 7,
    name: "Fullmetal Alchemist",
    category: "fantasia",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/0662921aa3b81ff85737ddeb56deefab.jpe",
    link: "https://all-anime.net/ver/Fullmetal-alchemist-brotherhood/tv",
    description:
      "Dos hermanos alquimistas buscan la Piedra Filosofal para recuperar sus cuerpos después de un experimento fallido.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: "Subiendo...",
  },
  {
    id: 8,
    name: "Tower of God",
    category: "fantasia",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/5d5e5f5263126fcaa27c63c5306dbdcc.jpg",
    link: "https://all-anime.net/ver/Tower-of-god/tv",
    description:
      "Un joven entra en una misteriosa torre en busca de una chica que lo abandonó.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 38,
  },
  {
    id: 9,
    name: "Fairy Tail 100 Years Quest",
    category: "fantasia",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/6c66ccc8929c10b5deb599c4d1a6d5e1.jpg",
    link: "https://all-anime.net/ver/Fairy-tail-100-years-quest/tv",
    description:
      "Natsu y sus amigos emprenden una misión que no ha sido completada en 100 años.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 25,
  },
  {
    id: 10,
    name: "Kaiju No.8",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/format=auto,fit=contain,width=480,height=720,quality=85/catalog/crunchyroll/bb5785a9fe043b8331b7842068bfcb05.jpe",
    link: "https://all-anime.net/ver/Kaiju-No-8/tv",
    description:
      "En un mundo plagado de monstruos, un hombre obtiene la habilidad de transformarse en uno de ellos.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 11,
    name: "Quality Assurance in Another World",
    category: "comedia",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/4e20adfbae580632399ac5e7196929e6.jpg",
    link: "https://all-anime.net/ver/Quality-Assurance-in-Another-World/tv",
    description:
      "Un ingeniero de control de calidad es transportado a un mundo de fantasía donde aplica sus habilidades.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 13,
  },
  {
    id: 12,
    name: "Wind Breaker",
    category: "accion",
    image:
      "https://a.storyblok.com/f/178900/1064x1506/f3ef268371/wind-breaker-season-2-key-visual-en.jpg/m/filters:quality(95)format(webp)",
    link: "https://all-anime.net/ver/Wind-Breaker/tv",
    description:
      "Haruka Sakura, un novato en la delincuente Preparatoria Furin, busca abrirse paso luchando. La escuela ahora tiene un grupo protector llamado Wind Breaker. Comienza su leyenda.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 24,
  },
  {
    id: 13,
    name: "Tokyo Revenger",
    category: "drama",
    image: "/image/Tokyo-Revengers/T3/p.jpg",
    link: "https://all-anime.net/ver/Tokyo-revengers/tv",
    description:
      "Un joven viaja en el tiempo para salvar a su novia y a sus amigos de un futuro trágico.",
    type: "Sub | Dob",
    seasons: 3,
    episodes: 50,
  },
  {
    id: 14,
    name: "Kimetsu no Yaiba",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/format=auto,fit=contain,width=480,height=720,quality=85/catalog/crunchyroll/765ee047befcfb677d169f5de4c82d5c.jpe",
    link: "https://all-anime.net/ver/Kimetsu-no-yaiba/tv",
    description:
      "Un joven se convierte en cazador de demonios para vengar a su familia y curar a su hermana.",
    type: "Sub | Dob",
    seasons: 4,
    episodes: 63,
  },
  {
    id: 15,
    name: "Ao Ashi",
    category: "deporte",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/f1540a6b98f7b986993e7d2019a62512.jpg",
    link: "https://all-anime.net/ver/Ao-ashi/tv",
    description:
      "Ashito Aoi, un talentoso estudiante de Ehime, es invitado por el entrenador Fukuda a probarse en un equipo juvenil en Tokio, iniciando su camino para revolucionar el fútbol en Japón.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 24,
  },
  {
    id: 16,
    name: "Shingeki no Kyojin",
    category: "drama",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/323c82257b2f6567fabbb7bd55bfa753.jpe",
    link: "https://all-anime.net/ver/Shingeki-no-kyojin/tv",
    description:
      "La humanidad se refugió en una ciudad amurallada para escapar de criaturas gigantes. Ahora, esa paz se ve amenazada y se descubrirá el origen de los Titanes.",
    type: "Sub | Dob",
    seasons: 4,
    episodes: 90,
  },
  {
    id: 17,
    name: "Captain Tsubasa",
    category: "deporte",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/format=auto,fit=contain,width=480,height=720,quality=85/catalog/crunchyroll/f18cc7982a918da38a3b8e47c4ab6295.jpe",
    link: "https://all-anime.net/ver/Captain-Tsubasa/tv",
    description:
      "Tsubasa Oozora, un niño de 11 años amante del fútbol, se traslada a Nankatsu para mejorar sus habilidades y es desafiado por el portero Genzo Wakabayashi. Ambos competirán para demostrar quién es el mejor jugador.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 91,
  },
  {
    id: 18,
    name: "Blue Exorcist",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/cead08fd2ced6e6dbe056ce0381da6ff.jpg",
    link: "https://all-anime.net/ver/Ao-no-exorcist/tv",
    description:
      "Assiah, el mundo humano, y Gehenna, el mundo demoníaco, rara vez se cruzan. Sin embargo, algunos humanos pueden exorcizar demonios: los exorcistas.",
    type: "Subtitulado",
    seasons: 3,
    episodes: 73,
  },
  {
    id: 19,
    name: "Avatar: La leyenda de Aang",
    category: "aventura",
    image:
      "https://wwwimage-intl.pplusstatic.com/thumbnails/photos/w370-q80/show_asset/37/84/44/show_asset_53bb5de4-aa5f-4f85-bed3-c098f143c13f.jpg",
    link: "https://all-anime.net/ver/Avatar-la-leyenda-de-Aang/tv",
    description:
      "Aang, el nuevo Avatar, y sus amigos emprenden un viaje épico para salvar al mundo de la Nación del Fuego, que busca conquistar las demás naciones.",
    type: "Sub | Dob",
    seasons: 3,
    episodes: 61,
  },
  {
    id: 20,
    name: "Tragones y Mazmorras",
    category: "comedia",
    image: "https://all-anime.net/image/Tragones-y-mazmorras/T1/p.webp",
    link: "https://all-anime.net/ver/Tragones-y-mazmorras/tv",
    description:
      "Mazmorras, tragones ¡y exquisitos guisos de monstruos! Nada se salva del apetito de estos aventureros cuando se adentran en un reino maldito para salvar a uno de los suyos.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 24,
  },
  {
    id: 21,
    name: "Undead Unluck",
    category: "accion",
    image:
      "https://cdn.jkdesu.com/assets/images/animes/image/undead-unluck.jpg",
    link: "https://all-anime.net/ver/Undead-unluck/tv",
    description:
      "Fuuko Izumo, con una habilidad que causa desgracias, intenta suicidarse tras leer el final de su manga favorito. Es salvada por Andy, un inmortal que también quiere morir. Juntos buscan paz mientras una organización siniestra los persigue.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 24,
  },
  {
    id: 22,
    name: "Jujutsu Kaisen",
    category: "accion",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/ebcd65fa9fb83580062e7052fa6ee5a5.jpe",
    link: "https://all-anime.net/ver/Undead-unluck/tv",
    description:
      "Yuji Itadori se traga un dedo maldito para salvar a alguien de su clase y ahora Ryomen Sukuna, un poderoso hechicero malvado conocido como el Rey de las Maldiciones, vive en su alma.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 47,
  },
  {
    id: 23,
    name: "Ousama Ranking",
    category: "drama",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/1500ddfac4a1ffbc767603fcac1b9b2a.jpe",
    link: "https://all-anime.net/ver/Ousama-ranking/tv",
    description:
      "La historia se centra en Bojji, un débil y sordo príncipe que no puede sostener incluso una espada para niños. Como el primogénito, sostiene su enorme deseo de convertirse en el más poderoso rey del mundo. Bojji consigue su primer amigo, llamado Kage (sombra), literalmente una sombra en el suelo que de alguna manera puede entender a Bojji.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 33,
  },
  {
    id: 24,
    name: "Soul Eater",
    category: "accion",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/1b083a97efcac96d6f3f6c3880321f93.jpe",
    link: "https://all-anime.net/ver/Soul-Eater/tv",
    description:
      "¡Luchando con ghouls y monstruos junto con sus compañeros de clase, Maka y Soul son la última línea de defensa del mundo contra la maldad!.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 51,
  },
  {
    id: 25,
    name: "Shaman King (2021)",
    category: "accion",
    image: "https://all-anime.net/image/Shaman-king-2021/ShK-Poster.jpg",
    link: "https://all-anime.net/Shaman-king(2021)-tv",
    description:
      "Una batalla está a punto de comenzar en Tokio: la Batalla de Chamanes, una competencia que se realiza cada quinientos años en donde los Chamanes (aquellos que pueden comandar espíritus) se confrontan entre sí. Sin embargo, resulta sorprendente también que Manta sea capaz de verlos.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 52,
  },
  {
    id: 26,
    name: "Shaman King: Flowers",
    category: "accion",
    image: "https://all-anime.net/image/Shaman-king-flowers/p.jpg",
    link: "https://all-anime.net/ver/Shaman-king-flowers/tv",
    description:
      "La continuación de Shaman King, siguiendo las aventuras de la siguiente generación de chamanes.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 13,
  },
  {
    id: 27,
    name: "Bleach",
    category: "accion",
    image: "https://all-anime.net/image/Bleach/p.jpg",
    link: "https://all-anime.net/ver/Bleach/tv",
    description:
      "Kurosaki Ichigo es un estudiante de instituto de 15 años, que tiene una peculiaridad: es capaz de ver, oír y hablar con fantasmas.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: "Subiendo...",
  },
  {
    id: 28,
    name: "Bleach: Thousand Year Blood War",
    category: "accion",
    image:
      "https://all-anime.net/image/Bleach-thousand-year-blood-war/T3/p.jpg",
    link: "https://all-anime.net/ver/Bleach-sennen-kessen-hen/tv",
    description:
      "Finalmente el Seireitei, hogar de los Soul Reapers, es atacado por un grupo que se hace llamar Wandenreich la historia y la verdad que los Soul Reapers mantuvieron oculta durante mil largos años finalmente salen a la luz.",
    type: "Sub | Dob",
    seasons: 3,
    episodes: 40,
  },
  {
    id: 29,
    name: "Pluto",
    category: "accion",
    image:
      "https://images.ctfassets.net/4cd45et68cgf/4ESSpHx4iyHhdk6GEMhRjO/6b0f609919df286437ffa98c7e51a428/en-US_pluto_main_main_vertical_27x40_rgb_pre_1.jpg",
    link: "https://all-anime.net/ver/Pluto/tv",
    description:
      "Cuando los siete robots más avanzados del mundo y sus aliados humanos son asesinados uno por uno, el inspector Gesicht descubre que él también está en peligro.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 8,
  },
  {
    id: 30,
    name: "Black Clover",
    category: "accion",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/e108ae17d8d0407417cac40eb52d849a.jpe",
    link: "https://all-anime.net/ver/Black-clover/tv",
    description:
      "En un mundo en el que la magia lo es todo, Asta y Yuno son dos niños que encuentran abandonados el mismo día en una iglesia. Pero para ello tendrán que ser seleccionados primero por una Orden de Caballeros Mágicos, ¡y Asta no tiene magia!.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 64,
  },
  {
    id: 31,
    name: "Ranma 1/2 (2024)",
    category: "comedia",
    image: "/image/Ranma-1-2-2024/T1/p.jpg",
    link: "https://all-anime.net/ver/Ranma-1-2-2024/tv",
    description:
      "Ranma Saotome es un chico que sufre una peculiar maldición al caer en unos estanques malditos durante un entrenamiento de artes marciales.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 11,
  },
  {
    id: 32,
    name: "Dragon Ball Z",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/35e4ac6339f5fdcc164160a5755790cd.jpe",
    link: "https://all-anime.net/ver/Dragon-ball-z/tv",
    description:
      "Villanos terroríficamente malvados de los rincones más oscuros del espacio y el tiempo se enfrentan con la Tierra, y Goku, el guerrero más fuerte del planeta, es todo lo que se interpone entre la humanidad y la extinción. Acompañado en la batalla por los valientes Guerreros Z, Goku viaja a reinos lejanos y peligrosos en busca de los poderes mágicos de las siete Dragon Balls. . . ¡y de una buena pelea!",
    type: "Sub | Dob",
    seasons: 3,
    episodes: 35,
  },
  {
    id: 33,
    name: "Kinnikuman Perfect Origin Arc",
    category: "accion",
    image: "https://all-anime.net/image/Kinnikuman-Perfect-Origin-Arc/T1/p.jpg",
    link: "https://all-anime.net/ver/Kinnikuman-Perfect-Origin-Arc/tv",
    description:
      "Una nueva serie de Kinnikuman está programada para celebrar el 40 aniversario del anime original, adaptando el manga Perfect Origin. Kinnikuman, un verdadero heredero al trono, ahora lucha contra otros cinco supervillanos en un Real Torneo Real de Supervivientes.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 22,
  },
  {
    id: 34,
    name: "Pokémon: Horizons",
    category: "aventura",
    image:
      "https://cdn.jkdesu.com/assets/images/animes/image/pokemon-shinsaku-anime.jpg",
    link: "https://all-anime.net/ver/Pokemon-horizons/tv",
    description:
      "Pocket Mosnters es una historia sobre dos misteriosos personajes de Pokémon, Liko y Roy, que están enredados en el mundo de Pokémon. Sus aventuras y destinos cambiarán a medida que se encuentren con nuevas criaturas y encuentros.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 99,
  },
  {
    id: 35,
    name: "Pokémon: Viajes",
    category: "aventura",
    image: "https://all-anime.net/image/Pokemon-mezase-pokemon-master/p.jpg",
    link: "https://all-anime.net/ver/Pokemon-viajes/tv",
    description:
      "La historia final protagonizada por Satoshi y Pikachu para concluir Pokémon (2019). Aquí comienza la cuenta regresiva para despedirnos de Satoshi y Pikachu como protagonistas.",
    type: "Sub | Dob",
    seasons: 25,
    episodes: 1223,
  },
  {
    id: 36,
    name: "Ranger Reject (Sentai Daishikkaku)",
    category: "accion",
    image: "https://all-anime.net/image/Ranger-reject/T2/p.webp",
    link: "https://all-anime.net/ver/Ranger-reject/tv",
    description:
      "Con su antiguo escondite y sus jefes aniquilados, los Dusters supervivientes llegan a un acuerdo secreto con el equipo Ranger para participar en el enfrentamiento dominical, uno en el que siempre serán derrotados. ¡Cansado de esta farsa, el Luchador D finalmente da un paso al frente para hacer un cambio de una vez por todas!.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 19,
  },
  {
    id: 37,
    name: "Zom 100: The Bucket List of the Dead",
    category: "comedia",
    image:
      "https://all-anime.net/image/Zom-100-The-Bucket-List-of-the-Dead/p.jpe",
    link: "https://all-anime.net/ver/Zom-100-The-Bucket-List-of-the-Dead/tv",
    description:
      "Akira ve cómo una empresa explotadora le absorbe por completo la vida. Mientras tanto, cuando su ciudad es azotada repentinamente por un apocalipsis zombi, encuentra un nuevo sentido a la vida.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 38,
    name: "Viral Hit",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/format=auto,fit=contain,width=480,height=720,quality=85/catalog/crunchyroll/a0ad4900ae610de44eb49dfc0881cc6a.jpe",
    link: "https://all-anime.net/ver/Viral-Hit/tv",
    description:
      "Pero después de seguir algunos consejos de un misterioso canal de NewTube, Hobin pronto noquea a tipos más fuertes que él y recauda más dinero del que jamás hubiera soñado.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 39,
    name: "Under Ninja",
    category: "accion",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/39201a3e092424769aac68d0b8211dce.jpe",
    link: "https://all-anime.net/ver/Under-ninja/tv",
    description:
      "Todavía existen unos 200'000 ninjas que llevan a cabo misiones mortales como organización secreta, la Inteligencia Nacional de NINJA, o NIN por sus siglas, hasta que surge un contrincante: UNDER NINJA, conocidos bajo las siglas UN, estos ninjas se oponen a NIN a cada paso que dan.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 40,
    name: "Undead Murder Farce",
    category: "sobrenatural",
    image:
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/e02ff0b76c447cbd0e512545bdf71e51.jpe",
    link: "https://all-anime.net/ver/Undead-Murder-Farce/tv",
    description:
      "En el siglo XIX, en un mundo habitado por vampiros, gólems, hombres lobo y otras criaturas sobrenaturales, Aya Rindo es una belleza inmortal con cabeza pero sin cuerpo. Acompañada por Tsugaru Shinuchi, una cazadora de demonios mitad humana, mitad demonio, y su fiel sirvienta, Shizuku Hasei, viaja por Europa resolviendo misterios sobrenaturales mientras busca su cuerpo perdido.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 13,
  },
  {
    id: 41,
    name: "Isekai Suicide Squad",
    category: "accion",
    image: "https://all-anime.net/image/Isekai-Suicide-Squad/p.jpg",
    link: "https://all-anime.net/ver/Isekai-Suicide-Squad/tv",
    description:
      "Amanda Waller, responsable de A.R.G.U.S., envía al Escuadrón Suicida a una misión en otro planeta: ¡ISEKAI!.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 10,
  },
  {
    id: 42,
    name: "NieR:Automata Ver1.1a",
    category: "fantasia",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/60ae0b1c6c34b3ef0279f07481a3b983.jpg",
    link: "https://all-anime.net/ver/Nier-automata-ver-1-1a/tv",
    description:
      "NieR: Automata narra la historia de los androides 2B, 9S y A2 luchando contra máquinas invadidas por seres mecánicos. La resistencia humana envía a soldados androides para destruir a los invasores, revelando una verdad potencialmente olfativa sobre el mundo.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 24,
  },
  {
    id: 43,
    name: "Trigun Stampede",
    category: "accion",
    image: "https://all-anime.net/image/Trigun-stampede/p.jpe",
    link: "https://all-anime.net/ver/Trigun-stampede/tv",
    description:
      "Una joven periodista y colega veterano se enfrenta al desafío de localizar Vash Estampida, el Huracán Humano, y cuestionar si hay alguien que causa el caos y el desastre.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 44,
    name: "Tokyo Magnitude 8.0",
    category: "drama",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/cd003902aeb5c7439e5e9b5f52fbe33a.jpe",
    link: "https://all-anime.net/ver/Tokyo-Magnitude-8-0/tv",
    description:
      "Mirai es una joven adolescente que está harta de su vida y se ve implicada en un accidente terrible junto a su hermano: un devastador terremoto. Ahora tendrán que recorrer una Tokio sumida en el caos para intentar sobrevivir y regresar a casa ellos dos solos.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 11,
  },
  {
    id: 45,
    name: "Summer Time Render",
    category: "sobrenatural",
    image: "/image/Summer-time-render/p.jpg",
    link: "https://all-anime.net/ver/Summer-time-render/tv",
    description:
      "La misteriosa historia de ciencia ficción de Shinpei Ajiro sigue la muerte de su amigo de la infancia Ushio Kofune, que lleva a una misteriosa sombra tres días antes de su muerte.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 25,
  },
  {
    id: 46,
    name: "Mushoku Tensei",
    category: "aventura",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/format=auto,fit=contain,width=480,height=720,quality=85/catalog/crunchyroll/d458b9695157881b8b257226a2f68bb3.jpe",
    link: "https://all-anime.net/ver/Mushoku-tensei/tv",
    description:
      "Un chico de 34 años es atropellado por un autobús, este reencarna en un niño llamado Rudy embarcándose en una aventura épica con la ayuda de sus amigos, habilidades mágicas, y un corazón para vivir la vida que siempre quiso.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 47,
  },
  {
    id: 47,
    name: "Beyblade X",
    category: "deporte",
    image:
      "https://m.media-amazon.com/images/M/MV5BMmJhNGQ4MjItMTBhMC00OWIxLTg5NjAtYjM5ZjE3NWM2ZjMzXkEyXkFqcGdeQXVyMTY2MjYzNzE2._V1_.jpg",
    link: "https://all-anime.net/ver/Beyblade-x/tv",
    description:
      "Kazami Bird, que aspira a convertirse en profesional, conoce al antiguo campeón Kurosu Ex, también conocido como “Kamen X”, y forman un equipo para poder aspirar a la “cima” de la Torre X.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 25,
  },
  {
    id: 48,
    name: "Blue Lock",
    category: "deporte",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/b5621ff1277ed6ad1006b0c6f14900bb.jpg",
    link: "https://all-anime.net/ver/Blue-lock/tv",
    description:
      "La federación japonesa está decidida a crear un jugador con una sed de gol única, alguien ‘‘egoísta‘‘ con el balón, un jugador que pueda ser capaz de dar la vuelta a un partido que está por perderse.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 38,
  },
  {
    id: 49,
    name: "Wistoria: Wand of Sword",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/22ff4b731a5696364dc65d8d4a4627df.jpg",
    link: "https://all-anime.net/ver/Wistoria-Wand-and-Sword/tv",
    description:
      "Will, un joven trabajador en una academia de magia, aspira a convertirse en un gran hechicero. Sin embargo, su plan se queda corto ya que le falta la habilidad de usar magia. A pesar de sus luchas, Will persiste con una voluntad inquebrantable, a pesar de su falta de varita.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 50,
    name: "Uzumaki",
    category: "sobrenatural",
    image: "/image/Uzumaki/T1/p.jpg",
    link: "https://all-anime.net/ver/Uzumaki/tv",
    description:
      "¡Todo en este pueblo se está convirtiendo en espirales! En un intento de escapar de las espirales Kirie, decide abandonar su pueblo ¿podrá lograrlo?.",
    type: "Sub | Cas",
    seasons: 1,
    episodes: 4,
  },
  {
    id: 51,
    name: "Dandadan",
    category: "sobrenatural",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/13839ea2b48b0323417b23813a090c93.jpg",
    link: "https://all-anime.net/ver/Dandadan/tv",
    description:
      "Momo, una estudiante espiritual, y Okarun, un friki del ocultismo, discuten sobre sus creencias. Cuando ambos fenómenos se hacen reales, Momo obtiene poder oculto y Okarun obtiene poder de maldición, ambos enfrentándose a fuerzas paranormales.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 52,
    name: "Mecha-Ude: Mechanical Arms",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/36f48f5b71c56f980df00e86be0874fc.jpg",
    link: "https://all-anime.net/ver/Mecha-ude/tv",
    description:
      "La vida secundaria de Hikaru se transforma cuando conoce a Alma, una entidad alienígena vinculada a Mecha-Ude, un grupo misterioso que busca poder. Alma, a petición de ARMS, emprende un peligroso viaje para salvarlos.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 12,
  },
  {
    id: 53,
    name: "Rurouni Kenshin (2023)",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/c88f035c1ebb9922410bcf04e073a3d9.jpg",
    link: "https://all-anime.net/ver/Rurouni-Kenshin-2023/tv",
    description:
      "La vida secundaria de Hikaru se transforma cuando conoce a Alma, una entidad alienígena vinculada a Mecha-Ude, un grupo misterioso que busca poder. Alma, a petición de ARMS, emprende un peligroso viaje para salvarlos.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 47,
  },
  {
    id: 54,
    name: "Nanatsu no Taizai: Mokushiroku no Yonkishi",
    category: "accion",
    image: "/image/Nanatsu-no-taizai-mokushiroku-no-yonkishi/T2/p.jpg",
    link: "https://all-anime.net/ver/Nanatsu-no-taizai-mokushiroku-no-yonkishi/tv",
    description:
      "Cuando una profecía apocalíptica se cierne sobre un país pacífico, un chico de gran corazón emprende un viaje de descubrimiento... y venganza.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 36,
  },
  {
    id: 55,
    name: "Dragon Ball: Daima",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/298acc932735d9a731ea39a3db6a613c.jpg",
    link: "https://all-anime.net/ver/Dragon-Ball-Daima/tv",
    description:
      "¡Goku comienza una gran aventura en la nueva serie de Dragon Ball!",
    type: "Subtitulado",
    seasons: 1,
    episodes: 20,
  },
  {
    id: 56,
    name: "Shangri-La Frontier",
    category: "accion",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/2995bef133df4020b3acbfe7a694cbdf.jpg",
    link: "https://all-anime.net/ver/Shangri-La-Frontier/tv",
    description:
      "El futuro en el futuro cercano es llamado ´juegos basura´, juegos virtuales de realidad no llegan a un mínimo de calidad.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 49,
  },
  {
    id: 57,
    name: "Haikyu!!",
    category: "deporte",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/be304f43b41b60ce2f04c2f9629b0adf.jpg",
    link: "https://all-anime.net/ver/Haikyu/tv",
    description:
      "Haikyu!!, based on an original manga by Haruichi Furudate, is a sports anime about volleyball. Starring Shoyo Hinata, the protagonist inspires a player called 'Little Giant' and plays in his first official match, but is defeated by Tobio Kageyama.",
    type: "Sub | Dob",
    seasons: 4,
    episodes: 94,
  },
  {
    id: 58,
    name: "Link Click",
    category: "drama",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/59a606bb77e39a4935435962ee8d6c4d.jpg",
    link: "https://all-anime.net/ver/Link-click/tv",
    description:
      "Cheng Xiaoshi entra en el mundo de las fotos de Emma, una empleada de Quede Games, bajo el mando de Lu Guang con el fin de obtener pruebas sobre unos informes financieros falsificados.",
    type: "Sub | Dob",
    seasons: 3,
    episodes: 30,
  },
  {
    id: 59,
    name: "Solo Leveling",
    category: "accion",
    image:
      "https://a.storyblok.com/f/178900/1067x1601/0090e9bf15/solo-leveling-season-2-key-visual.png/m/filters:quality(95)format(webp)",
    link: "https://all-anime.net/ver/Solo-Leveling/tv",
    description:
      "Para dominar sus nuevas habilidades en secreto, Jinwoo debe luchar contra los enemigos más duros de la humanidad para salvar a su madre.",
    type: "Sub | Dob",
    seasons: 2,
    episodes: 25,
  },
  {
    id: 60,
    name: "Dr. Stone",
    category: "aventura",
    image:
      "https://a.storyblok.com/f/178900/960x1357/d42021c586/dr-stone-science-future-kv.jpeg/m/filters:quality(95)format(webp)",
    link: "https://all-anime.net/ver/Dr-stone/tv",
    description:
      "Senku es un joven extremadamente inteligente con un gran don para la ciencia y una ácida personalidad, y su mejor amigo es Taiju, que es muy buena persona pero más apto para usar los músculos que para pensar.",
    type: "Sub | Dob",
    seasons: 4,
    episodes: 70,
  },
  {
    id: 61,
    name: "Sakamoto Days",
    category: "accion",
    image:
      "https://dnm.nflximg.net/api/v6/2DuQlx0fM4wd1nzqm5BFBi6ILa8/AAAAQTA0WH6Znc8it-5EP5hduuMVjwyhhGlAt6E33RgLTxjpJDShUnvsirIEq9-fjG1G0Fnf95nVmpDSNZTjLnIrEHwYzwb-wx453ISGixLcJjo_oC5v3Obk8y1n_HhX7Zka8eXqLW5YewPssqDcN2LlEyXX.jpg?r=1f3",
    link: "https://all-anime.net/ver/Sakamoto-days/tv",
    description:
      "Taro Sakamoto, célebre asesino a sueldo, decidió retirarse de la acción cuando se enamoró. Pero el pasado vuelve por él y ahora debe dar pelea para proteger a su familia.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 11,
  },
  {
    id: 62,
    name: "Sword of the Demon Hunter (Kijin Gentoushou)",
    category: "accion, fantasía, drama, sobrenatural",
    image:
      "https://a.storyblok.com/f/178900/750x1061/ac0401ebaa/sword_of_the_demon_hunter_key_visual.jpg/m/filters:quality(95)format(webp)",
    link: "https://all-anime.net/ver/kijin-gentoushou/tv",
    description:
      "Durante el período Edo, un joven llamado Jinta protege la ciudad y a Itsukihime. Cuando se enfrenta a un extraño demonio en el bosque cercano.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 11,
  },
  {
    id: 63,
    name: "The Beginning After the End (Saikyou no Ousama, Nidome no Jinsei wa Nani wo Suru?)",
    category: "accion, fantasía",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/6e0a6199a24a6c773d68c54dc5449610.jpg",
    link: "https://all-anime.net/ver/The-beginning-after-the-end/tv",
    description:
      "Después de una muerte misteriosa, el Rey Grey renace como Arthur Leywin en el continente mágico de Dicathen. Aunque comienza su segunda vida como un bebé, conserva su sabiduría pasada.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 11,
  },
  {
    id: 64,
    name: "Devil May Cry 2025",
    category: "accion, fantasía",
    image: "/image/Devil-may-Cry-2025/T1/p.jpg",
    link: "https://all-anime.net/ver/Devil-may-Cry-2025/tv",
    description:
      "Ante la amenaza de un misterioso villano de abrir las puertas del infierno, un cazador de demonios endiabladamente guapo podría ser la mejor opción para salvar el mundo.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 8,
  },
  {
    id: 65,
    name: "YAIBA: Samurai Legend (Shin Samurai-den Yaiba)",
    category: "accion, shounen",
    image:
      "https://a.storyblok.com/f/178900/905x1280/c980117c57/yaiba-samurai-legend-main-visual.jpg/m/filters:quality(95)format(webp)",
    link: "https://all-anime.net/ver/Shin-Samurai-den-Yaiba/tv",
    description:
      "El viaje de Yaiba para convertirse en un verdadero samurái lo lleva desde su hogar en el bosque hasta una ajetreada ciudad llena de rivales, amistades y poderes ancestrales.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 11,
  },
  {
    id: 66,
    name: "My Hero Academia: Vigilantes",
    category: "accion, aventura, fantasía",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/aaddcbe723d430e97bed8c1b133de38f.jpg",
    link: "https://all-anime.net/ver/My-hero-academia-vigilantes/tv",
    description:
      "Koichi Haimawari es un estudiante aburrido que aspiraba a ser un héroe pero abandonó su sueño. Aunque el 80% de la población mundial tenga poderes sobrehumanos llamados Dones, pocos son elegidos para convertirse en héroes y proteger a las personas.",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 10,
  },
  {
    id: 67,
    name: "Fire Force (Ennen no Shouboutai)",
    category: "accion, ciencia ficción , shounen",
    image:
      "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/af0bbf16e9be5d8bb9d0a0b045431ccd.jpg",
    link: "https://all-anime.net/ver/Fire-force/tv",
    description:
      "Tokio está ardiendo y los ciudadanos sufren misteriosas combustiones espontáneas por toda la ciudad. La responsable de apagar este infierno es la Brigada Especial Antiincendios y Shinra está listo para unirse a su lucha.",
    type: "Sub | Dob",
    seasons: 3,
    episodes: 58,
  },
  {
    id: 68,
    name: "Lazarus",
    category: "ciencia ficción",
    image: "/image/Lazarus/T1/p.jpg",
    link: "https://all-anime.net/ver/Lazarus/tv",
    description:
      "Es el año 2052 y una milagrosa droga sin efectos secundarios que iba a liberar a la humanidad del dolor se vuelve mortal. Ahora queda en manos de grupo de forajidos llamado Lazarus la tarea de salvar al mundo. ¡Y sólo tienen 30 días!",
    type: "Sub | Dob",
    seasons: 1,
    episodes: 10,
  },
  {
    id: 69,
    name: "The Super Cube (Chao Neng Lifang: Chaofan Pian)",
    category: "acción, aventura, fantasía",
    image: "/image/The-super-cube/T1/p.jpg",
    link: "https://all-anime.net/ver/The-super-cube/tv",
    description:
      "Tras obtener el «Super Power Cube» de una civilización avanzada, Wang Xiaoxiu adquiere habilidades extraordinarias. Sin embargo, tras enfrentarse a conflictos con Sun Jun y la desaparición de Shen Yao, Xiaoxiu emprende un viaje para rescatarla.",
    type: "Subtitulado",
    seasons: 1,
    episodes: 11,
  },
  // ... (resto de los animes)
];

const animeGrid = document.getElementById("animeGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
const navSearchInput = document.getElementById("navSearchInput");

function renderAnimes(animesToRender) {
  animeGrid.innerHTML = "";
  animesToRender.forEach((anime) => {
    const animeCard = document.createElement("div");
    animeCard.className = "animeCard";
    animeCard.innerHTML = `
          <a href="${anime.link}" class="animeLink">
              <img src="${anime.image}" alt="${anime.name}">
              <div class="animeInfo">
                  <h3>${anime.name}</h3>
                  <div class="animeType">${anime.type}</div>
              </div>
              <div class="animeDescription">
                  <p><strong>Título:</strong> ${anime.name}</p>
                  <p><strong>Temporadas:</strong> ${anime.seasons}</p>
                  <p><strong>Episodios:</strong> ${anime.episodes}</p>
                  <p><strong>Descripción:</strong> ${anime.description}</p>
              </div>
          </a>
      `;
    animeGrid.appendChild(animeCard);
  });
}

function filterAnimes() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filteredAnimes = animes.filter(
    (anime) =>
      anime.name.toLowerCase().includes(searchTerm) &&
      (selectedCategory === "" || anime.category === selectedCategory)
  );

  renderAnimes(filteredAnimes);
}

function navSearch() {
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  const searchTerm = navSearchInput.value.toLowerCase();
  const filteredAnimes = animes.filter((anime) =>
    anime.name.toLowerCase().includes(searchTerm)
  );
  renderAnimes(filteredAnimes);
}

searchInput.addEventListener("input", filterAnimes);
categoryFilter.addEventListener("change", filterAnimes);
navSearchInput.addEventListener("input", navSearch);

menuToggle.addEventListener("click", () => {
  mainNav.classList.toggle("show");
  // Cambia el texto del botón
  menuToggle.innerHTML = mainNav.classList.contains("show")
    ? "&#10005;"
    : "&#9776;";
});

// Cierra el menú si se hace clic fuera de él
document.addEventListener("click", (event) => {
  if (
    !event.target.closest(".header-container") &&
    mainNav.classList.contains("show")
  ) {
    mainNav.classList.remove("show");
    menuToggle.innerHTML = "&#9776;";
  }
});

renderAnimes(animes);
