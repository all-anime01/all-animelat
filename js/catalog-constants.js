// ============================================================================
//  CONSTANTES DEL CATÁLOGO  —  All-Anime
//  Listas para los selectores del panel de administración.
// ============================================================================

export const GENRES = [
  "Acción", "Artes Marciales", "Aventura", "Ciencia Ficción", "Comedia",
  "Demonios", "Deportes", "Drama", "Ecchi", "Escolar", "Espacial", "Fantasía",
  "Gore", "Harem", "Histórico", "Horror", "Infantil", "Isekai", "Josei",
  "Magia", "Mecha", "Militar", "Misterio", "Mitología", "Música", "Parodia",
  "Política", "Psicológico", "Recuentos de la vida", "Romance", "Seinen",
  "Shoujo", "Shounen", "Sobrenatural", "Superhéroes", "Superpoderes",
  "Suspenso", "Terror", "Vampiros",
];

// Tags que CONTROLAN dónde aparece el anime en la página de inicio.
export const FUNCTIONAL_TAGS = [
  { value: "recomendado", label: "Recomendado", help: "Aparece en el carrusel “Recomendaciones” del inicio." },
  { value: "doblaje", label: "Doblaje", help: "Aparece en el carrusel “Doblajes” del inicio." },
  { value: "agregado", label: "Agregado recientemente", help: "Aparece en “Agregados recientemente”." },
];

// Tags temáticos sugeridos (descriptivos, opcionales).
export const THEME_TAGS = [
  "Magia", "Guerra", "Estrategia", "Supervivencia", "Reencarnación",
  "Monstruos", "Misterio", "Intelectual", "Manipulación", "Viajes en el tiempo",
];

export const TYPES = ["TV", "Película", "ONA", "OVA", "Donghua", "Especial"];

export const STATUSES = ["En emisión", "Finalizado", "Próximamente", "Pausado"];

export const AUDIOS = ["Sub", "Sub | Dob", "Sub | Cas", "Latino", "Castellano", "Subtitulado"];

export const EPISODE_LANGS = ["Sub", "Dob", "Lat", "Cas"];
