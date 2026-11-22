// Endo entiende qué anime se le pide, tal como lo escribe el reconocedor de voz.
// Usa una muestra del catálogo real (test/fixtures/endo-catalogo.json) con
// títulos que se confunden fácil (Dragon Ball Z/GT/Daima, películas, spin-offs…).
//   node test/endo-catalogo.test.mjs
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { crearBuscador, separar } from "../js/endo-catalogo.js";
import { paginaPedida, temporadaSuelta } from "../js/endo-navegar.js";

const cat = JSON.parse(readFileSync(new URL("./fixtures/endo-catalogo.json", import.meta.url), "utf8"));
const b = crearBuscador(cat);
let mal = 0, total = 0;
const ok = (cond, txt) => { total++; console.log((cond ? "OK  " : "MAL ") + txt); if (!cond) mal++; };

// [lo que se oye, id esperado (null = no debe abrir nada)]
const CASOS = [
  // el caso que reportó el usuario
  ["jujutsu kaisen", "jujutsu-kaisen"], ["yuyutsu kaizen", "jujutsu-kaisen"], ["jiu jitsu kaisen", "jujutsu-kaisen"],
  ["yo yo tsu kaisen", "jujutsu-kaisen"], ["quiero ver jujutsu kaisen", "jujutsu-kaisen"],
  ["jujutsu kaisen en latino por favor", "jujutsu-kaisen"], ["sorcery fight", "jujutsu-kaisen"],
  // relleno y temporada
  ["jujutsu kaisen temporada 2", "jujutsu-kaisen"], ["la segunda temporada de jujutsu kaisen", "jujutsu-kaisen"],
  // pronunciación a la española de títulos en inglés / japonés
  ["wan pis", "one-piece"], ["espai por familia", "spy-x-family"], ["kaiju número ocho", "kaiju-no-8"],
  ["jaikiu", "haikyu"], ["quimetsu no yaiba", "kimetsu-no-yaiba"], ["cheinsou man", "chainsaw-man"],
  ["det not", "death-note"], ["blich", "bleach"], ["wan panch man", "one-punch-man"], ["hunter por hunter", "hunter-x-hunter-2011"],
  ["ataque a los titanes", "shingeki-no-kyojin"], ["boku no hero", "my-hero-academia"], ["mi héroe academia", "my-hero-academia"],
  ["frieren", "frieren-beyond-journeys-end"], ["re zero", "re-zero"], ["dan da dan", "dandadan"], ["bluelock", "blue-lock"],
  // parecidos que NO se deben cruzar
  ["dragon ball z", "dragon-ball-z"], ["dragon ball gt", "dragon-ball-gt"], ["dragon ball super", "dragon-ball-super"],
  ["dragon ball daima", "dragon-ball-daima"], ["dragon ball", "dragon-ball"], ["dragon ball la película", "dragon-ball-peliculas"],
  ["haikyu", "haikyu"], ["my hero academia vigilantes", "my-hero-academia-vigilantes"],
  // órdenes que NO son un anime
  ["temporada 2", null], ["pausa", null], ["explorar", null], ["añadir a mi lista", null], ["avísame", null],
  ["compartir", null], ["hola", null], ["la película", null],
];
for (const [q, id] of CASOS) {
  const r = b.buscar(q);
  const got = r ? r.anime.id : null;
  ok(got === id, `«${q}» → ${got || "nada"}${got === id ? "" : "  (esperado: " + (id || "nada") + ")"}`);
}

const s = separar("la segunda temporada de jujutsu kaisen en latino");
ok(s.texto === "jujutsu kaisen" && s.temporada === 2, "separa la temporada y el relleno");
ok(separar("jujutsu kaisen la película").pelicula === true, "detecta que pide la película");

// Rapidez: una frase normal debe resolverse al instante.
const t0 = Date.now(); for (let i = 0; i < 20; i++) b.buscar("jujutsu kaisen");
ok((Date.now() - t0) / 20 < 60, "una consulta normal tarda menos de 60 ms");

// Navegación (funciones puras)
ok(paginaPedida("llevame al calendario")?.url === "calendario-de-estrenos.html", "«llévame al calendario»");
ok(paginaPedida("mi lista")?.url === "mis-favoritos.html", "«mi lista»");
ok(paginaPedida("vuelve al inicio")?.url === "index.html", "«vuelve al inicio» va al inicio, no atrás");
ok(paginaPedida("abre jujutsu kaisen") === null, "«abre jujutsu kaisen» no es una página");
ok(paginaPedida("terminos y condiciones")?.url === "condiciones-de-uso.html", "«términos y condiciones»");
ok(temporadaSuelta("temporada 2") === 2 && temporadaSuelta("la tercera temporada") === 3, "temporada suelta en número o en letra");
ok(temporadaSuelta("pon jujutsu kaisen temporada 2") === null, "con un anime delante no es solo cambiar de temporada");

console.log(`\n${total - mal}/${total} bien`);
assert.equal(mal, 0);
