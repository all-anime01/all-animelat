// Prueba del desempaquetador contra el HTML REAL de StreamWish y VidHide.
// Guarda las páginas con scratchpad/guarda_html.py y pásalas por argumento, o
// deja que use las copias de prueba de androidtv/fixtures/.
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";
import { aaDesempaqueta, aaEnlaceDeVideo } from "./extract-unpack.js";

const casos = [
  ["StreamWish", new URL("./fixtures/streamwish.html", import.meta.url), "cdn-centaurus.com"],
  ["VidHide", new URL("./fixtures/vidhide.html", import.meta.url), "acek-cdn.com"],
];

let fallos = 0;
for (const [nombre, ruta, dominioEsperado] of casos) {
  if (!existsSync(ruta)) { console.log(`— ${nombre}: sin copia de prueba, se salta`); continue; }
  const html = readFileSync(ruta, "utf8");

  // 1. el enlace NO puede estar en el HTML tal cual (por eso hacía falta esto)
  const enElHtml = /https?:\/\/[^"'\s\\]+\.m3u8/.test(html);
  console.log(`${nombre}: ¿m3u8 visible en el HTML? ${enElHtml ? "sí" : "no"}`);

  // 2. desempaquetado
  const js = aaDesempaqueta(html);
  const ok1 = js.length > 1000;
  console.log(`  ${ok1 ? "OK " : "MAL"} desempaqueta (${js.length} bytes)`);
  if (!ok1) fallos++;

  // 3. sale el enlace, y del dominio que toca
  const url = aaEnlaceDeVideo(html);
  const ok2 = url.includes(".m3u8") && url.includes(dominioEsperado);
  console.log(`  ${ok2 ? "OK " : "MAL"} enlace → ${url.slice(0, 78) || "(ninguno)"}`);
  if (!ok2) fallos++;
}
console.log(fallos === 0 ? "\ntodo correcto" : `\n${fallos} fallo(s)`);
assert.equal(fallos, 0, `${fallos} comprobación(es) mal`);
