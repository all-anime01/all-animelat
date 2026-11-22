// ============================================================================
//  Endo · ¿Qué anime me están pidiendo?
//  Empareja lo que dice el usuario (tal como lo escribe el reconocedor de voz)
//  con un anime del catálogo. Sin red y sin dependencias: se prueba con
//  `node test/endo-catalogo.test.mjs`.
//
//  Lo que resuelve:
//   · «Como suena»: el micrófono escribe en español lo que oye («yuyutsu
//     kaisen», «quimetsu no yaiba», «jaikiu») → forma fonética común.
//   · Títulos en inglés dichos a la española («wan pis», «espai por familia»).
//   · Frases con relleno: «Jujutsu Kaisen temporada 2», «la película de…»,
//     «… en latino», «por favor»… Se aparta lo que sobra y, si aun así no
//     calza, se prueba con trozos de la frase.
//   · Números dichos con letras: «Kaiju número ocho» = «Kaiju No. 8».
// ============================================================================

const NUMEROS = {
  cero: 0, uno: 1, una: 1, primero: 1, primera: 1, dos: 2, segundo: 2, segunda: 2,
  tres: 3, tercero: 3, tercera: 3, cuatro: 4, cuarto: 4, cuarta: 4, cinco: 5, quinto: 5, quinta: 5,
  seis: 6, sexta: 6, sexto: 6, siete: 7, septima: 7, ocho: 8, octava: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20,
};

/** Minúsculas, sin tildes ni signos, números con cifras. */
export function limpiar(x) {
  let t = String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  t = t.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return t.split(" ").map((w) => (w in NUMEROS ? String(NUMEROS[w]) : w)).join(" ");
}

/** Forma fonética en español: «jujutsu» y «yuyutsu» quedan iguales. */
export function fon(x) {
  let t = limpiar(x);
  t = t.replace(/\b(numero|num|nro|n)\s+(\d)/g, "no $2");   // «número 8» = «No. 8»
  t = t.replace(/sh/g, "x").replace(/ch/g, "x");
  t = t.replace(/ph/g, "f");
  t = t.replace(/\bequis\b/g, "x");
  t = t.replace(/qu/g, "k");
  t = t.replace(/gu([ei])/g, "g$1");
  t = t.replace(/c([ei])/g, "s$1").replace(/c/g, "k");
  t = t.replace(/z/g, "s");
  t = t.replace(/h/g, "");
  t = t.replace(/j/g, "y");
  t = t.replace(/v/g, "b");
  t = t.replace(/w/g, "u");
  t = t.replace(/([bdfgklmnprstx])y([aeiou])/g, "$1i$2");    // «kyo» = «kio»
  t = t.replace(/([bdfgklmnprstx])y\b/g, "$1i");
  t = t.replace(/\be(s[bcdfgklmnpqrstvxyz])/g, "$1");         // «espai» = «spai»
  t = t.replace(/(.)\1+/g, "$1");
  return t.replace(/\s+/g, " ").trim();
}

/** Cómo suena un título en inglés leído por alguien que habla español. */
export function comoIngles(x) {
  let t = limpiar(x);
  if (!/[a-z]/.test(t)) return "";
  t = t.replace(/\bone\b/g, "uan").replace(/\btwo\b/g, "tu").replace(/\bthe\b/g, "de");
  t = t.replace(/\bmy\b/g, "mai").replace(/\bspy\b/g, "spai").replace(/\bx\b/g, "por");
  t = t.replace(/igh/g, "ai").replace(/ay/g, "ei").replace(/ee/g, "i").replace(/ea/g, "i")
    .replace(/oo/g, "u").replace(/ie/g, "i").replace(/ue\b/g, "u").replace(/ou/g, "au")
    .replace(/th/g, "t").replace(/wh/g, "u").replace(/\bkn/g, "n");
  t = t.replace(/ce\b/g, "s").replace(/([bcdfgklmnprstvz])e\b/g, "$1").replace(/y\b/g, "i");
  return t;
}

function dist(a, b, tope) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let mejor = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < mejor) mejor = cur[j];
    }
    if (mejor > tope) return tope + 1;
    prev = cur;
  }
  return prev[b.length];
}
export const parecido = (a, b) => {
  const m = Math.max(a.length, b.length);
  return m ? 1 - dist(a, b, m) / m : 0;
};
// Igual, pero si no llega a `min` devuelve 0 sin terminar la cuenta (mucho más rápido).
function parecidoMin(a, b, min) {
  const m = Math.max(a.length, b.length);
  if (!m) return 0;
  const tope = Math.floor((1 - min) * m);
  if (Math.abs(a.length - b.length) > tope) return 0;
  const d = dist(a, b, tope);
  return d > tope ? 0 : 1 - d / m;
}

// Palabras que no ayudan a distinguir un título de otro.
const VACIAS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "y", "a", "al", "en", "anime",
  "serie", "the", "of", "no", "ver", "pon", "abre", "busca", "por", "o", "mi", "me", "lo", "que"]);
const palabras = (f) => f.split(" ").filter((w) => w && !VACIAS.has(w) && (w.length > 1 || /\d/.test(w)));

// Relleno que la gente añade al pedir un anime. Se aparta antes de comparar
// (y se recuerda: temporada pedida, si quería la película…).
const RELLENO = [
  /\b(?:por favor|porfa|porfavor|ahora|ya|rapido|gracias)\b/g,
  /\b(?:en )?(?:latino|espanol|castellano|subtitulado|subtitulada|sub|doblado|doblada|doblaje|japones|audio latino)\b/g,
  /\b(?:quiero ver|quiero|me gustaria ver|me gustaria|podrias|puedes|dame|muestrame|ensename)\b/g,
  /\b(?:la serie|el anime|la serie de|el anime de|todos los capitulos de|todos los episodios de)\b/g,
];
const RE_TEMPORADA = /\b(?:la )?(?:temporada|season|temp|parte|part|cour)\s+(\d{1,2})\b|\b(\d{1,2})(?:a|ra|da|ta|va|na)? temporada\b/;
const RE_PELICULA = /\b(?:la |las )?(?:pelicula|peliculas|peli|pelis|movie|film|filme)\b/;

/** Separa lo que se pide de lo que sobra: {texto, temporada, pelicula}. */
export function separar(q) {
  let t = limpiar(q);
  let temporada = null, pelicula = false;
  const mt = t.match(RE_TEMPORADA);
  if (mt) { temporada = +(mt[1] || mt[2]); t = t.replace(RE_TEMPORADA, " "); }
  if (RE_PELICULA.test(t)) { pelicula = true; t = t.replace(RE_PELICULA, " "); }
  for (const re of RELLENO) t = t.replace(re, " ");
  t = t.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) t = t.replace(/^(?:de|del|el|la|los|las)\s+/, "").replace(/\s+(?:de|del|el|la)$/, "");
  return { texto: t.replace(/\s+/g, " ").trim(), temporada, pelicula };
}

const esPeli = (a) => /^pel[ií]cula$|^movie$/i.test(String(a.type || "").trim()) ||
  /\b(pel[ií]cula|movie|film)\b/i.test(a.title || "");

/**
 * Crea el buscador sobre el catálogo (se indexa una vez).
 * Devuelve { buscar(q) → {anime, puntos, temporada, pelicula} | null, findAnime(q) → anime | null }.
 */
export function crearBuscador(catalogo) {
  let indice = null, tam = -1;
  function indexar() {
    if (indice && tam === (catalogo || []).length) return indice;
    indice = (catalogo || []).map((a) => {
      const crudos = [a.title, ...(a.altTitles || [])].filter(Boolean);
      const formas = new Set();
      for (const c of crudos) {
        const f = fon(c); if (f) formas.add(f);
        const sinSub = fon(String(c).split(/[:(\-–—]/)[0]);       // «Frieren: Más allá…» → «Frieren»
        if (sinSub && sinSub.length >= 4) formas.add(sinSub);
        const ing = fon(comoIngles(c)); if (ing) formas.add(ing);
        if (/\sx\s/i.test(c)) formas.add(fon(String(c).replace(/\sx\s/gi, " por ")));
      }
      const nombres = [...formas];
      return {
        ref: a, peli: esPeli(a), nombres,
        pegados: nombres.map((n) => n.replace(/ /g, "")),
        palabras: nombres.map(palabras),
      };
    });
    tam = (catalogo || []).length;
    return indice;
  }

  function puntuar(fq, it) {
    const qw = palabras(fq);
    if (!qw.length) return 0;
    const qp = fq.replace(/ /g, "");
    let sc = 0;
    for (let k = 0; k < it.nombres.length; k++) {
      const t = it.nombres[k], tp = it.pegados[k], tw = it.palabras[k];
      if (t === fq || tp === qp) return 100;
      if (fq.length >= 5 && (t.indexOf(" " + fq + " ") >= 0 || t.indexOf(fq + " ") === 0 || t.endsWith(" " + fq))) sc = Math.max(sc, 92);
      const sim = parecidoMin(qp, tp, 0.72);
      if (sim >= 0.72) sc = Math.max(sc, Math.round(48 + 52 * sim));
      if (qp.length >= 5 && tp.indexOf(qp) === 0) sc = Math.max(sc, 86);
      if (tw.length) {
        let peso = 0;
        for (const w of qw) {
          let mp = 0;
          for (const x of tw) {
            const v = /\d/.test(w) || /\d/.test(x) ? (w === x ? 1 : 0) : parecidoMin(w, x, 0.6);
            if (v > mp) { mp = v; if (v === 1) break; }
          }
          if (mp >= 0.6) peso += mp;
        }
        const covQ = peso / qw.length, covT = Math.min(1, peso / tw.length);
        sc = Math.max(sc, Math.round(88 * covQ * (0.55 + 0.45 * covT)));
      }
    }
    return sc;
  }

  // Mejor anime para una forma fonética concreta.
  // `vistos` (opcional) recoge los animes que comparten algo con la frase.
  function mejorPara(fq, pelicula, lista, vistos) {
    let mejor = null, mejorSc = 0;
    for (const it of lista || indexar()) {
      let sc = puntuar(fq, it);
      if (!sc) continue;
      if (vistos) vistos.add(it);
      if (pelicula) sc += it.peli ? 6 : -4;      // pidió la película
      else if (it.peli) sc -= 3;                // a igualdad, la serie
      if (sc > mejorSc) { mejorSc = sc; mejor = it.ref; }
    }
    return { anime: mejor, puntos: mejorSc };
  }

  function variantes(texto) {
    const out = new Set([fon(texto)]);
    if (/j/.test(texto)) out.add(fon(texto.replace(/j/g, "h")));   // «jaikiu» = «haikyuu»
    if (/\bpor\b/.test(texto)) out.add(fon(texto.replace(/\bpor\b/g, "x")));
    out.add(fon(comoIngles(texto)));
    out.delete("");
    return [...out];
  }

  const UMBRAL = 62;
  function buscar(q) {
    const { texto, temporada, pelicula } = separar(q);
    if (!texto) return null;
    let mejor = { anime: null, puntos: 0 };
    const candidatos = new Set();
    for (const v of variantes(texto)) {
      const r = mejorPara(v, pelicula, null, candidatos);
      if (r.puntos > mejor.puntos) mejor = r;
    }
    // Aún no calza: se prueba con trozos seguidos de la frase («abre ya mismo
    // jujutsu kaisen que me lo recomendaron»), restando por cada palabra que sobra.
    const ws = texto.split(" ");
    // Solo entre los animes que ya compartían alguna palabra con la frase entera.
    const lista = [...candidatos];
    if (mejor.puntos < UMBRAL && lista.length && ws.length > 1 && ws.length <= 10) {
      for (let i = 0; i < ws.length; i++) {
        for (let j = i + 1; j <= Math.min(ws.length, i + 5); j++) {   // títulos de hasta 5 palabras
          if (j - i === ws.length) continue;
          const trozo = ws.slice(i, j).join(" ");
          if (palabras(fon(trozo)).join("").length < 4) continue;
          const sobran = ws.length - (j - i);
          for (const v of variantes(trozo)) {
            const r = mejorPara(v, pelicula, lista);
            const p = r.puntos - 3 * sobran;
            if (p > mejor.puntos) mejor = { anime: r.anime, puntos: p };
          }
        }
      }
    }
    return mejor.anime && mejor.puntos >= UMBRAL ? { anime: mejor.anime, puntos: mejor.puntos, temporada, pelicula } : null;
  }

  return { buscar, findAnime: (q) => (buscar(q) || {}).anime || null };
}
