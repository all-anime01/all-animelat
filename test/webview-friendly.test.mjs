// Qué servidores debe reproducir la app por su reproductor NATIVO (ExoPlayer) y
// cuáles por el iframe del propio host.
//
// embed69/PelisPlus va por IFRAME: trae su propio reproductor con su lista de
// servidores dentro. Mandarlo al nativo no funciona —el vídeo real está en un
// iframe de otro dominio que el desempaquetado de la app no puede leer— y acaba en
// «no se capturó video en 35s». Si alguien lo vuelve a mover, esta prueba salta.
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
  // traen su propio reproductor (o su stream no lo puede abrir ExoPlayer)
  ["https://www.youtube.com/embed/dQw4w9WgXcQ", IFRAME, "YouTube"],
  ["https://mega.nz/embed/U613TTjT#clave",      IFRAME, "Mega (stream cifrado)"],
  ["https://embed69.org/f/tt30217403-1x01/",    IFRAME, "PelisPlus/embed69 (reproductor propio)"],
  // hosts sueltos: en la WebView salen en negro → reproductor nativo
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
