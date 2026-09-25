// Qué servidores debe reproducir la app por su reproductor NATIVO (ExoPlayer) y
// cuáles por el iframe del propio host.
//
// embed69/PelisPlus iba por iframe porque «tenía su propio reproductor». Ya no:
// su página es un iframe vacío que descifra los enlaces con AES en el navegador y
// carga dentro rapidvideo/streamwish/vidhide/voe. En la WebView de Fire TV eso sale
// en NEGRO y con la publicidad del host anidado, así que tiene que ir por el nativo.
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const src = readFileSync(new URL("../js/iframe.js", import.meta.url), "utf8");
const trozo = (nombre) => {
  const i = src.indexOf(`function ${nombre}(`);
  if (i < 0) throw new Error(`no existe la función ${nombre}() en js/iframe.js`);
  let n = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") n++;
    else if (src[k] === "}" && --n === 0) return src.slice(i, k + 1);
  }
  throw new Error(`no se pudo leer ${nombre}()`);
};
const aaWebViewFriendly = new Function(
  trozo("ytIdFrom") + "\n" + trozo("aaWebViewFriendly") + "\nreturn aaWebViewFriendly;")();

const NATIVO = false, IFRAME = true;
const casos = [
  // el host trae su propio reproductor que la WebView sí pinta
  ["https://www.youtube.com/embed/dQw4w9WgXcQ", IFRAME, "YouTube"],
  ["https://mega.nz/embed/U613TTjT#clave",      IFRAME, "Mega (stream cifrado)"],
  // envoltorios y hosts que en la WebView salen en negro → reproductor nativo
  ["https://embed69.org/f/tt30217403-1x01/",    NATIVO, "PelisPlus/embed69"],
  ["https://streamwish.to/e/vysqglqm0v75",      NATIVO, "Streamwish"],
  ["https://voe.sx/e/gttvorne3gac",             NATIVO, "VOE"],
  ["https://filelions.top/v/drtukxcekfja",      NATIVO, "VidHide"],
  ["https://luluvdo.com/e/sqi970lhnu3u",        NATIVO, "Lulustream"],
];
let fallos = 0;
for (const [url, esperado, nombre] of casos) {
  const r = aaWebViewFriendly(url);
  const ok = r === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "OK " : "MAL"} ${nombre.padEnd(24)} → ${r ? "iframe" : "nativo"} (esperado ${esperado ? "iframe" : "nativo"})`);
}
console.log(`\n${casos.length - fallos} de ${casos.length} correctos`);
assert.equal(fallos, 0, `${fallos} caso(s) mal`);
