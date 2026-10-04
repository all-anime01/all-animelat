# -*- coding: utf-8 -*-
"""A qué temporada va un episodio nuevo al ACTUALIZAR un anime que ya existe.

Hay tres reglas y el ORDEN importa. Se comprobó por las malas: la comprobación de
"esta temporada no existe" estaba después de la de numeración continua, y por eso
un anime guardado en UNA sola temporada se tragaba la segunda (Black Clover,
Sentenced to Be a Hero). Esta prueba fija el orden correcto.

  python test/temporada-nueva.test.py
"""
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))


def destino_de(built_season, built_num, existentes, default_season=None, cerradas=(), built_seasons_n=1):
    """Copia EXACTA de la decisión que toma save() en allanime_importer.py.
    Devuelve (temporada, numero): el numero tambien cambia cuando el anime numera
    de corrido entre temporadas. `existentes` es la lista de (temporada, numero)."""
    groups, by_num, vistos = [], {}, {}
    per_season_existing = False
    for s, n in existentes:
        if s not in groups:
            groups.append(s)
        vistos[n] = vistos.get(n, 0) + 1
        if vistos[n] > 1:
            per_season_existing = True
        by_num.setdefault(n, s)
    cerradas = [str(x) for x in cerradas]
    abiertos = [g for g in groups if g not in cerradas] or groups
    destino = str(default_season).strip() if default_season else None
    last_group = (destino if destino in groups else None) or (abiertos[-1] if abiertos else None)

    # ¿numera de corrido entre temporadas? (Ranma: T1 1-12, T2 13-24)
    continua = (not per_season_existing) and len(groups) > 1
    inicio_grupo, tope_global = {}, 0
    if continua:
        for s_, n_ in existentes:
            inicio_grupo[s_] = min(inicio_grupo.get(s_, n_), n_)
            tope_global = max(tope_global, n_)

    m = re.match(r"^Temporada\s+(\d+)$", str(built_season))
    if not m:
        return built_season, built_num     # nombre propio: se respeta tal cual
    idx_s = int(m.group(1))

    if destino and built_seasons_n <= 1:
        return destino, built_num
    if idx_s > len(abiertos):              # temporada NUEVA: se crea
        return built_season, (tope_global + built_num if continua else built_num)
    if built_seasons_n <= 1 and not per_season_existing:
        return (by_num.get(built_num) or last_group), built_num
    g = abiertos[idx_s - 1] if 1 <= idx_s <= len(abiertos) else last_group
    if continua and g in inicio_grupo:
        return g, inicio_grupo[g] + built_num - 1
    return g, built_num


T1 = [("Temporada 1", n) for n in range(1, 13)]
CASOS = [
    ("Black Clover: estrena T2 y el anime solo tiene T1",
     dict(built_season="Temporada 2", built_num=1, existentes=[("Temporada 1", n) for n in range(1, 172)]),
     "Temporada 2"),
    ("Sentenced to Be a Hero: estrena T2, numeración sin repetidos",
     dict(built_season="Temporada 2", built_num=1, existentes=T1),
     "Temporada 2"),
    ("Classroom of the Elite: estrena T5 teniendo 4",
     dict(built_season="Temporada 5", built_num=1,
          existentes=[("Temporada %d" % s, n) for s in range(1, 5) for n in range(1, 13)]),
     "Temporada 5"),
    ("Link Click: tiene temporada destino declarada, manda ella",
     dict(built_season="Temporada 2", built_num=1,
          existentes=[("Temporada 1", 1), ("Bridon Arc", 1)], default_season="Temporada 3"),
     "Temporada 3"),
    ("One Piece: numeración continua, el episodio dice su arco",
     dict(built_season="Temporada 1", built_num=5,
          existentes=[("East Blue", 5), ("Arabasta", 100)]),
     "East Blue"),
    ("One Piece: episodio nuevo sin arco conocido va al último",
     dict(built_season="Temporada 1", built_num=999,
          existentes=[("East Blue", 5), ("Arabasta", 100)]),
     "Arabasta"),
    ("Temporada que YA existe: se mapea por posición, no se duplica",
     dict(built_season="Temporada 2", built_num=3,
          existentes=[("Temporada 1", 1), ("Temporada 2", 1)], built_seasons_n=2),
     "Temporada 2"),
    ("Nombre propio del usuario: se respeta sin tocarlo",
     dict(built_season="OVAs", built_num=1, existentes=T1),
     "OVAs"),
    ("Ranma: numera de corrido, T2 ep1 es en realidad el 13",
     dict(built_season="Temporada 2", built_num=1,
          existentes=[("Temporada 1", n) for n in range(1, 13)] + [("Temporada 2", n) for n in range(13, 25)],
          built_seasons_n=3),
     ("Temporada 2", 13)),
    ("Ranma: su temporada 3 nueva sigue desde el 24, no vuelve al 1",
     dict(built_season="Temporada 3", built_num=1,
          existentes=[("Temporada 1", n) for n in range(1, 13)] + [("Temporada 2", n) for n in range(13, 25)],
          built_seasons_n=3),
     ("Temporada 3", 25)),
    ("Numeración por temporada: NO se toca el número",
     dict(built_season="Temporada 2", built_num=3,
          existentes=[("Temporada 1", n) for n in range(1, 13)] + [("Temporada 2", n) for n in range(1, 13)],
          built_seasons_n=2),
     ("Temporada 2", 3)),
    ("Temporada cerrada: no cuenta como hueco donde meter lo nuevo",
     dict(built_season="Temporada 2", built_num=1,
          existentes=[("Temporada 1", 1), ("Bridon Arc", 1)], cerradas=["Bridon Arc"]),
     "Temporada 2"),
]

fallos = 0
for nombre, kw, esperado in CASOS:
    r = destino_de(**kw)
    if not isinstance(esperado, tuple):
        esperado = (esperado, kw["built_num"])
    ok = r == esperado
    if not ok:
        fallos += 1
    print("%s %-56s -> %-26s (esperado %s)" % ("OK " if ok else "MAL", nombre[:56], "%s ep %s" % r, "%s ep %s" % esperado))

print("\n%d de %d correctos" % (len(CASOS) - fallos, len(CASOS)))
sys.exit(1 if fallos else 0)
