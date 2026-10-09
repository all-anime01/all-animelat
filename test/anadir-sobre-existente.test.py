# -*- coding: utf-8 -*-
"""Comprueba, SIN tocar Firestore, que al añadir episodios sobre un anime que ya
existe: (a) los servidores nuevos se suman a los episodios que ya estaban, y
(b) no se pierde ni se reordena ninguno de los que habia."""
import sys, io, copy
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import allanime_importer as A

# Se simula el guardado sin red: se le da a save() un "existente" de mentira.
EXISTENTE = {
    "id": "prueba", "title": "Prueba", "episodes": [
        {"number": 1, "season": "Temporada 1", "title": "Uno", "language": "Sub",
         "servers": [{"url": "https://mega.nz/embed/AAA", "name": "Mega", "lang": "Sub"},
                     {"url": "https://sfastwish.com/e/BBB", "name": "Streamwish", "lang": "Sub"}]},
        {"number": 2, "season": "Temporada 1", "title": "Dos", "language": "Sub",
         "servers": [{"url": "https://mega.nz/embed/CCC", "name": "Mega", "lang": "Sub"}]},
    ]}
CONSTRUIDO = [
    # el 1 ya existe: debe SUMARSE el Latino sin tocar los dos que tenia
    {"number": 1, "season": "Temporada 1", "title": "Uno", "language": "Latino",
     "servers": [{"url": "https://embed69.org/f/x-1x01/", "name": "PelisPlus", "lang": "Latino"},
                 {"url": "https://mega.nz/embed/AAA", "name": "Mega", "lang": "Sub"}]},
    # el 3 es nuevo: entra entero
    {"number": 3, "season": "Temporada 1", "title": "Tres", "language": "Latino",
     "servers": [{"url": "https://embed69.org/f/x-1x03/", "name": "PelisPlus", "lang": "Latino"}]},
]

A.get_doc = lambda *a, **k: copy.deepcopy(EXISTENTE)
A.get_chunked_episodes = lambda aid, d, tok=None: d.get("episodes") or []
A.backup_doc = lambda *a, **k: None
guardado = {}
def _save_big(aid, doc, eps, tok, log=None):
    guardado["eps"] = eps; return True, ""
A.save_big_doc = _save_big
A.upsert_card = lambda *a, **k: True

data = {"aid": "prueba", "real_title": "Prueba", "episodes": copy.deepcopy(CONSTRUIDO),
        "info": {"year": 2024, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": ""},
        "audio": "Latino", "seasons": [{"season": 1, "count": 3}], "_update_only": True}
A.save(data, "tok", False, lambda m: print("   " + str(m)))

eps = {("%s|%s" % (e["season"], e["number"])): e for e in guardado.get("eps", [])}
fallos = 0
def check(cond, texto):
    global fallos
    print("%s %s" % ("OK " if cond else "MAL", texto))
    if not cond: fallos += 1

e1 = eps.get("Temporada 1|1") or {}
urls1 = [s.get("url") for s in (e1.get("servers") or [])]
check(len(eps) == 3, "quedan 3 episodios (los 2 que habia + el nuevo)")
check("https://mega.nz/embed/AAA" in urls1, "el Mega que ya estaba sigue ahi")
check("https://sfastwish.com/e/BBB" in urls1, "el Streamwish que ya estaba sigue ahi")
check("https://embed69.org/f/x-1x01/" in urls1, "se AÑADIO el PelisPlus en Latino")
check(urls1[:2] == ["https://mega.nz/embed/AAA", "https://sfastwish.com/e/BBB"],
      "los que ya estaban mantienen su orden, lo nuevo va detras")
check(urls1.count("https://mega.nz/embed/AAA") == 1, "no se duplica un servidor que ya estaba")
check(e1.get("language") == "Latino", "el idioma del episodio pasa a Latino")
e2 = eps.get("Temporada 1|2") or {}
check(len(e2.get("servers") or []) == 1, "el episodio 2, que no venia en el scrapeo, queda intacto")
check("Temporada 1|3" in eps, "el episodio nuevo se agrego")
print("\n%d de 9 correctos" % (9 - fallos))
sys.exit(1 if fallos else 0)
