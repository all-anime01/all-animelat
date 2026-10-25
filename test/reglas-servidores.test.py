# -*- coding: utf-8 -*-
"""Reglas de servidores al añadir episodios sobre lo que ya hay (las del usuario):

  1. Máximo 4 servidores por idioma.
  2. Si el episodio ya tiene Sub Y Latino, no se añade nada: solo se reemplaza el
     servidor que esté roto, por otro del mismo idioma.
  3. Si le falta un idioma, se rellena ese idioma hasta 4.
  4. Nunca repetidos: ni la misma URL ni el mismo host dos veces en un idioma.

  python test/reglas-servidores.test.py
"""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desktop"))
import allanime_importer as A


def S(host, lang, n=1):
    return {"url": "https://%s/e/%d" % (host, n), "name": host.split(".")[0].title(), "lang": lang}


VIVOS = lambda url: True
fallos = total = 0


def check(cond, texto):
    global fallos, total
    total += 1
    print("%s %s" % ("OK " if cond else "MAL", texto))
    if not cond:
        fallos += 1


def cuenta(servs, lang):
    return sum(1 for x in servs if x["lang"] == lang)


# --- Regla 2: ya tiene Sub y Latino → NO se añade nada
act = [S("embed69.org", "Latino"), S("mega.nz", "Latino"), S("voe.sx", "Sub"), S("jkanime.net", "Sub")]
nuevo = [S("filemoon.sx", "Latino"), S("streamwish.to", "Sub"), S("vidhide.com", "Sub")]
r = A.combinar_servidores(act, nuevo, comprobar=VIVOS)
check(r["anadidos"] == 0 and r["repuestos"] == 0 and not r["cambio"],
      "Sub y Latino completos y todos vivos: no se añade nada")
check([x["url"] for x in r["servidores"]] == [x["url"] for x in act], "y no se toca el orden")

# --- Regla 2 con un servidor roto → se reemplaza ESE, por uno del mismo idioma
roto = act[1]["url"]                                        # el Mega latino
r = A.combinar_servidores(act, nuevo, comprobar=lambda u: u != roto)
urls = [x["url"] for x in r["servidores"]]
check(r["repuestos"] == 1 and roto not in urls, "el servidor roto se reemplaza")
check("https://filemoon.sx/e/1" in urls, "por uno nuevo del MISMO idioma (Latino)")
check(urls.index("https://filemoon.sx/e/1") == 1, "en el mismo sitio que ocupaba el roto")
check(r["anadidos"] == 0 and len(urls) == 4, "y no se añade nada más")

# --- Regla 3: le falta el Latino → se rellena hasta 4
act = [S("voe.sx", "Sub"), S("jkanime.net", "Sub")]
nuevo = [S("embed69.org", "Latino", 1), S("filemoon.sx", "Latino", 2), S("mega.nz", "Latino", 3),
         S("streamwish.to", "Latino", 4), S("vidhide.com", "Latino", 5), S("uqload.io", "Latino", 6)]
r = A.combinar_servidores(act, nuevo, comprobar=VIVOS)
check(cuenta(r["servidores"], "Latino") == 4, "falta Latino: se añaden 4, no 6")
check(cuenta(r["servidores"], "Sub") == 2, "el Sub que había se queda igual")
check([x["url"] for x in r["servidores"]][:2] == [x["url"] for x in act], "los que ya estaban, primero y en su orden")

# --- Regla 1: lo que ya se pasaba de 4 se recorta
act = [S("h%d.com" % i, "Sub", i) for i in range(1, 8)]
r = A.combinar_servidores(act, [], comprobar=VIVOS)
check(cuenta(r["servidores"], "Sub") == 4, "un episodio que ya tenía 7 en Sub se queda en 4")

# --- Regla 4: nunca repetidos
act = [S("voe.sx", "Sub", 1)]
nuevo = [S("voe.sx", "Sub", 1), S("voe.sx", "Sub", 2), S("embed69.org", "Latino", 1), S("embed69.org", "Latino", 1)]
r = A.combinar_servidores(act, nuevo, comprobar=VIVOS)
urls = [x["url"] for x in r["servidores"]]
check(len(urls) == len(set(urls)), "ninguna URL repetida")
check(sum(1 for x in r["servidores"] if x["lang"] == "Sub" and "voe.sx" in x["url"]) == 1,
      "el mismo host no entra dos veces en un idioma")

# --- El tope general también es 4
check(A.MAX_POR_IDIOMA == 4, "el máximo configurado es 4")
servs = [S("h%d.com" % i, "Latino", i) for i in range(1, 9)]
check(len(A.prioritize(servs)) == 4, "prioritize también se queda en 4 por idioma")

# --- Las subidas del usuario NUNCA se reemplazan, aunque parezcan rotas
act = [S("vidara.to", "Latino"), S("sfastwish.com", "Sub"), S("voe.sx", "Sub")]
nuevo = [S("mp4upload.com", "Latino"), S("uqload.io", "Sub")]
r = A.combinar_servidores(act, nuevo, comprobar=lambda u: False)      # todo «roto»
urls = [x["url"] for x in r["servidores"]]
check("https://vidara.to/e/1" in urls and "https://sfastwish.com/e/1" in urls,
      "Vidara y Streamwish del usuario se quedan aunque parezcan rotos")
check("https://voe.sx/e/1" not in urls and r["repuestos"] == 1, "solo se reemplaza el roto que NO es suyo (VOE)")

# --- «Sub | Dob» cuenta como Sub y Latino: no se añade nada
act = [S("filemoon.sx", "Sub | Dob"), S("vidara.to", "Sub | Dob")]
r = A.combinar_servidores(act, [S("mega.nz", "Latino"), S("voe.sx", "Sub")], comprobar=VIVOS)
check(r["anadidos"] == 0 and not r["cambio"], "un episodio «Sub | Dob» se considera completo")

# --- El recorte a 4 nunca se lleva una subida del usuario
act = [S("h%d.com" % i, "Sub", i) for i in range(1, 5)] + [S("vidara.to", "Sub", 9)]
r = A.combinar_servidores(act, [], comprobar=VIVOS)
urls = [x["url"] for x in r["servidores"]]
check(len(urls) == 4 and "https://vidara.to/e/9" in urls, "al recortar a 4 se queda la subida del usuario")

# --- Dominio muerto: sfastwish.com -> streamwish.to en lo nuevo
r = A.combinar_servidores([S("voe.sx", "Sub")],
                          [{"url": "https://sfastwish.com/e/abc", "name": "Streamwish", "lang": "Sub"}], comprobar=VIVOS)
check("https://streamwish.to/e/abc" in [x["url"] for x in r["servidores"]],
      "un Streamwish nuevo de sfastwish.com se guarda con streamwish.to")

print("\n%d de %d correctos" % (total - fallos, total))
sys.exit(1 if fallos else 0)
