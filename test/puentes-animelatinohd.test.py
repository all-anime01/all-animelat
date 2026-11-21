# -*- coding: utf-8 -*-
"""Puentes de animelatinohd («AnimeLatinoHD Gamma/Delta/Epsilon»).

El puente (website.animelatinohd.com/v/…) solo abre con el Referer del propio
sitio y además CADUCA. Guardado tal cual, en el reproductor daba error. Reglas:

  1. Un puente que aún abre se cambia por el servidor real que lleva dentro.
  2. Uno caducado se vuelve a sacar del episodio (slug y nº van en su URL), con
     el MISMO reproductor (Gamma/Delta/Epsilon) y el MISMO idioma.
  3. Lo que no es puente no se toca; no quedan URLs repetidas.
  4. Si no hay forma de arreglarlo y el episodio se quedaría vacío, no se borra.

  python test/puentes-animelatinohd.test.py
"""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))
import allanime_importer as A

fallos = total = 0
def check(cond, texto):
    global fallos, total
    total += 1
    print("%s %s" % ("OK " if cond else "MAL", texto))
    if not cond: fallos += 1

P = "https://website.animelatinohd.com/v/mi-anime-episodio-3/"
VIVO = P + "token-vivo"
CADUCADO = P + "token-caducado"

# Sin red: se simulan el puente y la página del episodio.
A.alhd_real = lambda u, referer=None: "https://byseraguci.com/e/vivo1" if u == VIVO else None
A.nm_por_pagina = lambda u: A.nm(u) if A.nm(u) != "Servidor" else "VOE"
pedidos = []
def players(slug, n):
    pedidos.append((slug, int(n)))
    return [{"url": "https://caseyseemavoid.com/e/lat-g", "name": "VOE", "lang": "Latino", "desc": "", "player": "Gamma"},
            {"url": "https://lplaygo.com/e/lat-e", "name": "Lulustream", "lang": "Latino", "desc": "", "player": "Epsilon"},
            {"url": "https://byseraguci.com/e/sub-d", "name": "Filemoon", "lang": "Sub", "desc": "", "player": "Delta"}]
A.alhd_players = players
A._cache_players.clear()

check(A.es_puente_alhd(VIVO) and not A.es_puente_alhd("https://voe.sx/e/x"), "reconoce los puentes")

r = A.resolver_puentes_alhd([{"url": VIVO, "name": "AnimeLatinoHD Delta", "lang": "Sub", "desc": ""}])
check(r == [{"url": "https://byseraguci.com/e/vivo1", "name": "Filemoon", "lang": "Sub", "desc": ""}],
      "1. puente vivo → servidor real con su nombre")

r = A.resolver_puentes_alhd([{"url": CADUCADO, "name": "AnimeLatinoHD Epsilon", "lang": "Latino", "desc": "Audio Latino"}])
check(r and r[0]["url"] == "https://lplaygo.com/e/lat-e" and r[0]["name"] == "Lulustream",
      "2. caducado → mismo reproductor (Epsilon) del mismo idioma")
check(pedidos == [("mi-anime", 3)], "2. el episodio se saca del slug y nº del puente")
check(r[0]["desc"] == "", "2. se quita la etiqueta «Audio Latino» del puente")

propio = {"url": "https://vidara.to/e/abc", "name": "Vidara", "lang": "Latino"}
r = A.resolver_puentes_alhd([propio,
                             {"url": CADUCADO, "name": "AnimeLatinoHD Gamma", "lang": "Latino"},
                             {"url": CADUCADO + "2", "name": "AnimeLatinoHD Gamma", "lang": "Latino"}])
urls = [x["url"] for x in r]
check(r[0] == propio, "3. lo que no es puente queda igual y en su sitio")
check(len(urls) == len(set(urls)), "3. sin URLs repetidas")
check(not any(A.es_puente_alhd(u) for u in urls), "3. no queda ningún puente")

solo = [{"url": CADUCADO, "name": "AnimeLatinoHD Gamma", "lang": "Castellano"}]
check(A.resolver_puentes_alhd(solo) == solo, "4. sin arreglo posible y sin más servidores: no se vacía")

print("\n%d/%d bien" % (total - fallos, total))
sys.exit(1 if fallos else 0)
