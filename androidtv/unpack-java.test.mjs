// Comprueba que el JavaScript INCRUSTADO en MainActivity.java (la constante
// UNPACK_JS) funciona de verdad: se saca del .java, se le aplica el desescapado
// de los bloques de texto de Java y se ejecuta contra páginas reales de los hosts.
// Así no hay que creerse el escapado: se prueba.
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const java = readFileSync(new URL("./app/src/main/java/net/allanime/tv/MainActivity.java", import.meta.url), "utf8");
const m = java.match(/private static final String UNPACK_JS = """\r?\n([\s\S]*?)\r?\n\s*""";/);
assert.ok(m, "no se encontró la constante UNPACK_JS en MainActivity.java");

// Desescapado de un bloque de texto de Java: \\ → \, \" → ", \n → salto.
const js = m[1]
  .replace(/\\\\/g, "\u0000")
  .replace(/\\"/g, '"')
  .replace(/\\n/g, "\n")
  .replace(/\u0000/g, "\\");

const casos = [
  ["StreamWish", new URL("./fixtures/streamwish.html", import.meta.url), "cdn-centaurus.com"],
  ["VidHide", new URL("./fixtures/vidhide.html", import.meta.url), "acek-cdn.com"],
];

let fallos = 0;
for (const [nombre, ruta, dominio] of casos) {
  if (!existsSync(ruta)) { console.log(`— ${nombre}: sin copia de prueba, se salta`); continue; }
  const html = readFileSync(ruta, "utf8");
  // Se ejecuta EXACTAMENTE el mismo código que corre en la WebView de la tele,
  // con un document falso que solo expone el innerHTML.
  let url = "";
  try {
    const fn = new Function("document", "var url='';" + js + "return url;");
    url = fn({ documentElement: { innerHTML: html } });
  } catch (e) {
    console.log(`  MAL ${nombre}: el JS incrustado no es válido → ${e.message}`);
    fallos++;
    continue;
  }
  const ok = typeof url === "string" && url.includes(".m3u8") && url.includes(dominio);
  console.log(`  ${ok ? "OK " : "MAL"} ${nombre.padEnd(11)} → ${String(url).slice(0, 74) || "(no encontró nada)"}`);
  if (!ok) fallos++;
}
console.log(fallos === 0 ? "\nel JS que corre en la app extrae el enlace correctamente" : `\n${fallos} fallo(s)`);
assert.equal(fallos, 0, `${fallos} comprobación(es) mal`);
