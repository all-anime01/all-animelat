// ============================================================================
//  CONSTANTES DEL CATÁLOGO  —  All-Anime
//  Listas para los selectores del panel de administración.
// ============================================================================

// Géneros REALES presentes en el catálogo (coinciden con los de "Explorar").
// El admin puede añadir nuevos desde el propio formulario si hace falta.
export const GENRES = [
  "Acción", "Artes Marciales", "Aventura", "Aventuras", "Ciencia Ficción",
  "Comedia", "Demonios", "Deporte", "Drama", "Escolar", "Espacial", "Fantasía",
  "Gore", "Histórico", "Horror", "Infantil", "Isekai", "Mecha", "Militar",
  "Misterio", "Mitología", "Parodia", "Política", "Psicológico", "Psíquicos",
  "Romance", "Seinen", "Shonen", "Shounen", "Sobrenatural", "Superhéroes",
  "Superpoderes", "Suspenso", "Terror",
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

export const TYPES = ["TV", "Película", "ONA", "OVA", "Donghua", "Anime", "Especial"];

export const STATUSES = ["En emisión", "Finalizado", "Próximamente", "Pausado"];

export const AUDIOS = ["Sub", "Sub | Dob", "Sub | Cas", "Latino", "Castellano", "Subtitulado"];

export const EPISODE_LANGS = ["Sub", "Dob", "Lat", "Cas"];
