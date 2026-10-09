# -*- coding: utf-8 -*-
"""¿Es este título otra PARTE de la temporada anterior, o una temporada nueva?

De esto depende que una temporada partida en dos cours quede unida en vez de salir
como dos temporadas. Lo delicado es que los dos casos se parecen muchísimo:

    «Stardust Crusaders - Egypt Hen»  SÍ continúa a «Stardust Crusaders»
    «Tokyo Revengers: Seiya Kessen-hen»  NO continúa a «Tokyo Revengers»

La diferencia es que en el primero, al quitarle el nombre del arco, queda EXACTAMENTE
la temporada anterior. Por eso hace falta siempre la referencia a la anterior.

  python test/partes-temporada.test.py
"""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))
import allanime_importer as A

CASOS = [
    # (titulo, temporada anterior, ¿es continuacion?)
    ("Kusuriya no Hitorigoto 3rd Season Part 2", "Kusuriya no Hitorigoto 3rd Season", True),
    ("Kusuriya no Hitorigoto 2nd Season", "Kusuriya no Hitorigoto", False),
    ("Kusuriya no Hitorigoto 3rd Season", "Kusuriya no Hitorigoto 2nd Season", False),
    # LIMITACIÓN CONOCIDA, a propósito. Este SÍ es el segundo cour de Stardust
    # Crusaders, pero por el nombre es idéntico a «Tokyo Revengers: Seiya Kessen-hen»,
    # que es una temporada de verdad: los dos son «<serie>: <arco>-hen». Se intentó
    # unirlos por el nombre del arco y lo que pasó fue que Tokyo Revengers empezó a
    # fusionar sus temporadas, que es peor. Para estos casos se usa el campo «Nombre
    # temporada» de la aplicación.
    ("JoJo no Kimyou na Bouken: Stardust Crusaders - Egypt Hen",
     "JoJo no Kimyou na Bouken: Stardust Crusaders", False),
    ("JoJo no Kimyou na Bouken: Stone Ocean Part 2",
     "JoJo no Kimyou na Bouken: Stone Ocean", True),
    ("JoJo no Kimyou na Bouken: Steel Ball Run - 2nd & 3rd STAGE",
     "JoJo no Kimyou na Bouken: Steel Ball Run - 1st STAGE", True),
    # los que NO deben unirse: son temporadas de verdad
    ("Tokyo Revengers: Seiya Kessen-hen", "Tokyo Revengers", False),
    ("Tokyo Revengers: Tenjiku-hen", "Tokyo Revengers: Seiya Kessen-hen", False),
    ("Tougen Anki: Nikko・Kegon no Taki-hen", "Tougen Anki", False),
    ("Mushoku Tensei II: Isekai Ittara Honki Dasu", "Mushoku Tensei: Isekai Ittara Honki Dasu", False),
    ("Mushoku Tensei II: Isekai Ittara Honki Dasu Part 2",
     "Mushoku Tensei II: Isekai Ittara Honki Dasu", True),
    ("VINLAND SAGA SEASON 2", "VINLAND SAGA", False),
    ("Dandadan 2nd Season", "Dandadan", False),
    ("Yoroi Shinden Samurai Troopers Part 2", "Yoroi Shinden Samurai Troopers", True),
]

fallos = 0
for titulo, anterior, esperado in CASOS:
    r = A.es_continuacion(titulo, anterior)
    ok = r == esperado
    if not ok:
        fallos += 1
    print("%s %-58s %s" % ("OK " if ok else "MAL", titulo[:58],
                           ("continúa" if r else "temporada nueva")
                           + ("" if ok else "  <-- esperado " + ("continúa" if esperado else "temporada nueva"))))

print("\n%d de %d correctos" % (len(CASOS) - fallos, len(CASOS)))
sys.exit(1 if fallos else 0)
