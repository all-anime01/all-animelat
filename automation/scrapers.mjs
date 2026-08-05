// Scrapers de fuentes (Sub) + metadata TMDB. Devuelven episodios en el formato
// del sitio. Nota de calidad: jkanime/tioanime suelen ser 720p; para 1080p real
// hace falta AnimeAV1 (render por JS, requiere navegador headless) — ver README.
import { get } from "./lib.mjs";

const b64 = (b) => { try { return Buffer.from(b, "base64").toString("utf8").trim(); } catch { return ""; } };
const dec = (s) => (s || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).trim();

// jkanime: var servers=[{remote:b64,server,lang}]. Whitelist incrustable.
const JK_WL = ["Streamwish", "VOE", "Vidhide", "Mixdrop", "Mp4upload", "Mega", "Streamtape", "Doodstream"];
export async function jkServers(slug, n) {
  const h = await get(`https://jkanime.net/${slug}/${n}/`);
  const m = h.match(/var\s+servers\s*=\s*(\[[\s\S]*?\]);/); if (!m) return null;
  let arr; try { arr = JSON.parse(m[1]); } catch { return null; }
  const out = [];
  for (const s of arr) { if (!JK_WL.includes(s.server)) continue; const url = b64(s.remote); if (!/^https?:/.test(url)) continue; out.push({ name: s.server, url, lang: "Sub", desc: "" }); }
  out.sort((a, b) => JK_WL.indexOf(a.name) - JK_WL.indexOf(b.name));
  return out.length ? out.slice(0, 4) : null;
}
// tioanime: var videos=[[name,url,...]]
const TIO_WL = { Mega: 1, YourUpload: 1, Yourupload: 1 };
export async function tioServers(slug, n) {
  const h = await get(`https://tioanime.com/ver/${slug}-${n}`);
  const m = h.match(/var videos\s*=\s*(\[[\s\S]*?\]);/); if (!m) return null;
  let arr; try { arr = JSON.parse(m[1].replace(/\\\//g, "/")); } catch { return null; }
  const out = [];
  for (const v of arr) { const name = v[0], url = v[1]; if (TIO_WL[name] && url && /^https?:/.test(url)) out.push({ name: name === "Yourupload" ? "YourUpload" : name, url, lang: "Sub", desc: "" }); }
  return out.length ? out : null;
}
export const SOURCES = { jkanime: jkServers, tioanime: tioServers };

// GARANTÍA DE CALIDAD: verifica que un embed cargue de verdad (no 404 / no
// "archivo eliminado"). Devuelve true solo si responde y no está borrado.
const DEAD = /file (?:not found|was deleted|has been removed)|no such file|video (?:not found|unavailable|no longer)|404 not found|deleted|removed by/i;
export async function embedAlive(url) {
  try {
    const r = await fetch(url, { headers: UA.headers, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (r.status === 404 || r.status === 410) return false;
    if (!r.ok && r.status !== 403) return false;
    const t = (await r.text()).slice(0, 4000);
    return !DEAD.test(t);
  } catch { return false; }
}
// Filtra una lista de servidores dejando solo los que cargan. Si ninguno carga,
// devuelve [] (el episodio NO se agrega → nunca se sube contenido roto).
export async function verifiedServers(servers) {
  if (!servers || !servers.length) return [];
  const checks = await Promise.all(servers.map((s) => embedAlive(s.url)));
  return servers.filter((_, i) => checks[i]);
}

// TMDB (web, sin API key): still + overview + fecha por número absoluto.
const MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MI = { enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11 };
export async function tmdbArt(tvId) {
  const h = await get(`https://www.themoviedb.org/tv/${tvId}`);
  const poster = (h.match(/<meta property="og:image" content="[^"]*\/([A-Za-z0-9]{16,}\.(?:jpg|png))"/) || [])[1] || null;
  const backdrop = (h.match(/\/t\/p\/w1920_and_h800[a-z_]*\/([A-Za-z0-9]{16,}\.jpg)/) || h.match(/\/t\/p\/original\/([A-Za-z0-9]{16,}\.jpg)/) || [])[1] || null;
  return { poster: poster ? `https://image.tmdb.org/t/p/w500/${poster}` : null, backdrop: backdrop ? `https://image.tmdb.org/t/p/w1280/${backdrop}` : null };
}
export async function tmdbEpisodes(tvId) {
  const all = [];
  for (let s = 1; s <= 30; s++) {
    const h = await get(`https://www.themoviedb.org/tv/${tvId}/season/${s}?language=es-ES`);
    if (!h) break;
    const chunks = h.split(/id="episode_[0-9a-f]+"/).slice(1);
    if (!chunks.length) { if (s > 1) break; else continue; }
    for (const c of chunks) {
      const num = +((c.match(/data-episode-number="(\d+)"/) || [])[1] || 0); if (!num) continue;
      const title = dec(((c.match(/<div class="episode_title">\s*<h3><a[^>]*>([^<]+)<\/a>/) || [])[1] || ""));
      const im = c.match(/(?:media\.themoviedb\.org|image\.tmdb\.org)\/t\/p\/[a-z0-9_]+\/([A-Za-z0-9]{16,})\./i);
      const ov = c.match(/<div class="overview">\s*<p>([\s\S]{10,1200}?)<\/p>/);
      const dm = c.match(/(\d{1,2})\s+de\s+([a-záéí]+)\.?\s+de\s+(\d{4})/i);
      let date = ""; if (dm) { const mo = MI[dm[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")]; if (mo!==undefined) date = `${MES[mo]} ${parseInt(dm[1],10)}, ${dm[3]}`; }
      all.push({ title: /^Episod/i.test(title) ? "" : title, still: im ? `https://image.tmdb.org/t/p/w500/${im[1]}.jpg` : null, overview: ov ? dec(ov[1]) : "", date });
    }
    await new Promise((r) => setTimeout(r, 110));
  }
  return all; // índice = número absoluto - 1
}
