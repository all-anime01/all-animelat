// =============================================================================
//  Núcleo del importador — la MISMA lógica que la aplicación de escritorio, pero
//  para el navegador (admin → Importar).
//
//  El navegador no puede pedir páginas de otros dominios, así que todo lo que sea
//  HTML ajeno pasa por el Cloudflare Worker (/fetch). TMDB y AniList sí permiten
//  llamadas directas, y así se obtienen los mismos datos que en el escritorio
//  (títulos y sinopsis en español, fotogramas por episodio, cadena de temporadas).
// =============================================================================

const IMG = "https://image.tmdb.org/t/p";
const MURO = /just a moment|un momento…|challenges\.cloudflare\.com|cf-browser-verification|enable javascript and cookies|attention required/i;

export const NOMBRES = {
  mega: "Mega", sfastwish: "Streamwish", streamwish: "Streamwish", swiftplay: "Streamwish",
  hglink: "Streamwish", voe: "VOE", vidhide: "VidHide", vidhidevip: "VidHide",
  filemoon: "Filemoon", filemooon: "Filemoon", byse: "Filemoon", bysc: "Filemoon", moonplayer: "Filemoon",
  vidara: "Vidara", streamtape: "Streamtape", mp4upload: "Mp4upload", zilla: "AnimeAV1 HD",
  mediafire: "Mediafire", mixdrop: "Mixdrop", "d-s.io": "Doodstream", dood: "Doodstream",
  desu: "Desu", desuka: "Desu", okru: "Okru", "ok.ru": "Okru", uqload: "Uqload",
  yourupload: "YourUpload", krakenfiles: "Krakenfiles", embed69: "PelisPlus",
};
export function nm(u) {
  const s = String(u || "").toLowerCase();
  for (const k of Object.keys(NOMBRES)) if (s.includes(k)) return NOMBRES[k];
  return "Servidor";
}

// Orden de calidad (igual que en el escritorio).
const CALIDAD = ["filemoon", "streamwish", "vidara", "pelisplus", "embed69", "animeav1", "hls",
  "desu", "vidhide", "voe", "mega", "magi", "streamtape", "mp4upload", "mixdrop", "doodstream", "mediafire"];

/** Máx. `cap` servidores por idioma, LATINO primero y sin repetir host ni URL. */
export function prioritize(servers, prefer = [], only = false, cap = 3) {
  const orden = (prefer || []).filter(Boolean).map((x) => x.trim().toLowerCase());
  const lista = orden.length ? orden : CALIDAD;
  const rank = (s) => {
    const n = (s.name + " " + s.url).toLowerCase();
    const i = lista.findIndex((p) => n.includes(p));
    return i < 0 ? 99 : i;
  };
  let srv = servers.filter((s) => s && s.url);
  if (only && orden.length) srv = srv.filter((s) => rank(s) < 99);
  const porIdioma = {};
  for (const s of srv) (porIdioma[s.lang || "Sub"] ||= []).push(s);
  const out = [];
  for (const lang of ["Latino", "Castellano", "Sub"].concat(Object.keys(porIdioma))) {
    if (!porIdioma[lang]) continue;
    const vistos = new Set(), urls = new Set();
    porIdioma[lang].sort((a, b) => rank(a) - rank(b));
    for (const s of porIdioma[lang]) {
      if (urls.has(s.url) || vistos.has(s.name)) continue;
      urls.add(s.url); vistos.add(s.name); out.push(s);
      if (vistos.size >= cap) break;
    }
    delete porIdioma[lang];
  }
  return out;
}

export function audioLabel(langs) {
  const l = new Set(langs);
  const tiene = l.has("Latino") || l.has("Castellano");
  if (tiene && l.has("Sub")) return "Sub | Dob";
  if (tiene) return "Latino";
  return "Sub";
}

export function esEpTitle(nombre, n) {
  const t = String(nombre || "").trim();
  if (!t || /^(episode|episodio|ep\.?|capitulo|capítulo)\s*\d+$/i.test(t)) return `Episodio ${n}`;
  return t;
}

// ---------------------------------------------------------------- idioma
// Gana el idioma que deja MÁS marcas: una tilde suelta («Pokémon») no convierte en
// español una frase inglesa, ni un «All Might» convierte en inglés una española.
const ES_ACC = /[ñáéíóúü¡¿]/g;
const ES_PAL = /\b(el|la|los|las|de|del|un|una|unos|unas|que|qué|y|o|en|con|sin|por|para|es|son|su|sus|se|al|lo|le|les|no|si|ya|más|muy|pero|como|cuando|donde|quien|porque|todo|todos|toda|todas|este|esta|esto|ese|esa|aquel|hacia|desde|entre|sobre|tras|ante|episodio|capitulo|capítulo|parte|temporada|pelicula|película|nuevo|nueva|gran|contra|hasta|antes|después|siempre|nunca|vez|día|noche|mundo|amor|guerra|batalla|rey|reina|hombre|mujer|niño|niña|casa|tierra|secreto|sueño)\b/gi;
const EN_PAL = /\b(the|and|with|of|is|are|was|were|his|her|their|they|she|he|its|from|that|this|these|those|when|where|what|who|which|into|about|after|before|while|there|here|you|your|we|our|but|for|on|at|by|out|all|new|first|last|one|two|has|have|had|will|would|could|does|doesn|to|an|as|in|up|if|then|decides|meets|begins|finds|takes|goes|gets|becomes|must|each|other|others)\b/gi;

export function pareceIngles(t) {
  const s = String(t || "").trim();
  if (s.length < 4) return false;
  if (/^(episodio|parte|ova|pelicula|película)\b/i.test(s)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  const en = (s.match(EN_PAL) || []).length;
  const es = (s.match(ES_PAL) || []).length + (s.match(ES_ACC) || []).length;
  if (en || es) return en > es;
  return true;
}

// MyMemory mete sus errores DENTRO del texto traducido y con estado 200; además
// corta a 500 bytes. Las dos cosas se controlan aquí, igual que en el escritorio.
const MM_AVISO = /MYMEMORY WARNING|QUOTA|QUERY LENGTH LIMIT|MAX ALLOWED QUERY|INVALID LANGUAGE PAIR/i;
const MM_MAX = 450;
const cacheTrad = new Map();

function trozos(txt, max = MM_MAX) {
  const frases = String(txt).trim().split(/(?<=[.!?…])\s+/);
  const out = []; let cur = "";
  for (let f of frases) {
    while (new Blob([f]).size > max) {
      const corte = f.slice(0, max).replace(/\s+\S*$/, "") || f.slice(0, max);
      if (cur) { out.push(cur); cur = ""; }
      out.push(corte); f = f.slice(corte.length).trim();
    }
    const cand = (cur + " " + f).trim();
    if (new Blob([cand]).size > max) { if (cur) out.push(cur); cur = f; } else cur = cand;
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

export async function traducir(txt, log = () => {}) {
  const t = String(txt || "").trim();
  if (!t || !pareceIngles(t)) return t;
  if (cacheTrad.has(t)) return cacheTrad.get(t);
  const partes = new Blob([t]).size > MM_MAX ? trozos(t) : [t];
  const hechas = [];
  for (const p of partes) {
    try {
      const r = await fetch("https://api.mymemory.translated.net/get?langpair=en|es&q=" + encodeURIComponent(p));
      const j = await r.json();
      const out = (j.responseData && j.responseData.translatedText) || "";
      if (!out || MM_AVISO.test(out) || out.trim().toLowerCase() === p.trim().toLowerCase()) return t;
      hechas.push(out);
    } catch { return t; }
  }
  const fin = hechas.join(" ");
  cacheTrad.set(t, fin);
  return fin;
}

// ------------------------------------------------- temporadas partidas (cours)
const CONT = /(?:^|[\s\-_:])(?:(?:part|parte|cour|tanda)[\s\-_]*(?:2|3|ii|iii|two|three|dos|tres|b|c)|(?:2nd|3rd|second|third|segunda|tercera)[\s\-_]*(?:part|parte|cour|tanda))(?:$|[\s\-_])/i;
const SUF_CONT = /[\s\-_]*(?:(?:part|parte|cour|tanda)[\s\-_]*(?:\d+|ii|iii|two|three|dos|tres|b|c)|(?:2nd|3rd|second|third|segunda|tercera)[\s\-_]*(?:part|parte|cour|tanda))\s*$/i;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function esContinuacion(texto, anterior = null) {
  const t = String(texto || "");
  if (!t || !CONT.test(t)) return false;
  const raiz = (x) => String(x || "").replace(SUF_CONT, "").replace(/^[-_: ]+|[-_: ]+$/g, "");
  if (anterior) return !!raiz(t) && norm(raiz(t)) === norm(String(anterior).replace(/^[-_: ]+|[-_: ]+$/g, ""));
  return !/(?:^|[\s\-_])(?:2nd|3rd|second|third|segunda|tercera)[\s\-_]*(?:season|temporada)/i.test(t);
}

/** Une los bloques que son otra PARTE de la temporada anterior y renumera el resto. */
export function fusionaPartes(seasons, al = [], log = () => {}) {
  const out = []; let nReal = 0, ultSlug = "", ultTit = "", ultNombre = "";
  seasons.forEach((S0, i) => {
    const S = { ...S0 };
    const slug = S.av || S.jk || "";
    const tit = al[i] ? (al[i].romaji || al[i].english || al[i].title || "") : "";
    const cont = out.length > 0 && (esContinuacion(slug, ultSlug) || (tit && esContinuacion(tit, ultTit)));
    if (cont) {
      if (slug && slug === ultSlug) {
        log(`  la 2ª parte de ${ultNombre} usa la MISMA fuente (${slug}): no se recorre dos veces`);
        return;
      }
      S.cont = true; S.name = ultNombre; S.season = nReal;
      log(`  «${slug || tit}» es otra PARTE de ${ultNombre}: se une a esa temporada`);
    } else {
      nReal += 1; S.cont = false; S.season = nReal; S.name = `Temporada ${nReal}`; ultNombre = S.name;
    }
    ultSlug = slug || ultSlug; ultTit = tit || ultTit;
    out.push(S);
  });
  return out;
}

// =============================================================================
//  Núcleo: se crea con la URL del Worker, su clave y la TMDB API key.
// =============================================================================
export function crearNucleo({ workerUrl, workerKey = "", tmdbKey = "", log = () => {} }) {
  const WK = String(workerUrl || "").replace(/\/+$/, "");
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  async function wk(path, params = {}) {
    const u = new URL(WK + path);
    Object.entries(params).forEach(([k, v]) => v != null && v !== "" && u.searchParams.set(k, v));
    if (workerKey) u.searchParams.set("key", workerKey);
    const r = await fetch(u.toString());
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    return j;
  }

  /** HTML de cualquier sitio, a través del Worker. "" si hay muro de Cloudflare. */
  async function puente(url, ref = null) {
    try {
      const j = await wk("/fetch", { url, ref });
      const h = j.html || "";
      if (j.status !== 200 || MURO.test(h.slice(0, 4000))) return "";
      return h;
    } catch { return ""; }
  }

  const tmdb = async (path, extra = {}) => {
    const u = new URL("https://api.themoviedb.org/3" + path);
    u.searchParams.set("api_key", tmdbKey);
    Object.entries(extra).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error("TMDB " + r.status);
    return r.json();
  };

  // ------------------------------------------------------------- fuentes
  async function embed69(imdb, s, e) {
    if (!imdb) return null;
    const code = `${imdb}-${s}x${String(e).padStart(2, "0")}`;
    const h = await puente(`https://embed69.org/f/${code}/`, "https://pelisplushd.bz/");
    if (!h) return null;
    const m = h.match(/dataLink\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return null;
    try {
      const arr = JSON.parse(m[1]);
      const lat = arr.find((g) => String(g.video_language).toUpperCase() === "LAT");
      if (lat && (lat.sortedEmbeds || []).length)
        return { url: `https://embed69.org/f/${code}/`, name: "PelisPlus", lang: "Latino", desc: "Audio Latino" };
    } catch {}
    return null;
  }

  async function av1Servers(slug, n) {
    if (!slug) return [];
    const h = await puente(`https://animeav1.com/media/${slug}/${n}`);
    if (!h || (h.length < 3000 && !h.includes("embeds"))) return [];
    const blk = h.match(/embeds:\{[\s\S]*?\}\}/);
    const raw = blk ? blk[0] : h;
    const out = [];
    for (const [tag, lang] of [["DUB", "Latino"], ["SUB", "Sub"]]) {
      const seg = raw.match(new RegExp(tag + ":\\[([\\s\\S]*?)\\]"));
      if (!seg) continue;
      const vistos = new Set();
      for (const m of seg[1].matchAll(/server:"([^"]+)",url:"([^"]+)"/g)) {
        const url = m[2];
        const name = nm(url) !== "Servidor" ? nm(url) : (m[1] === "HLS" ? "AnimeAV1 HD" : m[1]);
        if (vistos.has(name)) continue;
        vistos.add(name);
        out.push({ url, name, lang, desc: lang === "Latino" ? "Audio Latino" : "" });
      }
    }
    return out;
  }
  async function av1Max(slug) {
    if (!slug) return 0;
    const h = await puente(`https://animeav1.com/media/${slug}`);
    const ns = [...h.matchAll(new RegExp(`/media/${slug}/(\\d+)`, "g"))].map((m) => +m[1]);
    return ns.length ? Math.max(...ns) : 0;
  }
  async function av1Search(q) {
    const h = await puente("https://animeav1.com/catalogo?search=" + encodeURIComponent(q));
    const c = [...new Set([...h.matchAll(/\/media\/([a-z0-9-]+)/g)].map((m) => m[1]))];
    return mejorSlug(c, q);
  }

  async function jkServers(slug, n) {
    if (!slug) return [];
    const h = await puente(`https://jkanime.net/${slug}/${n}/`);
    if (!h) return [];
    const out = [], vistos = new Set();
    const JKP = { um: "Desu", umv: "Magi" };
    for (const m of h.matchAll(/jkplayer\/(um|umv)\?[^"'\s<)]+/g)) {
      const name = JKP[m[1]];
      if (!name || vistos.has(name)) continue;
      vistos.add(name);
      out.push({ url: "https://jkanime.net/" + m[0].replace(/&amp;/g, "&"), name, lang: "Sub", desc: "" });
    }
    const arr = h.match(/var\s+servers\s*=\s*(\[[\s\S]*?\]);/);
    if (arr) {
      let lista = [];
      try { lista = JSON.parse(arr[1]); } catch {}
      for (const s of lista) {
        let u = "";
        try { u = atob(s.remote || ""); } catch { continue; }
        if (!u.startsWith("http")) continue;
        const known = nm(u);
        const name = known !== "Servidor" ? known : (s.server || "Servidor");
        if (vistos.has(name)) continue;
        vistos.add(name);
        out.push({ url: u, name, lang: "Sub", desc: "" });
      }
    }
    return out;
  }
  async function jkSearch(q) {
    const h = await puente("https://jkanime.net/buscar/" + encodeURIComponent(q) + "/");
    const c = [...new Set([...h.matchAll(/href="https:\/\/jkanime\.net\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))]
      .filter((s) => !["buscar", "letra", "genero", "top", "horario", "directorio"].includes(s));
    return mejorSlug(c, q);
  }

  const ALHD = "https://www.animelatinohd.com";
  const ALHD_LANG = { LAT: "Latino", ESP: "Castellano", SUB: "Sub" };
  async function alhdSearch(q) {
    const h = await puente(`${ALHD}/directorio?search=${encodeURIComponent(q)}`, ALHD + "/");
    const t = h.replace(/\\"/g, '"');
    const pares = [...t.matchAll(/"name":"([^"]{2,90})"[\s\S]{0,400}?"slug":"([a-z0-9-]+)"/g)];
    if (!pares.length) return null;
    const want = norm(q);
    let mejor = null, mx = -1;
    for (const [, name, slug] of pares) {
      const cn = norm(name);
      const sc = cn === want ? 100 : (want.includes(cn) || cn.includes(want)) ? 70
        : cn.split(" ").filter((w) => want.split(" ").includes(w)).length;
      if (sc > mx) { mx = sc; mejor = slug; }
    }
    return mejor;
  }
  async function alhdServers(slug, n) {
    if (!slug) return [];
    const h = await puente(`${ALHD}/ver/${slug}/${n}`, `${ALHD}/anime/${slug}`);
    const t = h.replace(/\\"/g, '"');
    const m = t.match(/"players":(\[[\s\S]*?\}\])/);
    if (!m) return [];
    let arr = [];
    try { arr = JSON.parse(m[1]); } catch { return []; }
    const out = [], vistos = new Set();
    for (const pl of arr) {
      const u = String(pl.bridge_url || "").trim();
      if (!u.startsWith("http") || vistos.has(u)) continue;
      vistos.add(u);
      const lang = ALHD_LANG[String(pl.language || "").toUpperCase()] || "Sub";
      out.push({ url: u, name: "AnimeLatinoHD " + (pl.server_name || "Player"), lang, desc: lang === "Latino" ? "Audio Latino" : "" });
    }
    return out;
  }

  // porygonsubs: el id del host va en base64 anidado un número VARIABLE de veces.
  const PORY = "https://porygonsubs.com";
  const PORY_HOST = {
    fm: "https://bysefujedu.com/e/{}", voe: "https://voe.sx/e/{}", dood: "https://dood.re/e/{}",
    mega: "https://mega.nz/file/{}", kf: "https://krakenfiles.com/embed-video/{}",
  };
  function poryCodigo(c) {
    let v = String(c || "").trim();
    for (let i = 0; i < 6; i++) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) break;
      let nv = "";
      try { nv = atob(v); } catch { break; }
      if (nv.length < 4 || /[^\x20-\x7e]/.test(nv)) break;
      v = nv;
    }
    return v;
  }
  async function porySearch(q) {
    const h = await puente(`${PORY}/sitemap.xml`);
    const slugs = [...h.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
      .filter((u) => !u.includes("/ver/") && u.split("/").length === 4 && u.split("/")[3])
      .map((u) => u.split("/")[3]);
    const want = new Set(norm(q).split(" "));
    let mejor = null, mx = 0;
    for (const s of slugs) {
      const cs = new Set(norm(s.replace(/-/g, " ")).split(" "));
      const comunes = [...want].filter((w) => cs.has(w)).length;
      const sc = comunes * 10 + ([...want].every((w) => cs.has(w)) ? 30 : 0);
      if (sc > mx) { mx = sc; mejor = s; }
    }
    return mx >= 30 ? mejor : null;
  }
  async function poryServers(slug, n) {
    if (!slug) return [];
    const h = await puente(`${PORY}/ver/${slug}-${n}`, `${PORY}/${slug}`);
    const out = [], vistos = new Set();
    for (const m of h.matchAll(/<button[^>]*data-position="(btn-(?:lat|sub)-\d+)"[^>]*data-slug="([a-z]+)"[^>]*data-codigo="([^"]+)"/g)) {
      const tpl = PORY_HOST[m[2]];
      if (!tpl) continue;
      const id = poryCodigo(m[3]);
      if (!id || id.length < 6) continue;
      const u = tpl.replace("{}", id);
      if (vistos.has(u)) continue;
      vistos.add(u);
      const lang = m[1].startsWith("btn-lat") ? "Latino" : "Sub";
      out.push({ url: u, name: nm(u), lang, desc: lang === "Latino" ? "Audio Latino" : "" });
    }
    return out;
  }

  // animeonline.ninja: está detrás del muro de Cloudflare. Se intenta igual; si no
  // pasa, se avisa una vez y se sigue con el resto de fuentes.
  const NINJA = "https://ww3.animeonline.ninja";
  let ninjaAvisado = false;
  async function ninjaSearch(q) {
    const h = await puente(`${NINJA}/?s=${encodeURIComponent(q)}`, NINJA + "/");
    if (!h) { if (!ninjaAvisado) { log("animeonline.ninja: el sitio pide verificación de Cloudflare y no responde al Worker."); ninjaAvisado = true; } return null; }
    const c = [...new Set([...h.matchAll(/animeonline\.ninja\/anime\/([a-z0-9-]+)\/?"/g)].map((m) => m[1]))];
    return mejorSlug(c, q);
  }
  async function ninjaServers(slug, n, temporada = 1) {
    if (!slug) return [];
    const h = await puente(`${NINJA}/episodio/${slug}-${temporada}x${n}/`, NINJA + "/");
    if (!h) return [];
    const out = [], vistos = new Set();
    for (let u of [...h.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map((m) => m[1])) {
      if (u.startsWith("//")) u = "https:" + u;
      if (!u.startsWith("http") || vistos.has(u) || /youtube|disqus|facebook/i.test(u)) continue;
      vistos.add(u);
      const lang = /lat|dob|espanol|español/i.test(u) ? "Latino" : "Sub";
      out.push({ url: u, name: nm(u), lang, desc: lang === "Latino" ? "Audio Latino" : "" });
    }
    return out;
  }

  // Devuelve null si NINGÚN candidato se parece de verdad: antes cogía siempre el
  // primero y por eso se scrapeaban animes equivocados. Y un título sin letras
  // latinas (chino/japonés) no sirve para comparar, así que no elige nada.
  function mejorSlug(cands, title) {
    if (!cands || !cands.length) return null;
    const want = norm(title);
    if (!want) return null;
    const VACIAS = new Set(["the", "a", "an", "of", "no", "wa", "ga", "ni", "to", "de", "la", "el",
      "los", "las", "season", "temporada", "tv", "anime", "donghua"]);
    const toks = (x) => new Set(norm(x).split(" ").filter((w) => w && !VACIAS.has(w)));
    const ta = toks(want);
    let mejor = null, mx = 0;
    for (const c of cands) {
      const cn = norm(String(c).replace(/[-/]/g, " "));
      if (!cn) continue;
      let sc;
      if (cn === want) sc = 1;
      else if (cn.startsWith(want) || want.startsWith(cn)) sc = 0.9;
      else {
        const tb = toks(cn);
        const com = [...ta].filter((w) => tb.has(w)).length;
        sc = (!ta.size || !tb.size || !com) ? 0
          : (com / Math.min(ta.size, tb.size)) * ((com / Math.max(ta.size, tb.size)) * 0.5 + 0.5);
      }
      if (sc > mx) { mx = sc; mejor = c; }
    }
    return mx >= 0.45 ? mejor : null;
  }

  // ------------------------------------------------------------ metadata
  async function anilistChain(titulo) {
    const query = `query($s:String){Page(perPage:12){media(search:$s,type:ANIME,sort:SEARCH_MATCH){id episodes format startDate{year} title{romaji english native} synonyms relations{edges{relationType node{id episodes format title{romaji english}startDate{year}}}}}}}`;
    try {
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { s: titulo } }),
      });
      const j = await r.json();
      const lista = ((j.data || {}).Page || {}).media || [];
      const base = lista.find((m) => m.format === "TV") || lista[0];
      if (!base) return [];
      const cad = [{ romaji: base.title.romaji, english: base.title.english, native: base.title.native, episodes: base.episodes, synonyms: base.synonyms || [] }];
      let actual = base;
      const vistos = new Set([base.id]);
      for (let i = 0; i < 8; i++) {
        const sig = ((actual.relations || {}).edges || []).find((e) => e.relationType === "SEQUEL" && e.node && !vistos.has(e.node.id));
        if (!sig) break;
        vistos.add(sig.node.id);
        cad.push({ romaji: sig.node.title.romaji, english: sig.node.title.english, episodes: sig.node.episodes, synonyms: [] });
        actual = sig.node;
        if (!actual.relations) break;
      }
      return cad;
    } catch { return []; }
  }

  /** FASE 1: metadata (igual que build_meta del escritorio). */
  async function buildMeta(titulo, opts = {}) {
    log(`== ${titulo} ==`);
    let tv = opts.tmdb || null;
    if (!tv) {
      try {
        const j = await tmdb("/search/tv", { query: titulo, language: "es-ES" });
        tv = (j.results || [])[0] ? j.results[0].id : null;
      } catch (e) { log("TMDB: " + e.message); }
    }
    const info = {
      title: titulo, year: null, genres: [], description: "", poster: "", backdrop: "",
      logo: "", imdb: opts.imdb || "", seasons: [], stills: {}, altTitles: [], runtime: 24,
    };
    if (tv) {
      const d = await tmdb(`/tv/${tv}`, { language: "es-ES" });
      info.title = d.name || titulo;
      info.description = d.overview || "";
      info.genres = (d.genres || []).map((g) => g.name).slice(0, 5);
      info.year = +String(d.first_air_date || "").slice(0, 4) || null;
      info.runtime = (d.episode_run_time || [])[0] || 24;
      if (d.poster_path) info.poster = `${IMG}/w500${d.poster_path}`;
      if (d.backdrop_path) info.backdrop = `${IMG}/w1280${d.backdrop_path}`;
      info.seasons = (d.seasons || []).filter((s) => s.season_number > 0)
        .map((s) => ({ season: s.season_number, count: s.episode_count, nombre: (s.name || "").trim() }));
      try {
        const ex = await tmdb(`/tv/${tv}/external_ids`);
        info.imdb = info.imdb || ex.imdb_id || "";
      } catch {}
      try {
        const im = await tmdb(`/tv/${tv}/images`, { include_image_language: "es,en,null" });
        const lo = (im.logos || []).sort((a, b) => (b.iso_639_1 === "es") - (a.iso_639_1 === "es") || b.vote_average - a.vote_average)[0];
        if (lo) info.logo = `${IMG}/w500${lo.file_path}`;
      } catch {}
      // fotogramas, títulos y sinopsis por episodio (español, con respaldo en inglés)
      for (const S of info.seasons) {
        const [es, en] = await Promise.all([
          tmdb(`/tv/${tv}/season/${S.season}`, { language: "es-ES" }).catch(() => ({})),
          tmdb(`/tv/${tv}/season/${S.season}`, { language: "en-US" }).catch(() => ({})),
        ]);
        const porNum = {};
        (en.episodes || []).forEach((e) => (porNum[e.episode_number] = { en: e }));
        (es.episodes || []).forEach((e) => (porNum[e.episode_number] = { ...(porNum[e.episode_number] || {}), es: e }));
        for (const [n, par] of Object.entries(porNum)) {
          const a = par.es || {}, b = par.en || {};
          const still = a.still_path || b.still_path;
          info.stills[`${S.season}x${n}`] = {
            still: still ? `${IMG}/w500${still}` : "",
            title: esEpTitle(a.name, n) !== `Episodio ${n}` ? a.name : (b.name || ""),
            overview: a.overview || b.overview || "",
            air_date: a.air_date || b.air_date || "",
            runtime: a.runtime || info.runtime,
          };
        }
      }
    }
    if (!info.seasons.length) info.seasons = [{ season: 1, count: 60 }];
    const al = await anilistChain(info.title || titulo);
    if (al.length) {
      log(`AniList: ${al.length} bloque(s) → ${al.map((c, i) => `T${i + 1}:${c.episodes || "?"}`).join(" · ")}  (TMDB: ${info.seasons.length})`);
      if (al.length > info.seasons.length)
        for (let i = info.seasons.length; i < al.length; i++) info.seasons.push({ season: i + 1, count: al[i].episodes || 24 });
      al.forEach((c, i) => { if (i < info.seasons.length && c.episodes) info.seasons[i].count = c.episodes; });
      const alt = [];
      const b = al[0];
      [b.romaji, b.english, b.native, ...(b.synonyms || []).slice(0, 3)].forEach((t) => {
        if (t && t !== info.title && !alt.includes(t)) alt.push(t);
      });
      info.altTitles = alt.slice(0, 12);
    }
    // Los DONGHUA llegan con el título original en chino y de ahí no sale un id
    // válido: se muestra el que escribió el usuario (o el romaji) y el original
    // pasa a los títulos alternativos.
    const conLatinas = (x) => /[A-Za-z]/.test(String(x || "").normalize("NFD").replace(/[^ -]/g, ""));
    if (!conLatinas(info.title)) {
      const alt = [titulo, ...(info.altTitles || [])].find(conLatinas);
      if (alt) {
        if (info.title && !(info.altTitles || []).includes(info.title))
          info.altTitles = [info.title, ...(info.altTitles || [])].slice(0, 12);
        log(`título sin letras latinas (${info.title}) → se usa «${alt}»`);
        info.title = alt;
      }
    }
    log(`título real: ${info.title} | imdb=${info.imdb || "—"} | tmdb=${tv || "—"}`);
    return { info, real_title: info.title, seasons: info.seasons.map((s) => ({ ...s })), anilist: al, tmdb: tv, episodes: [] };
  }

  /** FASE 2: episodios con servidores (igual que build_episodes del escritorio). */
  async function buildEpisodes(data, opts, onEp = () => {}, prog = () => {}) {
    const info = data.info, imdb = info.imdb, titulo = data.real_title;
    const aid = opts.aid;
    const slugsManual = String(opts.src_slug || "").split(",").map((s) => s.trim()).filter(Boolean);
    // Nombre propio de la temporada cuando TMDB se lo pone («Stardust Crusaders»).
    const GENERICA = /^(?:temporada|season|parte|part|staffel|saison)\s*\d*$|^\d+$/i;
    const nombreTemporada = (n, tn) => (tn && !GENERICA.test(tn.trim())) ? tn.trim() : `Temporada ${n}`;
    let seasons = data.seasons.map((s, i) => ({ ...s, name: nombreTemporada(i + 1, s.nombre), e69s: s.season }));
    let perSeasonNum = false, multi = false;
    const activa = (k) => !!opts[k];

    let baseJk = "", baseAv = "", baseAlhd = "", basePory = "", baseNinja = "";
    if (slugsManual.length > 1) {
      multi = true; perSeasonNum = true;
      seasons = slugsManual.map((s, i) => ({ season: i + 1, count: 400, name: `Temporada ${i + 1}`, jk: s, av: s, e69s: i + 1 }));
      seasons = fusionaPartes(seasons, data.anilist, log);
    } else {
      const uno = slugsManual[0] || "";
      baseJk = uno || (activa("jk") ? await jkSearch(titulo) : "") || "";
      baseAv = uno || (activa("av1") ? await av1Search(titulo) : "") || "";
      baseAlhd = activa("alhd") ? (await alhdSearch(titulo)) || "" : "";
      basePory = (opts.pory_slug || "").trim() || (activa("pory") ? (await porySearch(titulo)) || "" : "");
      baseNinja = activa("ninja") ? (await ninjaSearch(titulo)) || "" : "";
      if (activa("jk")) log(`jkanime: ${baseJk || "(no)"}`);
      if (activa("av1")) log(`animeav1: ${baseAv || "(no)"}`);
      if (activa("alhd")) log(`animelatinohd: ${baseAlhd || "(no)"}`);
      if (activa("pory")) log(`porygonsubs: ${basePory || "(no)"}`);
      if (activa("ninja")) log(`animeonline.ninja: ${baseNinja || "(no)"}`);
      // secuelas: animeav1 y jkanime les dan slug propio
      const avList = [], jkList = [];
      if (baseAv) {
        avList.push(baseAv);
        for (const suf of ["-2nd-season", "-3rd-season", "-season-2", "-2"]) {
          if (await av1Max(baseAv + suf) > 0) avList.push(baseAv + suf);
        }
      }
      if (baseJk) jkList.push(baseJk);
      const nsrc = Math.max(avList.length, jkList.length);
      if (nsrc > 1) {
        multi = true; perSeasonNum = true;
        seasons = [];
        for (let i = 0; i < nsrc; i++) {
          seasons.push({
            season: i + 1, count: 400, name: nombreTemporada(i + 1, (data.seasons[i] || {}).nombre),
            jk: jkList[i] || null, av: avList[i] || null,
            e69s: data.seasons[i] ? data.seasons[i].season : i + 1,
          });
        }
        seasons = fusionaPartes(seasons, data.anilist, log);
        log(`AUTO temporadas: ${seasons.filter((s) => !s.cont).length}`);
      } else {
        seasons = seasons.map((s) => ({ ...s, jk: baseJk || null, av: baseAv || null }));
        if (seasons.length > 1) perSeasonNum = true;
      }
      // OVAs y películas
      const modo = (opts.ovas || "aparte").toLowerCase();
      if (!slugsManual.length && modo !== "omitir") {
        for (const [nombre, sufijos] of [["OVAs", ["-ova", "-ovas", "-oad", "-especiales"]],
                                         ["Películas", ["-movie", "-movies", "-pelicula", "-peliculas"]]]) {
          let exAv = null;
          for (const suf of sufijos) { if (baseAv && await av1Max(baseAv + suf) > 0) { exAv = baseAv + suf; break; } }
          if (!exAv) continue;
          if (modo === "juntas" && seasons.length) {
            const ult = seasons[seasons.length - 1].name;
            seasons.push({ season: seasons[seasons.length - 1].season, count: 60, name: ult, av: exAv, e69s: null, psn: true, cont: true });
            log(`${nombre} detectadas (${exAv}) → se unen a ${ult}`);
          } else {
            seasons.push({ season: seasons.length + 1, count: 60, name: nombre, av: exAv, e69s: null, psn: true });
            log(`${nombre} detectadas (${exAv}) → bloque «${nombre}»`);
          }
        }
      }
    }

    const rango = parseRango(opts.range);
    const episodes = [];
    const sinFoto = [];
    let ultNum = 0, ultNombre = "", absn = 0, parar = false;
    const manual = {};
    String(opts.manual_text || "").split("\n").map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
      const m = l.match(/^(\d+)\s*\|\s*(\S+)/);
      manual[m ? +m[1] : i + 1] = m ? m[2] : l;
    });

    for (const S of seasons) {
      if (parar) break;
      const sname = S.name || "Temporada 1";
      const off = (S.cont && sname === ultNombre) ? ultNum : 0;
      if (off) log(`— ${sname}: otra parte, sigue en el episodio ${off + 1}`);
      let vacios = 0;
      const tope = S.count || 400;
      for (let n = 1; n <= tope; n++) {
        absn += 1;
        if (rango && !rango.has(perSeasonNum ? n : absn)) continue;
        let servers = [];
        const srcNum = (perSeasonNum || S.psn) ? n : absn;
        if (activa("e69") && imdb && S.e69s != null) {
          try { const r = await embed69(imdb, S.e69s, n); if (r) servers.push(r); } catch {}
          await esperar(500);
        }
        if (activa("alhd") && baseAlhd) { try { servers.push(...await alhdServers(baseAlhd, srcNum)); } catch {} }
        if (activa("pory") && basePory) { try { servers.push(...await poryServers(basePory, srcNum)); } catch {} }
        if (activa("ninja") && baseNinja) { try { servers.push(...await ninjaServers(baseNinja, srcNum, S.e69s || 1)); } catch {} }
        if (activa("av1") && S.av) { try { servers.push(...await av1Servers(S.av, srcNum)); } catch {} }
        if (activa("jk") && S.jk) { try { servers.push(...await jkServers(S.jk, srcNum)); } catch {} }
        const clave = (perSeasonNum ? n : absn);
        if (opts.manual && manual[clave]) {
          const u = manual[clave];
          servers.push({ url: u, name: nm(u) !== "Servidor" ? nm(u) : "Directo", desc: "",
                         lang: /lat|dob/i.test(u) ? "Latino" : "Sub" });
        }
        servers = prioritize(servers, (opts.prefer || "").split(",").filter(Boolean), opts.only, 4);
        if (!servers.length) {
          vacios += 1;
          if (vacios >= (multi ? 6 : 12) && !rango) {
            if (multi) { log(`  fin de ${sname}`); break; }
            log(`  fin del anime — construidos ${episodes.length}`); parar = true; break;
          }
          continue;
        }
        vacios = 0;
        const num = off ? off + n : ((perSeasonNum || S.psn) ? n : absn);
        const em = info.stills[`${S.season}x${num}`] || info.stills[`${S.e69s || S.season}x${num}`]
          || (!perSeasonNum ? info.stills[`1x${absn}`] : null) || {};
        if (!em.still) sinFoto.push(`${sname} ${num}`);
        const ep = {
          number: num, season: sname, title: em.title || `Episodio ${num}`,
          language: audioLabel(servers.map((s) => s.lang)) === "Sub" ? "Sub" : (servers.some((s) => s.lang === "Latino") ? "Latino" : "Sub"),
          videoUrl: `frame/player.html?a=${aid}&s=${encodeURIComponent(sname)}&e=${num}`,
          img: em.still || info.backdrop || info.poster,
          description: em.overview || "", releaseDate: fmtFecha(em.air_date || ""),
          duration: `${em.runtime || info.runtime || 24} min`, servers,
        };
        episodes.push(ep); ultNum = num; ultNombre = sname;
        onEp(ep); prog(episodes.length);
        if (episodes.length === 1 || episodes.length % 12 === 0) log(`  ${sname} ep ${num}: ${servers.length} servidores`);
      }
    }
    if (sinFoto.length) log(`⚠ ${sinFoto.length} episodio(s) sin foto propia en TMDB (llevan la imagen del anime): ${sinFoto.slice(0, 8).join(", ")}${sinFoto.length > 8 ? "…" : ""}`);
    if (opts.traducir !== false) {
      let trad = 0;
      for (const e of episodes) {
        if (pareceIngles(e.title)) { const t = await traducir(e.title, log); if (t !== e.title) { e.title = t; trad++; } }
        if (pareceIngles(e.description)) { const t = await traducir(e.description, log); if (t !== e.description) { e.description = t; trad++; } }
      }
      if (trad) log(`traducidos al español: ${trad} textos`);
    }
    data.episodes = episodes;
    data.audio = audioLabel(episodes.map((e) => e.language === "Latino" ? "Latino" : "Sub"));
    log(`== ${episodes.length} episodios == audio: ${data.audio}`);
    return episodes;
  }

  return {
    wk, puente, tmdb, buildMeta, buildEpisodes,
    fuentes: { embed69, av1Servers, av1Max, av1Search, jkServers, jkSearch, alhdSearch, alhdServers, porySearch, poryServers, ninjaSearch, ninjaServers },
  };
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export function fmtFecha(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MESES[+m[2] - 1]} ${+m[3]}, ${m[1]}` : "";
}
export function parseRango(txt) {
  const s = String(txt || "").trim();
  if (!s) return null;
  const out = new Set();
  for (const parte of s.split(",")) {
    const m = parte.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let i = +m[1]; i <= +m[2]; i++) out.add(i); }
    else if (/^\d+$/.test(parte.trim())) out.add(+parte.trim());
  }
  return out.size ? out : null;
}
