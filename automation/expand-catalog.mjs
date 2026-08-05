// Amplía el catálogo con animes NUEVOS (clásicos/populares) definidos en
// watchlist.json. Por cada entrada habilitada que aún NO exista en el catálogo,
// arma el anime desde su fuente (con servidores VERIFICADOS) + metadata TMDB, y
// lo crea en Firestore. Garantía de calidad: un episodio solo se agrega si tiene
// al menos un servidor que carga.
//
// DRY_RUN=1 -> solo reporta. Ejecuta: node automation/expand-catalog.mjs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getCatalog, getAnime, patchFields, bumpCatalogVersion, signIn } from "./lib.mjs";
import { SOURCES, verifiedServers, tmdbEpisodes, tmdbArt } from "./scrapers.mjs";

const DRY = process.env.DRY_RUN === "1";
const cfg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "watchlist.json"), "utf8"));
const targets = (cfg.animes || []).filter((a) => a.enabled !== false);
if (!targets.length) { console.log("watchlist.json sin entradas habilitadas. Nada que hacer."); process.exit(0); }

const catalog = await getCatalog();
let token = null;
for (const t of targets) {
  if (catalog.some((c) => c.id === t.fsId) || await getAnime(t.fsId)) { console.log(`= ${t.fsId}: ya existe, se omite`); continue; }
  const scraper = SOURCES[t.source];
  if (!scraper) { console.log(`✗ ${t.fsId}: fuente desconocida "${t.source}"`); continue; }
  const art = await tmdbArt(t.tvId);
  const tmdb = await tmdbEpisodes(t.tvId);
  const SEASON = t.season || "Temporada 1";
  const episodes = []; let ok = 0;
  for (let n = 1; n <= t.maxEp; n++) {
    const raw = await scraper(t.slug, n);
    if (!raw) break;
    const servers = await verifiedServers(raw);   // solo lo que funciona
    if (!servers.length) { console.log(`  ${t.fsId} E${n}: sin servidor válido → se detiene`); break; }
    const tm = tmdb[n - 1] || {};
    episodes.push({ season: SEASON, number: n, title: tm.title || `Episodio ${n}`, img: tm.still || art.backdrop || "", servers,
      videoUrl: `frame/player.html?a=${t.fsId}&s=${encodeURIComponent(SEASON)}&e=${n}`, language: t.audio || "Sub", description: tm.overview || "", duration: "24 min", releaseDate: tm.date || "", autoAdded: true });
    ok++;
    if (n % 12 === 0) process.stdout.write(`\r  ${t.fsId} ${n}/${t.maxEp} (ok:${ok})`);
  }
  console.log(`\n${t.fsId}: ${episodes.length} episodios con video verificado`);
  if (!episodes.length) { console.log(`  ✗ ${t.fsId}: 0 episodios válidos, NO se crea`); continue; }
  if (DRY) { console.log(`  [DRY] se crearía con ${episodes.length} eps`); continue; }
  const doc = { id: t.fsId, type: "anime", title: t.title, description: t.synopsis || "", year: t.year || null, genres: t.genres || ["Acción"],
    rating: 7.5, ratingCount: 50, status: "Finalizado", quality: "HD", audio: t.audio || "Sub", seasons: 1, episodesCount: episodes.length, episodesTotal: episodes.length,
    img: art.poster || "", imgMobile: art.poster || "", heroImg: art.backdrop || "", fonImg: art.backdrop || "", logoImg: "", trailerUrl: "", altTitles: [], tags: [], contentWarning: "", creator: t.creator || "", updatedAt: null };
  if (!token) token = await signIn();
  await patchFields(`animes/${t.fsId}`, { ...doc, episodes }, token);
  catalog.push({ ...doc });
  await patchFields("catalog/index", { items: catalog }, token);
  console.log(`  ✔ ${t.fsId}: creado (${episodes.length} eps)`);
}
if (!DRY && token) await bumpCatalogVersion(token);
console.log("\nListo.");
