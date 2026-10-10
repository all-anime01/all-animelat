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
check(any("nuevo.com" in u for u in urls1), "al episodio 1 se le SUMÓ el servidor nuevo")
check(all("_sidx" not in e for e in eps), "el dato interno _sidx no se guarda")

print("\n%d de 7 correctos" % (7 - fallos))
sys.exit(1 if fallos else 0)
