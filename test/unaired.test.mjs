// El candado de "episodios sin estrenar" NO debe ocultar un episodio que ya tiene
// enlaces. Al scrapear una temporada en emisión, TMDB da fechas que aún no han
// llegado y los episodios recién subidos salían bloqueados (le pasó a Black Clover).
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

// unaired.js importa Firebase por la red, así que se extraen las dos funciones
// puras y se prueban tal cual están escritas en el archivo.
const src = readFileSync(new URL("../js/unaired.js", import.meta.url), "utf8");
const trozo = (nombre) => {
  const i = src.indexOf(`export function ${nombre}(`);
  assert.ok(i >= 0, `no existe ${nombre}() en js/unaired.js`);
  let n = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") n++;
    else if (src[k] === "}" && --n === 0) return src.slice(i, k + 1).replace(/^export /, "");
  }
  throw new Error(`no se pudo leer ${nombre}()`);
};

const MESES_SRC = src.slice(src.indexOf("const MESES"), src.indexOf("};", src.indexOf("const MESES")) + 2);
const TZ_SRC = "const TZ_REF_MIN = -5 * 60;";
const fabrica = new Function(`
  ${MESES_SRC}
  ${TZ_SRC}
  ${trozo("parseReleaseDate")}
  ${trozo("tieneEnlaces")}
  let flags = { lockUnaired: true };
  ${trozo("isUnaired")}
  return { isUnaired, tieneEnlaces, setFlag: (v) => { flags.lockUnaired = v; } };
`);
const { isUnaired, tieneEnlaces, setFlag } = fabrica();

const CON = [{ url: "https://filemoon.sx/e/abc", name: "Filemoon" }];
const SIN = [];
const FUTURO = "Diciembre 31, 2030";
const PASADO = "Enero 10, 2020";

const casos = [
  // [episodio, esperado, por qué]
  [{ releaseDate: FUTURO, servers: CON }, false, "fecha futura pero YA tiene enlaces: se ve (el caso Black Clover)"],
  [{ releaseDate: FUTURO, servers: SIN }, true, "fecha futura y sin enlaces: bloqueado"],
  [{ releaseDate: FUTURO }, true, "fecha futura y sin campo servers: bloqueado"],
  [{ releaseDate: PASADO, servers: SIN }, false, "ya estrenado: nunca se bloquea"],
  [{ releaseDate: PASADO, servers: CON }, false, "ya estrenado y con enlaces"],
  [{ releaseDate: "", servers: SIN }, false, "sin fecha NUNCA se bloquea"],
  [{ releaseDate: FUTURO, servers: [{ url: "", name: "x" }] }, true, "servidor sin URL no cuenta"],
];

let fallos = 0;
for (const [ep, esperado, porque] of casos) {
  const r = isUnaired(ep);
  const ok = r === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "OK " : "MAL"} bloqueado=${String(r).padEnd(5)} (esperado ${esperado}) — ${porque}`);
}

// Con el interruptor apagado nunca se bloquea nada.
setFlag(false);
const apagado = isUnaired({ releaseDate: FUTURO, servers: SIN });
console.log(`${apagado === false ? "OK " : "MAL"} con el interruptor apagado no se bloquea nada`);
if (apagado !== false) fallos++;

console.log(`\n${casos.length + 1 - fallos} de ${casos.length + 1} correctos`);
assert.equal(fallos, 0, `${fallos} caso(s) mal`);
