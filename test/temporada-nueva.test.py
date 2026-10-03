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
    `existentes` es la lista de (temporada, numero) que ya hay guardados."""
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

    m = re.match(r"^Temporada\s+(\d+)$", str(built_season))
    if not m:
        return built_season            # nombre propio: se respeta tal cual
    idx_s = int(m.group(1))

    if destino and built_seasons_n <= 1:
        return destino
    if idx_s > len(abiertos):
        return built_season            # temporada NUEVA: se crea
    if built_seasons_n <= 1 and not per_season_existing:
        return by_num.get(built_num) or last_group
    return abiertos[idx_s - 1] if 1 <= idx_s <= len(abiertos) else last_group


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
    ("Temporada cerrada: no cuenta como hueco donde meter lo nuevo",
     dict(built_season="Temporada 2", built_num=1,
          existentes=[("Temporada 1", 1), ("Bridon Arc", 1)], cerradas=["Bridon Arc"]),
     "Temporada 2"),
]

fallos = 0
for nombre, kw, esperado in CASOS:
    r = destino_de(**kw)
    ok = r == esperado
    if not ok:
        fallos += 1
    print("%s %-56s -> %-14s (esperado %s)" % ("OK " if ok else "MAL", nombre[:56], r, esperado))

print("\n%d de %d correctos" % (len(CASOS) - fallos, len(CASOS)))
sys.exit(1 if fallos else 0)
