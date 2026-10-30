# -*- coding: utf-8 -*-
"""Re-scrapear un anime cuya estructura de temporadas NO coincide con la del scrapeo
no debe duplicarlo.

El caso real: JoJo está guardado en 7 partes («Parte 1: Phantom Blood»…) y TMDB lo
da en 6 temporadas con otros nombres, además partidas por otro sitio (su temporada 1
son las partes 1 y 2 juntas). Al scrapearlo, las 6 entraron como temporadas NUEVAS y
el anime pasó de 193 episodios a 369.

Ahora, cuando los nombres no cuadran, solo se tocan los episodios que ya existen
—para sumarles servidores— y no se crea ninguna temporada ni ningún episodio.

  python test/estructura-distinta.test.py
"""
import sys, os, io, copy
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))
import allanime_importer as A

# Lo guardado: 2 partes, como JoJo las tiene (Phantom Blood 1-3, Battle Tendency 1-2)
EXISTENTE = {"id": "jojo", "title": "JoJo", "episodes": [
    {"number": 1, "season": "Parte 1: Phantom Blood", "language": "Latino",
     "servers": [{"url": "https://mega.nz/embed/A", "name": "Mega", "lang": "Latino"}]},
    {"number": 2, "season": "Parte 1: Phantom Blood", "language": "Latino",
     "servers": [{"url": "https://mega.nz/embed/B", "name": "Mega", "lang": "Latino"}]},
    {"number": 3, "season": "Parte 1: Phantom Blood", "language": "Latino",
     "servers": [{"url": "https://mega.nz/embed/C", "name": "Mega", "lang": "Latino"}]},
    {"number": 1, "season": "Parte 2: Battle Tendency", "language": "Latino",
     "servers": [{"url": "https://mega.nz/embed/D", "name": "Mega", "lang": "Latino"}]},
    {"number": 2, "season": "Parte 2: Battle Tendency", "language": "Latino",
     "servers": [{"url": "https://mega.nz/embed/E", "name": "Mega", "lang": "Latino"}]},
]}
# Lo que trae TMDB: UNA temporada con las dos partes seguidas (1-5), con otro nombre
CONSTRUIDO = [
    {"_sidx": 1, "number": n, "season": "Sangre Fantasma & Tendencia de batalla",
     "language": "Sub", "servers": [{"url": "https://nuevo.com/e/%d" % n, "name": "Filemoon", "lang": "Sub"}]}
    for n in range(1, 6)
]

A.get_doc = lambda *a, **k: copy.deepcopy(EXISTENTE)
A.get_chunked_episodes = lambda aid, d, tok=None: d.get("episodes") or []
A.backup_doc = lambda *a, **k: None
guardado = {}
A.save_big_doc = lambda aid, doc, eps, tok, log=None: (guardado.update(eps=eps) or (True, ""))
A.upsert_card = lambda *a, **k: True

data = {"aid": "jojo", "real_title": "JoJo", "episodes": copy.deepcopy(CONSTRUIDO),
        "info": {"year": 2012, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": ""},
        "audio": "Latino", "seasons": [{"season": 1, "count": 5}], "_update_only": True}
A.save(data, "tok", False, lambda m: print("   " + str(m)))

eps = guardado.get("eps", [])
temporadas = {str(e["season"]) for e in eps}
fallos = 0


def check(cond, texto):
    global fallos
    print("%s %s" % ("OK " if cond else "MAL", texto))
    if not cond:
        fallos += 1


check(len(eps) == 5, "siguen siendo 5 episodios, no 10 (no se duplicó)")
check(temporadas == {"Parte 1: Phantom Blood", "Parte 2: Battle Tendency"},
      "no se creó ninguna temporada nueva: %s" % sorted(temporadas))
check(not any("Sangre Fantasma" in t for t in temporadas),
      "la temporada de TMDB no entró como temporada aparte")
p1 = [e for e in eps if e["season"] == "Parte 1: Phantom Blood"]
check(len(p1) == 3, "la Parte 1 sigue con sus 3 episodios")
urls1 = [s["url"] for s in p1[0]["servers"]]
check("https://mega.nz/embed/A" in urls1, "el servidor que ya estaba sigue ahí")
check(not any("nuevo.com" in u for u in urls1),
      "y como no se sabe a qué parte va el bloque de TMDB, no se le mete nada (antes iba por posición)")
check(all("_sidx" not in e for e in eps), "el dato interno _sidx no se guarda")


# --- Emparejado por NOMBRE (títulos de AniList): JoJo real
# Las 7 partes, como están guardadas (las que no importan aquí, con 2 episodios).
OTRAS = ["Parte 1: Phantom Blood", "Parte 2: Battle Tendency", "Parte 4: Diamond is Unbreakable",
         "Parte 5: Golden Wind", "Parte 6: Stone Ocean"]
EXISTENTE = {"id": "jojo", "title": "JoJo", "episodes":
    [{"number": n, "season": g, "language": "Latino",
      "servers": [{"url": "https://mega.nz/embed/%s%d" % (g[:7], n), "name": "Mega", "lang": "Latino"}]}
     for g in OTRAS for n in (1, 2)] +
    [{"number": n, "season": "Parte 3: Stardust Crusaders", "language": "Latino",
      "servers": [{"url": "https://mega.nz/embed/sc%d" % n, "name": "Mega", "lang": "Latino"}]} for n in range(1, 49)] +
    [{"number": n, "season": "Parte 7: Steel Ball Run", "language": "Latino",
      "servers": [{"url": "https://mega.nz/embed/sbr%d" % n, "name": "Mega", "lang": "Latino"}]} for n in range(1, 5)]}


def T(sidx, tit, nombre, ns):
    return [{"_sidx": sidx, "_stit": tit, "number": n, "season": nombre, "language": "Sub",
             "servers": [{"url": "https://nuevo.com/%d/%d" % (sidx, n), "name": "Filemoon", "lang": "Sub"}]} for n in ns]


CONSTRUIDO = (T(1, "JoJo no Kimyou na Bouken (TV) | JoJo's Bizarre Adventure (2012)",
                "Sangre Fantasma & Tendencia de batalla", range(1, 27))
              + T(2, "JoJo no Kimyou na Bouken: Stardust Crusaders | JoJo's Bizarre Adventure: Stardust Crusaders",
                  "Stardust Crusaders", range(1, 25))
              + T(3, "JoJo no Kimyou na Bouken: Stardust Crusaders - Egypt-hen | "
                     "JoJo's Bizarre Adventure: Stardust Crusaders - Battle in Egypt", "Diamond Is Unbreakable", range(1, 25))
              + T(4, "JoJo no Kimyou na Bouken: Steel Ball Run - 1st STAGE | "
                     "JoJo no Kimyou na Bouken: Steel Ball Run - 2nd & 3rd STAGE", "Temporada 8", range(1, 7)))
guardado.clear()
data = {"aid": "jojo", "real_title": "JoJo's Bizarre Adventure", "episodes": copy.deepcopy(CONSTRUIDO),
        "info": {"year": 2012, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": ""},
        "audio": "Latino", "seasons": [{"season": 1, "count": 5}], "_update_only": True}
A.save(data, "tok", False, lambda m: print("   " + str(m)))
eps = guardado.get("eps", [])
sbr = sorted(e["number"] for e in eps if e["season"] == "Parte 7: Steel Ball Run")
check(sbr == [1, 2, 3, 4, 5, 6], "Steel Ball Run: entran los episodios 5 y 6 nuevos en su parte (%s)" % sbr)
check({str(e["season"]) for e in eps} == set(OTRAS) | {"Parte 3: Stardust Crusaders", "Parte 7: Steel Ball Run"},
      "no se crea ninguna temporada (ni «Temporada 8» ni la de TMDB)")
sc = {e["number"]: e for e in eps if e["season"] == "Parte 3: Stardust Crusaders"}
check(len(sc) == 48, "Stardust Crusaders sigue con 48")
check(any(x["url"].endswith("/3/1") for x in sc[25]["servers"]),
      "el ep 1 de Egypt-hen va al 25 de Stardust Crusaders (sigue la numeración)")
check(not any(x["url"].endswith("/3/1") for x in sc[1]["servers"]), "y no al 1")
check(all(not k.startswith("_") for e in eps for k in e), "ningún dato interno se guarda")


# --- Avatar: Los Siete Refugios. Guardado como «Temporada 1» (6 eps); TMDB la llama
# «Libro 1: Supervivencia» y ya hay 12. Los nuevos deben entrar en la Temporada 1.
EXISTENTE = {"id": "avatar", "title": "Avatar", "episodes": [
    {"number": n, "season": "Temporada 1", "language": "Latino",
     "servers": [{"url": "https://embed69.org/f/tt35854736-1x%02d/" % n, "name": "PelisPlus", "lang": "Latino"}]}
    for n in range(1, 7)]}
guardado.clear()
data = {"aid": "avatar", "real_title": "Avatar: Los Siete Refugios",
        "episodes": [{"_sidx": 1, "_stit": "Avatar: Seven Havens", "number": n, "season": "Libro 1: Supervivencia",
                      "language": "Latino",
                      "servers": [{"url": "https://embed69.org/f/tt35854736-1x%02d/" % n, "name": "PelisPlus",
                                   "lang": "Latino"}]} for n in range(1, 13)],
        "info": {"year": 2026, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": ""},
        "audio": "Latino", "seasons": [{"season": 1, "count": 12}], "_update_only": True}
A.save(data, "tok", False, lambda m: print("   " + str(m)))
eps = guardado.get("eps", [])
check(sorted(e["number"] for e in eps if e["season"] == "Temporada 1") == list(range(1, 13)),
      "Avatar: entran los episodios 7-12 en la «Temporada 1»")
check({e["season"] for e in eps} == {"Temporada 1"}, "y no se crea «Libro 1: Supervivencia»")

print("\n%d de %d correctos" % (15 - fallos, 15))
sys.exit(1 if fallos else 0)
