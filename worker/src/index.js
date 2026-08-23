// ============================================================================
//  All-Anime — Motor de scraping (Cloudflare Worker)
//  Hace el trabajo que el navegador NO puede por CORS: resolver IMDB/TMDB, sacar
//  metadata + imágenes por episodio, y extraer servidores de embed69, jkanime,
//  tioanime, animeav1, animeonlineninja, porygonsubs o una URL manual.
//  El admin (navegador) llama a estos endpoints, arma la vista previa y guarda en
//  Firestore. Protegido por API_KEY (secret del Worker).
// ============================================================================

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const pad = (n) => String(n).padStart(2, "0");
const dec = (s) => (s || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();

async function fetchText(url, referer) {
  const h = { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9", "Accept": "*/*" };
  if (referer) h["Referer"] = referer;
  const r = await fetch(url, { headers: h, redirect: "follow", cf: { cacheTtl: 0 } });
  return { status: r.status, text: await r.text(), url: r.url };
}

// ---------- CORS ----------
function cors(origin, allowed) {
  const list = (allowed || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = list.includes("*") || (origin && list.some((a) => origin === a || origin.startsWith(a)));
  return {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : (list[0] || "*"),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}
const json = (obj, ch) => new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json; charset=utf-8", ...ch } });

// ---------- SHA-256 síncrono (para el Proof-of-Work de embed69) ----------
function sha256hex(ascii) {
  function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const bytes = []; for (let i = 0; i < ascii.length; i++) { let c = ascii.charCodeAt(i); if (c < 128) bytes.push(c); else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); } else { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); } }
  const l = bytes.length; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  const bl = l * 8; for (let i = 7; i >= 0; i--) bytes.push((bl / Math.pow(2, i * 8)) & 0xff);
  const w = new Array(64);
  for (let j = 0; j < bytes.length; j += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[j+i*4]<<24)|(bytes[j+i*4+1]<<16)|(bytes[j+i*4+2]<<8)|(bytes[j+i*4+3]);
    for (let i = 16; i < 64; i++) { const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3); const s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10); w[i]=(w[i-16]+s0+w[i-7]+s1)|0; }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
    for (let i = 0; i < 64; i++) { const S1=rr(e,6)^rr(e,11)^rr(e,25); const ch=(e&f)^(~e&g); const t1=(hh+S1+ch+K[i]+w[i])|0; const S0=rr(a,2)^rr(a,13)^rr(a,22); const mj=(a&b)^(a&c)^(b&c); const t2=(S0+mj)|0; hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
    h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+hh)|0;
  }
  const toHex = (n) => ("00000000" + (n >>> 0).toString(16)).slice(-8);
  return toHex(h0)+toHex(h1)+toHex(h2)+toHex(h3)+toHex(h4)+toHex(h5)+toHex(h6)+toHex(h7);
}
function sha256bytes(str) { const hex = sha256hex(str); const out = new Uint8Array(32); for (let i = 0; i < 32; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out; }

// ---------- embed69 (AES-CBC + Proof-of-Work) ----------
async function embed69(imdbOrPath) {
  const url = imdbOrPath.startsWith("http") ? imdbOrPath : `https://embed69.org/f/${imdbOrPath}/`;
  const { text: h } = await fetchText(url, "https://pelisplushd.bz/");
  const dlm = h.match(/dataLink\s*=\s*(\[[\s\S]*?\]);/);
  if (!dlm) return { error: "no_datalink", langs: [], servers: [] };
  const dataLink = JSON.parse(dlm[1]);
  const chal = (h.match(/POW_CHALLENGE\s*=\s*'([^']+)'/) || [])[1];
  const diff = +((h.match(/POW_DIFFICULTY\s*=\s*(\d+)/) || [])[1] || 3);
  const salt = (h.match(/POW_SALT\s*=\s*'([^']+)'/) || [])[1];
  const prefix = "0".repeat(diff);
  let nonce = 0; while (!sha256hex(chal + nonce).startsWith(prefix)) { nonce++; if (nonce > 5e6) break; }
  const keyBytes = sha256bytes(chal + nonce + salt).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const decB64 = async (b64) => {
    try {
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const iv = raw.slice(0, 16), ct = raw.slice(16);
      const pt = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch { return null; }
  };
  const out = [];
  for (const grp of dataLink) { const lang = grp.video_language; for (const e of (grp.sortedEmbeds || [])) { const link = await decB64(e.link); if (link) out.push({ lang, name: e.servername, url: link }); } }
  return { langs: [...new Set(dataLink.map((g) => g.video_language))], servers: out };
}

// ---------- jkanime (var servers = [{remote: base64}]) ----------
async function jkanime(slug, n) {
  const { text: h } = await fetchText(`https://jkanime.net/${slug}/${n}/`);
  if (!/var\s+servers\s*=/.test(h)) return { servers: [] };
  const sv = (h.match(/var\s+servers\s*=\s*(\[[\s\S]*?\]);/) || [])[1];
  let arr = []; try { arr = JSON.parse(sv); } catch {}
  const servers = [];
  for (const s of arr) { let u = ""; try { u = atob(s.remote).trim(); } catch {}; if (/^https?:/.test(u)) servers.push({ name: s.server || s.slug || "Servidor", url: u, lang: "Sub" }); }
  return { servers };
}

// ---------- tioanime (var videos = [[name,url],...]) ----------
async function tioanime(slug, n) {
  const { text: h } = await fetchText(`https://tioanime.com/ver/${slug}-${n}`);
  const m = h.match(/var videos\s*=\s*(\[\[[\s\S]*?\]\]);/);
  if (!m) return { servers: [] };
  let arr; try { arr = JSON.parse(m[1]); } catch { return { servers: [] }; }
  const megaFix = (u) => String(u).replace(/mega\.nz\/embed\/!([^!]+)!(.+)$/, "mega.nz/embed/$1#$2");
  const servers = arr.map((v) => ({ name: v[0], url: megaFix(v[1]), lang: "Sub" })).filter((s) => /^https?:/.test(s.url));
  return { servers };
}

// ---------- animeav1 (/media/{slug}/{n} -> mega + mp4upload) ----------
async function animeav1(slug, n) {
  const { text: h, status } = await fetchText(`https://animeav1.com/media/${slug}/${n}`);
  if (status === 404) return { servers: [], notfound: true };
  const servers = [];
  for (const u of new Set([...h.matchAll(/https:\/\/mega\.nz\/embed\/[A-Za-z0-9_#!-]+/g)].map((m) => m[0]))) servers.push({ name: "Mega", url: u, lang: "Sub" });
  for (const u of new Set([...h.matchAll(/https:\/\/www\.mp4upload\.com\/embed-[a-z0-9]+\.html/g)].map((m) => m[0]))) servers.push({ name: "Mp4upload", url: u, lang: "Sub" });
  return { servers };
}

// ---------- Extractor genérico (URL manual / animeonlineninja / porygonsubs) ----------
// Devuelve iframes + enlaces a hosts conocidos + m3u8 presentes en la página.
async function extractGeneric(url) {
  const { text: h } = await fetchText(url, new URL(url).origin + "/");
  const HOSTS = /(filemoon|filemooon|streamwish|sfastwish|swiftplay|hglink|voe\.sx|vidhide|vidhidevip|mega\.nz|streamtape|mp4upload|mixdrop|dood|okru|ok\.ru|uqload|embed69|yourupload|streamhg)/i;
  const iframes = [...new Set([...h.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1].startsWith("//") ? "https:" + m[1] : m[1]))];
  const links = [...new Set([...h.matchAll(/https?:\/\/[^"'\s<>\\]+/g)].map((m) => m[0]))].filter((u) => HOSTS.test(u) && !/\.(css|js|png|jpg|jpeg|gif|svg|woff2?)($|\?)/i.test(u));
  const embeds = [...new Set([...iframes, ...links])].filter((u) => HOSTS.test(u) || /\/e(mbed)?\//.test(u));
  const m3u8 = [...new Set([...h.matchAll(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/g)].map((m) => m[0]))];
  const e69 = [...new Set([...h.matchAll(/embed69\.org\/f\/([^"'\/\s]+)/gi)].map((m) => m[1]))];
  const imdb = (h.match(/(tt\d{6,9})/) || [])[1] || "";
  return { embeds, m3u8, e69, imdb, iframeCount: iframes.length };
}

// ---------- Búsqueda de slug por título en cada fuente ----------
const normTitle = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function bestSlug(cands, title) {
  if (!cands.length) return null;
  const want = normTitle(title);
  let best = cands[0], bestScore = -1;
  for (const c of cands) {
    const cn = normTitle(c.replace(/[-/]/g, " "));
    let score = 0;
    if (cn === want) score = 100;
    else if (cn.startsWith(want) || want.startsWith(cn)) score = 70;
    else { const wt = new Set(want.split(" ")); const hit = cn.split(" ").filter((w) => wt.has(w)).length; score = hit; }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
async function searchSource(source, q) {
  let cands = [];
  if (source === "jkanime") {
    const { text: h } = await fetchText(`https://jkanime.net/buscar/${encodeURIComponent(q)}/`);
    cands = [...new Set([...h.matchAll(/href="https:\/\/jkanime\.net\/([a-z0-9-]+)\/"/gi)].map((m) => m[1]))]
      .filter((s) => !["buscar", "letra", "genero", "top", "horario", "directorio"].includes(s));
  } else if (source === "animeav1") {
    for (const u of [`https://animeav1.com/catalogo?search=${encodeURIComponent(q)}`, `https://animeav1.com/catalogo?q=${encodeURIComponent(q)}`]) {
      const { text: h } = await fetchText(u);
      cands = [...new Set([...h.matchAll(/\/media\/([a-z0-9-]+)/gi)].map((m) => m[1]))];
      if (cands.length) break;
    }
  } else if (source === "tioanime") {
    const { text: h } = await fetchText(`https://tioanime.com/directorio?q=${encodeURIComponent(q)}`);
    cands = [...new Set([...h.matchAll(/href="\/anime\/([a-z0-9-]+)"/gi)].map((m) => m[1]))];
  }
  return { candidates: cands.slice(0, 12), slug: bestSlug(cands, q) };
}

// ---------- Resolver IMDB (API de sugerencias) + TMDB ----------
async function resolveIds(title, year) {
  const slug = String(title).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "_");
  let imdb = null, imdbTitle = "";
  try {
    const j = JSON.parse((await fetchText(`https://v2.sg.media-imdb.com/suggestion/${slug[0]}/${encodeURIComponent(slug)}.json`)).text);
    const cands = (j.d || []).filter((x) => /^tt\d/.test(x.id || ""));
    const tv = cands.filter((x) => /TV series|TV mini/i.test(x.q || ""));
    const pool = tv.length ? tv : cands;
    let pick = pool[0];
    if (year) { const yr = pool.find((x) => x.y && Math.abs(x.y - year) <= 1); if (yr) pick = yr; }
    if (pick) { imdb = pick.id; imdbTitle = pick.l; }
  } catch {}
  let tmdbId = null;
  try { const s = (await fetchText(`https://www.themoviedb.org/search/tv?query=${encodeURIComponent(title)}`)).text; tmdbId = (s.match(/href="\/tv\/(\d+)[^"]*"/) || [])[1] || null; } catch {}
  return { imdb, imdbTitle, tmdbId };
}
async function tmdbMeta(tvId) {
  const { text: h } = await fetchText(`https://www.themoviedb.org/tv/${tvId}?language=es-ES`);
  const poster = (h.match(/property="og:image" content="[^"]*\/([A-Za-z0-9]{16,})\.(?:jpg|png)/) || [])[1] || "";
  const { text: bd } = await fetchText(`https://www.themoviedb.org/tv/${tvId}/images/backdrops`);
  const backdrop = (bd.match(/image\.tmdb\.org\/t\/p\/[a-z0-9_]+\/([A-Za-z0-9]{20,})\.jpg/) || [])[1] || "";
  const desc = dec((h.match(/<div class="overview">\s*<p>([^<]+)<\/p>/) || [])[1] || "");
  const genres = [...new Set([...h.matchAll(/\/genre\/\d+[^"]*"[^>]*>([^<]+)</g)].map((m) => dec(m[1])))].slice(0, 5);
  const year = ((h.match(/<title>[^(]*\((\d{4})/) || [])[1]) || "";
  return {
    poster: poster ? `https://image.tmdb.org/t/p/w500/${poster}.jpg` : "",
    backdrop: backdrop ? `https://image.tmdb.org/t/p/w1280/${backdrop}.jpg` : "",
    description: desc, genres, year: year ? +year : null,
  };
}
async function tmdbStills(tvId, maxS) {
  const flat = {}; let abs = 0; const seasons = [];
  for (let s = 1; s <= (maxS || 6); s++) {
    const { text: h } = await fetchText(`https://www.themoviedb.org/tv/${tvId}/season/${s}?language=es-ES`);
    const chunks = h.split(/id="episode_[0-9a-f]+"/).slice(1);
    if (!chunks.length) { if (s > 1) break; else continue; }
    seasons.push({ season: s, count: chunks.length });
    chunks.forEach((c, i) => {
      abs++;
      const im = c.match(/(?:media\.themoviedb\.org|image\.tmdb\.org)\/t\/p\/[a-z0-9_]+\/([A-Za-z0-9]{16,})\./i);
      const t = dec((c.match(/<div class="episode_title">\s*<h3>\s*<a[^>]*>([^<]+)<\/a>/) || [])[1] || "");
      flat[`${s}x${i + 1}`] = { abs, season: s, ep: i + 1, still: im ? `https://image.tmdb.org/t/p/w500/${im[1]}.jpg` : "", title: t };
    });
  }
  return { flat, seasons };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const ch = cors(origin, env.ALLOWED_ORIGINS || "*");
    if (request.method === "OPTIONS") return new Response(null, { headers: ch });
    const url = new URL(request.url);
    const q = url.searchParams;
    // Auth
    const key = q.get("key") || request.headers.get("X-API-Key") || "";
    if (env.API_KEY && key !== env.API_KEY) return json({ error: "unauthorized" }, ch);
    try {
      const path = url.pathname.replace(/\/+$/, "");
      if (path === "" || path === "/health") return json({ ok: true, service: "allanime-scraper" }, ch);
      if (path === "/resolve") return json(await resolveIds(q.get("title") || "", q.get("year") ? +q.get("year") : null), ch);
      if (path === "/meta") return json(await tmdbMeta(q.get("tmdb")), ch);
      if (path === "/stills") return json(await tmdbStills(q.get("tmdb"), +q.get("maxS") || 6), ch);
      if (path === "/embed69") { const imdb = q.get("imdb"), s = q.get("s"), e = q.get("e"); const code = (s && e) ? `${imdb}-${s}x${pad(+e)}` : imdb; const r = await embed69(code); r.wrapper = `https://embed69.org/f/${code}/`; return json(r, ch); }
      if (path === "/jkanime") return json(await jkanime(q.get("slug"), q.get("n")), ch);
      if (path === "/tioanime") return json(await tioanime(q.get("slug"), q.get("n")), ch);
      if (path === "/animeav1") return json(await animeav1(q.get("slug"), q.get("n")), ch);
      if (path === "/search") return json(await searchSource(q.get("source"), q.get("q") || ""), ch);
      if (path === "/extract") return json(await extractGeneric(q.get("url")), ch);
      if (path === "/fetch") { const r = await fetchText(q.get("url"), q.get("ref") || null); return json({ status: r.status, html: r.text.slice(0, 500000) }, ch); }
      return json({ error: "not_found", path }, ch);
    } catch (e) {
      return json({ error: String(e && e.message || e).slice(0, 200) }, ch);
    }
  },
};
