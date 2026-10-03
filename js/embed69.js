// ============================================================================
//  PelisPlus (embed69) — sacar el enlace REAL del host
//
//  La página de embed69 ya no trae reproductor propio: guarda los enlaces de los
//  hosts (vidhide, streamwish, voe, rapidvideo) CIFRADOS, y para obtener la clave
//  hay que resolver una prueba de trabajo:
//
//      nonce tal que SHA-256(challenge + nonce) empiece por '0' * dificultad
//      clave  = SHA-256(challenge + nonce + salt)
//      enlace = AES-CBC, con los 16 primeros bytes del base64 como IV
//
//  Con dificultad 3 son unos 4.000 intentos: instantáneo.
//
//  PARA QUÉ: en la app de Fire TV, cargar la página de embed69 en un iframe acaba
//  mostrando el reproductor del host anidado — publicidad del QR y pantalla en
//  negro. Resolviendo el enlace aquí se le puede pasar DIRECTAMENTE al reproductor
//  nativo, que lo extrae en la propia tele. Sin publicidad y sin pantalla negra.
//
//  Importante: el enlace que sale de aquí (p. ej. morencius.com/embed/xxx) es una
//  página normal, SIN token atado a ninguna IP; el token del vídeo lo genera
//  después la tele al extraerlo. Por eso esto se puede resolver desde donde sea.
// ============================================================================

/** Resuelve la prueba de trabajo y devuelve la clave AES (32 bytes). */
export async function resolverPow(challenge, dificultad, salt) {
  const objetivo = "0".repeat(Number(dificultad) || 1);
  const enc = new TextEncoder();
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  for (let nonce = 0; nonce < 5_000_000; nonce++) {
    const h = hex(await crypto.subtle.digest("SHA-256", enc.encode(challenge + nonce)));
    if (h.startsWith(objetivo)) {
      return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(challenge + nonce + salt)));
    }
  }
  throw new Error("prueba de trabajo sin solución");
}

/** Descifra un enlace (base64 con el IV delante) con la clave de la prueba. */
export async function descifrarEnlace(b64, clave) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", clave.slice(0, 32), { name: "AES-CBC" }, false, ["decrypt"]);
  const claro = await crypto.subtle.decrypt({ name: "AES-CBC", iv: raw.slice(0, 16) }, key, raw.slice(16));
  return new TextDecoder().decode(claro);
}

/**
 * De la página de embed69 saca sus enlaces reales:
 *   [{ lang: "LAT", servername: "vidhide", url: "https://…" }, …]
 * `traerHtml` recibe la URL y devuelve el HTML (va por el Worker, por el CORS).
 */
export async function enlacesDeEmbed69(url, traerHtml) {
  const html = await traerHtml(url);
  if (!html) return [];
  const ch = html.match(/POW_CHALLENGE\s*=\s*'([^']+)'/);
  const di = html.match(/POW_DIFFICULTY\s*=\s*(\d+)/);
  const sa = html.match(/POW_SALT\s*=\s*'([^']+)'/);
  const dl = html.match(/dataLink\s*=\s*(\[[\s\S]*?\]);/);
  if (!ch || !di || !sa || !dl) return [];
  let datos;
  try { datos = JSON.parse(dl[1]); } catch { return []; }
  const clave = await resolverPow(ch[1], di[1], sa[1]);
  const out = [];
  for (const grupo of datos) {
    for (const emb of (grupo.sortedEmbeds || [])) {
      try {
        const real = await descifrarEnlace(emb.link, clave);
        if (/^https?:\/\//.test(real)) {
          out.push({ lang: String(grupo.video_language || "").toUpperCase(),
                     servername: String(emb.servername || ""), url: real });
        }
      } catch { /* un enlace que no descifra no tumba al resto */ }
    }
  }
  return out;
}

// En la WebView de la app, VOE se queda en negro y rapidvideo no suelta un .m3u8
// directo; se dejan para el final por si no hay nada mejor.
const ORDEN = ["vidhide", "streamwish", "filemoon", "lulustream", "rapidvideo", "voe"];

/** El mejor enlace para la app: del idioma pedido y del host que mejor funciona. */
export function mejorEnlace(enlaces, idioma) {
  const quiere = String(idioma || "").toLowerCase().includes("lat") ? "LAT" : null;
  const puntua = (e) => {
    const i = ORDEN.findIndex((h) => e.servername.toLowerCase().includes(h));
    return (i < 0 ? ORDEN.length : i) + (quiere && e.lang !== quiere ? 100 : 0);
  };
  const ok = [...enlaces].sort((a, b) => puntua(a) - puntua(b));
  return ok.length ? ok[0] : null;
}
