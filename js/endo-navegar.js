// ============================================================================
//  Endo · Navegar por toda la página con la voz
//  - Ir a cualquier página («llévame al calendario», «mi lista», «términos»).
//  - Desplazarse («baja», «sube», «arriba del todo», «al final»).
//  - Ir a una sección por su título («ve a episodios nuevos»).
//  - Pulsar cualquier botón o enlace por su nombre («pulsa compartir»,
//    «añadir a mi lista», «avísame», «filtros»…), también en el reproductor.
//  - En la ficha: cambiar de temporada y contar de qué trata.
//  - Filtrar por género («animes de acción», «películas de comedia»).
// Recibe el texto YA normalizado (minúsculas y sin tildes).
// ============================================================================
import { limpiar, parecido } from "./endo-catalogo.js";

export const PAGINAS = [
  { url: "index.html", nombre: "el inicio", dichos: ["inicio", "casa", "principal", "pagina principal", "home", "portada"] },
  { url: "explorar.html", nombre: "explorar", dichos: ["explorar", "explora", "catalogo", "todos los animes", "series", "todas las series", "directorio"] },
  { url: "peliculas.html", nombre: "películas", dichos: ["peliculas", "pelis", "las peliculas", "seccion de peliculas"] },
  { url: "mis-favoritos.html", nombre: "tu lista", dichos: ["mi lista", "favoritos", "mis favoritos", "guardados", "lista"] },
  { url: "historial.html", nombre: "tu historial", dichos: ["historial", "lo que he visto", "mi historial", "vistos"] },
  { url: "notificaciones.html", nombre: "tus notificaciones", dichos: ["notificaciones", "avisos", "alertas", "novedades"] },
  { url: "calendario-de-estrenos.html", nombre: "el calendario", dichos: ["calendario", "estrenos", "calendario de estrenos", "horario", "que sale hoy", "emision", "en emision"] },
  { url: "cuenta.html", nombre: "tu cuenta", dichos: ["cuenta", "mi cuenta", "iniciar sesion", "entrar", "registrarme", "registro", "login"] },
  { url: "perfil.html", nombre: "tu perfil", dichos: ["perfil", "mi perfil", "configuracion", "ajustes", "preferencias"] },
  { url: "sobre-all-anime.html", nombre: "sobre All-Anime", dichos: ["sobre all anime", "acerca de", "quienes somos", "sobre nosotros", "informacion"] },
  { url: "condiciones-de-uso.html", nombre: "las condiciones de uso", dichos: ["condiciones", "condiciones de uso", "terminos", "terminos y condiciones"] },
  { url: "politica-de-privacidad.html", nombre: "la política de privacidad", dichos: ["privacidad", "politica de privacidad"] },
];

const IR = /^(?:(?:ve|vete|ir|vamos|llevame|lleva me|abre|abrir|muestrame|ensename|entra|entrar|pasa|regresa|vuelve|quiero ir)\s+(?:(?:al|a|en|hacia|para)\s+)?)?(?:la |el |mi |mis |los |las )?(?:pagina|seccion|apartado)?\s*(?:de |del )?(.+?)$/;

/** Página a la que se quiere ir, o null. */
export function paginaPedida(t) {
  const m = String(t || "").trim().match(IR);
  if (!m) return null;
  const q = limpiar(m[1]);
  if (!q) return null;
  let mejor = null, ms = 0;
  for (const p of PAGINAS) for (const d of p.dichos) {
    const s = q === d ? 1 : parecido(q, d);
    if (s > ms) { ms = s; mejor = p; }
  }
  return ms >= 0.86 ? mejor : null;
}

/** Número de temporada en una orden suelta («temporada 2», «la segunda temporada»). */
export function temporadaSuelta(t) {
  const q = limpiar(t);
  const m = q.match(/^(?:(?:pon|ve a|ir a|cambia a|cambia la|selecciona|abre|muestra|muestrame|ensename|vamos a)\s+)?(?:la\s+)?(?:temporada\s+(\d{1,2})|(\d{1,2})\s*(?:a|ra|da|ta|va|na)?\s+temporada)$/);
  return m ? +(m[1] || m[2]) : null;
}

// --- Botones y enlaces visibles ------------------------------------------------
const CLICABLES = 'a[href], button, [role="button"], [role="tab"], [role="link"], [role="menuitem"], input[type="submit"], input[type="button"], summary, .genre-btn, .server-card, [data-server], [onclick]';
function visible(el) {
  if (!el || el.closest("#yoru-ind, #yoru-toast, #yoru-manual")) return false;
  if (el.disabled) return false;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity !== 0;
}
// Todos los nombres con los que se puede llamar a un control (el corto del globito,
// el accesible, el título y el texto que se ve).
const etiquetas = (el) => [el.dataset.tip, el.getAttribute("aria-label"), el.getAttribute("title"), el.innerText, el.value]
  .map((x) => limpiar(x || "").slice(0, 80)).filter(Boolean);
const etiqueta = (el) => etiquetas(el)[0] || "";
function puntosEtiqueta(q, l) {
  if (l === q) return 1;
  // Contiene la frase: vale más cuanto más corto es el texto (una tarjeta entera no).
  if ((` ${l} `).includes(` ${q} `)) return 0.9 - Math.min(0.4, (l.length - q.length) / 100);
  return parecido(q, l);
}

/** Mejor elemento clicable para lo dicho: {el, puntos} o null. */
export function elementoPara(q, raiz = document) {
  q = limpiar(q).replace(/^(?:el|la|los|las|boton|boton de|enlace|enlace de|opcion|opcion de)\s+/, "");
  if (!q) return null;
  let mejor = null, ms = 0;
  const vh = window.innerHeight || 800;
  for (const el of raiz.querySelectorAll(CLICABLES)) {
    if (!visible(el)) continue;
    const ls = etiquetas(el);
    if (!ls.length) continue;
    let s = Math.max(...ls.map((l) => puntosEtiqueta(q, l)));
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) s += 0.04;          // a la vista: preferido
    if (s > ms) { ms = s; mejor = el; }
  }
  return mejor ? { el: mejor, puntos: ms } : null;
}

/** Sección de la página cuyo título se parece a lo dicho. */
export function seccionPara(q) {
  q = limpiar(q).replace(/^(?:la |el |los |las )?(?:seccion|parte|apartado)?\s*(?:de |del )?/, "");
  if (!q) return null;
  let mejor = null, ms = 0;
  for (const h of document.querySelectorAll("h1, h2, h3, .section-title, [data-section]")) {
    if (!visible(h)) continue;
    const l = limpiar(h.getAttribute("data-section") || h.innerText).slice(0, 80);
    if (!l) continue;
    let s = l === q ? 1 : (` ${l} `).includes(` ${q} `) ? 0.9 : parecido(q, l);
    if (s > ms) { ms = s; mejor = h; }
  }
  return ms >= 0.72 ? mejor : null;
}

function pulsar(el) {
  try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
  el.classList.add("endo-pulso");
  setTimeout(() => el.classList.remove("endo-pulso"), 900);
  if (el.tagName === "SUMMARY" || typeof el.click === "function") el.click();
  else el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

/**
 * Crea el navegador. opciones:
 *   decir(clave, datos, texto)  → respuesta hablada (main elige la frase)
 *   aviso(texto)                → toast
 *   animeActual()               → anime de la ficha abierta (o null)
 *   generos()                   → lista de géneros del catálogo
 *   manual()                    → abre el manual de Endo
 */
export function crearNavegador({ decir, aviso, animeActual, generos, manual }) {
  const ir = (url, nombre) => { decir("ir", { nombre }); aviso("Abriendo " + nombre + "…"); setTimeout(() => { location.href = url; }, 350); };

  function desplazar(t) {
    const alto = (window.innerHeight || 800) * 0.8;
    if (/(arriba del todo|al principio|hasta arriba|al inicio de la pagina|sube del todo|sube todo|inicio de la pagina)/.test(t)) { window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
    if (/(abajo del todo|al final|hasta abajo|final de la pagina|baja del todo|baja todo)/.test(t)) { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); return true; }
    if (/^(?:baja|bajar|desliza(?: hacia)? abajo|mas abajo|scroll abajo|sigue bajando|muestrame mas|ver mas abajo|abajo)$/.test(t)) { window.scrollBy({ top: alto, behavior: "smooth" }); return true; }
    if (/^(?:sube|subir|desliza(?: hacia)? arriba|mas arriba|scroll arriba|arriba)$/.test(t)) { window.scrollBy({ top: -alto, behavior: "smooth" }); return true; }
    return false;
  }

  function cambiarTemporada(n) {
    const sel = document.getElementById("season-select");
    if (!sel || !sel.options.length) return false;
    const ops = [...sel.options];
    const op = ops.find((o) => new RegExp(`\\btemporada ${n}\\b`).test(limpiar(o.value))) || ops[n - 1];
    if (!op) { decir("sinTemporada", { n }); return true; }
    sel.value = op.value;
    if (window.jQuery) window.jQuery(sel).trigger("change"); else sel.dispatchEvent(new Event("change", { bubbles: true }));
    try { sel.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
    decir("temporada", { n, nombre: op.value });
    return true;
  }

  function generoPedido(t) {
    const m = t.match(/^(?:(?:muestrame|ensename|pon|busca|quiero ver|quiero|ver|dame|recomiendame)\s+)?(?:algo|animes?|series?|(peliculas?|pelis))\s+(?:de|del genero)\s+(.+)$/) ||
      t.match(/^(?:genero|categoria)\s+()(.+)$/);
    if (!m) return null;
    const q = limpiar(m[2]);
    let mejor = null, ms = 0;
    for (const g of generos() || []) {
      const s = parecido(q, limpiar(g));
      if (s > ms) { ms = s; mejor = g; }
    }
    return ms >= 0.8 ? { genero: mejor, peliculas: !!m[1] } : null;
  }

  /** true si la orden era de navegación y ya se atendió. */
  function navegar(t) {
    if (/^(?:ayuda|que puedes hacer|que sabes hacer|comandos|instrucciones|manual|como te uso|como funcionas)$/.test(t)) { decir("ayuda"); manual(); return true; }
    if (/^(?:adelante|ve adelante|pagina siguiente)$/.test(t)) { history.forward(); return true; }
    if (/^(?:recarga|recargar|actualiza|actualizar|refresca)(?: la pagina)?$/.test(t)) { decir("ok"); location.reload(); return true; }
    if (desplazar(t)) return true;

    const n = temporadaSuelta(t);
    if (n && cambiarTemporada(n)) return true;

    const a = animeActual && animeActual();
    if (a && /(?:de que (?:trata|va)|sinopsis|descripcion|resumen|argumento|cuentame (?:de|sobre) (?:este|el) anime|lee la (?:sinopsis|descripcion))/.test(t)) {
      decir("sinopsis", { titulo: a.title }, a.description || ""); return true;
    }

    const g = generoPedido(t);
    if (g) {
      const url = (g.peliculas ? "peliculas.html" : "explorar.html") + "?genero=" + encodeURIComponent(g.genero);
      decir("genero", { genero: g.genero, peliculas: g.peliculas }); setTimeout(() => { location.href = url; }, 350); return true;
    }

    const p = paginaPedida(t);
    if (p) {
      const aqui = location.pathname.replace(/^\//, "") || "index.html";
      if (aqui.replace(/\.html$/, "") === p.url.replace(/\.html$/, "")) { decir("yaEstas", { nombre: p.nombre }); return true; }
      ir(p.url, p.nombre); return true;
    }

    let m = t.match(/^(?:ve|ir|vamos|baja|bajar|llevame|muestrame|ensename|salta)\s+(?:a|al|hasta|hacia)\s+(.+)$/);
    if (m) {
      const h = seccionPara(m[1]);
      if (h) { h.scrollIntoView({ behavior: "smooth", block: "start" }); decir("seccion", { nombre: h.innerText.trim() }); return true; }
    }

    m = t.match(/^(?:haz (?:clic|click)|hazle (?:clic|click)|clic|click|cliquea|pulsa|presiona|toca|selecciona|aprieta|activa|marca|dale (?:clic |click )?(?:a|al|en))\s+(?:en\s+|sobre\s+|a\s+|al\s+)?(.+)$/);
    if (m) {
      const r = elementoPara(m[1]);
      if (r && r.puntos >= 0.62) { pulsar(r.el); decir("pulsado", { nombre: etiqueta(r.el) }); return true; }
      decir("noBoton", { nombre: m[1] }); return true;
    }
    return false;
  }

  /** Último recurso: la frase coincide casi exacta con un botón visible. */
  function pulsarSiCoincide(t) {
    const r = elementoPara(t);
    if (r && r.puntos >= 0.84) { pulsar(r.el); decir("pulsado", { nombre: etiqueta(r.el) }); return true; }
    return false;
  }

  return { navegar, pulsarSiCoincide };
}
