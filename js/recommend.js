// ============================================================================
//  RECOMENDACIONES PERSONALIZADAS  —  All-Anime
//  Basadas en la experiencia del usuario (lo que mira, guarda y busca).
//  Distinto de "nuestras recomendaciones" (tag 'recomendado' que pone el admin).
// ============================================================================

// seedAnimes: animes que el usuario ha visto/guardado (objetos con genres).
// excludeIds: ids a excluir (ya vistos/guardados).
export function recommendForUser(animeData, seedAnimes, excludeIds, max = 18) {
  const weights = {};
  seedAnimes.forEach((a) => (a.genres || []).forEach((g) => { weights[g] = (weights[g] || 0) + 1; }));

  // Señal ligera extra: términos buscados recientemente (localStorage).
  let searches = [];
  try { searches = JSON.parse(localStorage.getItem("recentSearches") || "[]"); } catch (e) {}
  if (!Object.keys(weights).length && !searches.length) return [];

  const exclude = new Set(excludeIds);
  return animeData
    .filter((a) => !exclude.has(a.id))
    .map((a) => {
      let score = 0;
      (a.genres || []).forEach((g) => { if (weights[g]) score += weights[g]; });
      // coincidencia con búsquedas recientes por título
      const title = (a.title || "").toLowerCase();
      searches.forEach((q) => { if (q && title.includes(q)) score += 2; });
      score += (Number(a.rating) || 0) * 0.2; // desempate por calidad
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, max)
    .map((x) => x.a);
}

// Guarda un término de búsqueda para afinar recomendaciones (máx. 15).
export function rememberSearch(term) {
  term = (term || "").toLowerCase().trim();
  if (term.length < 3) return;
  try {
    let s = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    s = [term, ...s.filter((x) => x !== term)].slice(0, 15);
    localStorage.setItem("recentSearches", JSON.stringify(s));
  } catch (e) {}
}
