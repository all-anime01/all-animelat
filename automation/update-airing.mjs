// Auto-actualización de animes EN EMISIÓN: para cada anime configurado en
// sources.json, busca en su fuente episodios NUEVOS (más allá del último que ya
// está en Firestore) y los AGREGA con servidores + imagen/descripción/fecha de
// TMDB. Solo toca los animes de la config (mapeo explícito) → seguro.
//
// DRY_RUN=1 -> no escribe, solo reporta. MAX_NEW limita cuántos episodios nuevos
// por anime y corrida (evita sorpresas). Ejecuta: node automation/update-airing.mjs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getAnime, patchFields, bumpCatalogVersion, signIn } from "./lib.mjs";
import { SOURCES, tmdbEpisodes, verifiedServers } from "./scrapers.mjs";

const DRY = process.env.DRY_RUN === "1";
const MAX_NEW = parseInt(process.env.MAX_NEW || "8", 10);
const cfg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sources.json"), "utf8"));
const targets = (cfg.animes || []).filter((a) => a.enabled !== false);
if (!targets.length) { console.log("No hay animes habilitados en sources.json (enabled:true). Nada que hacer."); process.exit(0); }

let token = null;
let totalAdded = 0;
for (const t of targets) {
  const scraper = SOURCES[t.source];
  if (!scraper) { console.log(`✗ ${t.fsId}: fuente desconocida "${t.source}"`); continue; }
  const a = await getAnime(t.fsId);
  if (!a) { console.log(`✗ ${t.fsId}: no existe en Firestore`); continue; }
  const eps = (a.episodes || []).slice();
  const inSeason = eps.filter((e) => e.season === t.season);
  const maxNum = inSeason.reduce((m, e) => Math.max(m, +e.number || 0), 0);
  const tmdb = await tmdbEpisodes(t.tvId);
  // offset: número absoluto TMDB para el episodio maxNum de esta temporada.
  const before = eps.filter((e) => e.season !== t.season).length; // aprox si multi-temporada previa
  const nuevos = [];
  for (let n = maxNum + 1; n <= maxNum + MAX_NEW; n++) {
    const raw = await scraper(t.slug, n);
    if (!raw) break; // no hay más episodios en la fuente
    // GARANTÍA DE CALIDAD: solo servidores que cargan de verdad.
    const servers = await verifiedServers(raw);
    if (!servers.length) { console.log(`  ${t.fsId} E${n}: sin servidor que funcione → no se agrega`); break; }
    const abs = before + n; // posición absoluta aproximada para TMDB
    const tm = tmdb[abs - 1] || tmdb[n - 1] || {};
    nuevos.push({
      season: t.season, number: n, title: tm.title || `Episodio ${n}`,
      img: tm.still || a.heroImg || "", servers,
      videoUrl: `frame/player.html?a=${t.fsId}&s=${encodeURIComponent(t.season)}&e=${n}`,
      language: "Sub", description: tm.overview || "", duration: "24 min", releaseDate: tm.date || "",
      autoAdded: true,
    });
  }
  if (!nuevos.length) { console.log(`= ${t.fsId}: sin episodios nuevos (último ${maxNum})`); continue; }
  console.log(`+ ${t.fsId}: ${nuevos.length} episodio(s) nuevo(s) [${nuevos.map((e) => e.number).join(",")}]`);
  totalAdded += nuevos.length;
  if (DRY) continue;
  const all = [...eps, ...nuevos];
  if (!token) token = await signIn();
  await patchFields(`animes/${t.fsId}`, { episodes: all, episodesCount: all.length, episodesTotal: all.length }, token);
}
if (!DRY && totalAdded) { if (!token) token = await signIn(); await bumpCatalogVersion(token); }
console.log(`\n${DRY ? "[DRY] " : ""}Total episodios ${DRY ? "detectados" : "agregados"}: ${totalAdded}`);
