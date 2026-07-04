// ============================================================================
//  UTILIDADES COMPARTIDAS DEL CATÁLOGO  —  All-Anime
// ============================================================================

// Convierte texto a un slug seguro para IDs.
export function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

// Número de temporada a partir del texto "Temporada 1" → 1.
export function seasonNumber(seasonText) {
  const m = String(seasonText || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

// ID estable y único para un episodio (para likes, comentarios, vistos).
export function episodeId(animeId, ep) {
  return `${animeId}__t${seasonNumber(ep.season)}__e${ep.number}`;
}

// Devuelve la "tarjeta" ligera de un anime: todo menos el arreglo de episodios.
export function toCatalogCard(anime) {
  const { episodes, ...card } = anime;
  card.episodesCount = Array.isArray(episodes) ? episodes.length : 0;
  return card;
}

// Lista plana y ordenada de episodios (por temporada y número).
export function orderedEpisodes(anime) {
  const eps = Array.isArray(anime.episodes) ? [...anime.episodes] : [];
  return eps.sort((a, b) => {
    const sa = seasonNumber(a.season), sb = seasonNumber(b.season);
    if (sa !== sb) return sa - sb;
    return (a.number || 0) - (b.number || 0);
  });
}
