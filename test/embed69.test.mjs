// Prueba el descifrado de PelisPlus (embed69) contra una página REAL, bajada en
// el momento por el mismo Worker que usa el sitio. Si embed69 cambia su cifrado,
// esta prueba lo dice antes de que lo noten los usuarios.
import { strict as assert } from "node:assert";
import { enlacesDeEmbed69, mejorEnlace } from "../js/embed69.js";

const WK = "https://allanime-scraper.all-anime-lat01.workers.dev";
const PAGINA = process.argv[2] || "https://embed69.org/f/tt0985344-1x02/";   // Claymore E2

const traerHtml = async (url) => {
  const r = await fetch(`${WK}/fetch?url=${encodeURIComponent(url)}&ref=${encodeURIComponent("https://pelisplushd.bz/")}`);
  const j = await r.json();
  return j.html || "";
};

console.log("página:", PAGINA);
const t0 = Date.now();
const enlaces = await enlacesDeEmbed69(PAGINA, traerHtml);
console.log(`descifrados ${enlaces.length} enlace(s) en ${Date.now() - t0} ms`);
for (const e of enlaces) console.log(`   ${e.lang.padEnd(4)} ${e.servername.padEnd(12)} ${e.url}`);

assert.ok(enlaces.length > 0, "no se descifró ningún enlace");
assert.ok(enlaces.every((e) => /^https?:\/\/\S+$/.test(e.url)), "algún enlace no es una URL");

const elegido = mejorEnlace(enlaces, "Latino");
console.log("\nel que usaría la app:", elegido && `${elegido.servername} → ${elegido.url}`);
assert.ok(elegido, "no se eligió ningún enlace");
assert.ok(!/voe\./i.test(elegido.url) || enlaces.length === 1,
  "no debería elegir VOE habiendo alternativas: en la app se queda en negro");
console.log("\ncorrecto");
