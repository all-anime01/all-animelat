// Orden del selector de temporadas en la ficha de un anime.
//
// Se extrae la lógica tal cual está en js/main-2025.js y se prueba con casos reales:
// Bleach TYBW (cuya temporada 4 volvía a empezar en 1 y salía la segunda), JoJo,
// One Piece con sus arcos y Link Click con su «Bridon Arc».
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

// Saltos de línea de Windows o no, da igual: se normalizan antes de buscar.
const src = readFileSync(new URL("../js/main-2025.js", import.meta.url), "utf8").split("\r\n").join("\n");
const i = src.indexOf("const desde = new Map();");
const fin = src.indexOf("return orden;", i) + "return orden;".length;
assert.ok(i > 0 && fin > i, "no se encontró la lógica de orden en main-2025.js");
// El bloque termina con un «return orden;»: basta envolverlo en una función.
const ordenarTemporadas = new Function("eps", src.slice(i, fin));

const ep = (season, number) => ({ season, number });
const casos = [
  ["Bleach TYBW: la T4 numerada 1-9 ya no se cuela la segunda",
    [ep("Temporada 1: The Blood Warfare", 1), ep("Temporada 2: The Separation", 14),
     ep("Temporada 3: The Conflict", 27), ep("Temporada 4: The Calamity", 1)],
    ["Temporada 1: The Blood Warfare", "Temporada 2: The Separation",
     "Temporada 3: The Conflict", "Temporada 4: The Calamity"]],
  ["JoJo: por el número de la parte",
    [ep("Parte 2: Battle Tendency", 1), ep("Parte 1: Phantom Blood", 1), ep("Parte 7: Steel Ball Run", 1)],
    ["Parte 1: Phantom Blood", "Parte 2: Battle Tendency", "Parte 7: Steel Ball Run"]],
  ["One Piece: arcos sin número, por el primer episodio (como antes)",
    [ep("Arabasta", 92), ep("East Blue", 1), ep("Entrando al Grand Line", 62)],
    ["East Blue", "Entrando al Grand Line", "Arabasta"]],
  ["Link Click: mezcla con un arco sin número, por el primer episodio (como antes)",
    [ep("Temporada 1", 1), ep("Bridon Arc", 12), ep("Temporada 2", 13), ep("Temporada 3", 25)],
    ["Temporada 1", "Bridon Arc", "Temporada 2", "Temporada 3"]],
  ["Temporada 10 va después de la 9, no después de la 1",
    [ep("Temporada 10", 1), ep("Temporada 9", 1), ep("Temporada 2", 1), ep("Temporada 1", 1)],
    ["Temporada 1", "Temporada 2", "Temporada 9", "Temporada 10"]],
  ["Kimetsu: la película sin número no se cuela delante del Distrito Rojo",
    [ep("Temporada 1", 1), ep("Temporada 2: Mugen Train Arc", 1), ep("Temporada 3: Aldea", 1),
     ep("Temporada 4: Entrenamiento", 1), ep("The Movie: Castillo Infinito", 1), ep("Temporada 2: Arco Distrito Rojo", 8)],
    ["Temporada 1", "Temporada 2: Mugen Train Arc", "Temporada 2: Arco Distrito Rojo",
     "Temporada 3: Aldea", "Temporada 4: Entrenamiento", "The Movie: Castillo Infinito"]],
  ["Kaiju: el especial va al final aunque la T2 empiece en el 0",
    [ep("Temporada 2", 0), ep("Misión de reconocimiento", 1), ep("Temporada 1", 1)],
    ["Temporada 1", "Temporada 2", "Misión de reconocimiento"]],
];

let fallos = 0;
for (const [nombre, eps, esperado] of casos) {
  const r = ordenarTemporadas(eps);
  const ok = JSON.stringify(r) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "OK " : "MAL"} ${nombre}${ok ? "" : `\n     obtenido: ${JSON.stringify(r)}`}`);
}
console.log(`\n${casos.length - fallos} de ${casos.length} correctos`);
assert.equal(fallos, 0, `${fallos} caso(s) mal`);
