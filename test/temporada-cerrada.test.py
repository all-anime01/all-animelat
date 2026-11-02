# -*- coding: utf-8 -*-
"""Una temporada CERRADA que la fuente cuenta como temporada aparte no debe correr
el reparto de las demás.

El caso real: Link Click tiene «Temporada 1», «Bridon Arc» (cerrada, eps 24-29),
«Temporada 2» y «Temporada 3». AniList lo da como S1, S2, Bridon Arc, S3. Como el arco
está cerrado no entraba en el reparto por posición y la S3 caía en una «Temporada 4»
nueva, duplicando la Temporada 3 entera.

  python test/temporada-cerrada.test.py
"""
import sys, os, io, copy
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))
import allanime_importer as A


def E(season, n, url):
    return {"number": n, "season": season, "language": "Latino",
            "servers": [{"url": url, "name": "Mega", "lang": "Latino"}]}


EXISTENTE = {"id": "link-click", "title": "Link Click", "lockedSeasons": ["Bridon Arc"],
             "defaultSeason": "Temporada 3", "episodes":
                 [E("Temporada 1", n, "https://mega.nz/embed/t1-%d" % n) for n in range(1, 12)]
                 + [E("Bridon Arc", n, "https://mega.nz/embed/br-%d" % n) for n in range(24, 30)]
                 + [E("Temporada 2", n, "https://mega.nz/embed/t2-%d" % n) for n in range(1, 13)]
                 + [E("Temporada 3", n, "https://mega.nz/embed/t3-%d" % n) for n in range(1, 10)]}


def B(sidx, tit, ns):
    return [{"_sidx": sidx, "_stit": tit, "number": n, "season": "Temporada %d" % sidx, "language": "Sub",
             "servers": [{"url": "https://nuevo.com/%d/%d" % (sidx, n), "name": "Filemoon", "lang": "Sub"}]}
            for n in ns]


CONSTRUIDO = (B(1, "Shiguang Dailiren | Link Click", range(1, 12))
              + B(2, "Shiguang Dailiren II | Link Click Season 2", range(1, 13))
              + B(3, "Shiguang Dailiren: Yingdu Pian | Link Click: Bridon Arc", range(1, 7))
              + B(4, "Shiguang Dailiren III Part 1 | Link Click Season 3 Part 1", range(1, 12)))

A.get_doc = lambda *a, **k: copy.deepcopy(EXISTENTE)
A.get_chunked_episodes = lambda aid, d, tok=None: d.get("episodes") or []
A.backup_doc = lambda *a, **k: None
guardado = {}
A.save_big_doc = lambda aid, doc, eps, tok, log=None: (guardado.update(eps=eps) or (True, ""))
A.upsert_card = lambda *a, **k: True

data = {"aid": "link-click", "real_title": "Link Click", "episodes": copy.deepcopy(CONSTRUIDO),
        "info": {"year": 2021, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": ""},
        "audio": "Latino", "seasons": [{"season": 1, "count": 11}], "_update_only": True}
A.save(data, "tok", False, lambda m: print("   " + str(m)))
eps = guardado.get("eps", [])
fallos = total = 0


def check(cond, texto):
    global fallos, total
    total += 1
    print("%s %s" % ("OK " if cond else "MAL", texto))
    if not cond:
        fallos += 1


temps = {}
for e in eps:
    temps.setdefault(e["season"], []).append(e["number"])
check("Temporada 4" not in temps, "no se crea una «Temporada 4» (%s)" % sorted(temps))
check(sorted(temps.get("Temporada 3", [])) == list(range(1, 12)), "la Temporada 3 recibe los eps 10 y 11 nuevos")
check(sorted(temps.get("Bridon Arc", [])) == list(range(24, 30)), "el Bridon Arc sigue con sus 6 (24-29)")
br24 = next(e for e in eps if e["season"] == "Bridon Arc" and e["number"] == 24)
check(any(x["url"] == "https://nuevo.com/3/1" for x in br24["servers"]),
      "el ep 1 del Bridon Arc del scrapeo va a su ep 24")
t3_1 = next(e for e in eps if e["season"] == "Temporada 3" and e["number"] == 1)
check(not any(x["url"].startswith("https://nuevo.com/3/") for x in t3_1["servers"]),
      "y no se mezcla con la Temporada 3")
check(any(x["url"] == "https://nuevo.com/4/1" for x in t3_1["servers"]), "la S3 de AniList va a la Temporada 3")

print("\n%d de %d correctos" % (total - fallos, total))
sys.exit(1 if fallos else 0)
