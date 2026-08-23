#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
All-Anime — Importador de escritorio (v3)
=========================================
App nativa (sin navegador, sin CORS). Buscas el título, arma el anime con sus datos
REALES (título oficial, portada, fondo, LOGO, e imagen/título por episodio) y sus
servidores en Latino/Sub de varias fuentes; TODO es editable antes de guardar.

Novedades v3:
  - Guarda con el NOMBRE REAL del anime (no el que escribiste para buscar).
  - Trae también el LOGO (con TMDB API key opcional, gratis) + portada/fondo.
  - Puedes EDITAR título, imágenes del anime y la imagen/título de cada episodio.
  - Interfaz rediseñada.
  - Fuentes: embed69 (Latino), animeav1 (Lat+Sub), jkanime (Sub), Manual.
  - Prioridad de servidores + modo "reparar/reemplazar enlaces rotos".

TMDB API key (opcional, recomendada para el LOGO y mejores datos):
  Gratis en https://www.themoviedb.org/settings/api  (copia la "API Key (v3 auth)").
  Pégala una vez en el campo TMDB y se guarda.

Uso:
  Instala Python 3 (python.org, "Add to PATH") → doble clic en este archivo.
  .exe:  pip install pyinstaller
         pyinstaller --onefile --noconsole --name AllAnimeImporter allanime_importer.py
"""

import json, re, base64, os, urllib.request, urllib.parse, urllib.error, threading, time, ssl, unicodedata
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog

API_KEY = "AIzaSyDJMJcwFvQCAfp9mXcCvxCQpX-6wy-a4FA"
PROJECT = "all-anime-eae5b"
FS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
IMG = "https://image.tmdb.org/t/p"
CFG_PATH = os.path.join(os.path.expanduser("~"), ".allanime_importer.json")
_SSL = ssl.create_default_context(); _SSL.check_hostname = False; _SSL.verify_mode = ssl.CERT_NONE

def load_cfg():
    try:
        with open(CFG_PATH, encoding="utf-8") as f: return json.load(f)
    except Exception: return {}
def save_cfg(c):
    try:
        with open(CFG_PATH, "w", encoding="utf-8") as f: json.dump(c, f)
    except Exception: pass

# ------------------------------------------------------------------ HTTP
def http(url, data=None, headers=None, referer=None, method=None, timeout=25):
    h = {"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9"}
    if referer: h["Referer"] = referer
    if headers: h.update(headers)
    body = json.dumps(data).encode() if data is not None else None
    if body is not None: h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h, method=method or ("POST" if data is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)
def get_text(url, referer=None):
    _, t = http(url, referer=referer); return t
def get_json(url):
    st, t = http(url)
    try: return json.loads(t)
    except Exception: return {}

# ------------------------------------------------------------------ Firestore
def sign_in(email, password):
    st, t = http(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}",
                 data={"email": email, "password": password, "returnSecureToken": True})
    j = json.loads(t)
    if "idToken" not in j: raise RuntimeError(j.get("error", {}).get("message", "login falló"))
    return j["idToken"]
def to_fs(v):
    if v is None: return {"nullValue": None}
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, float): return {"doubleValue": v}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, list): return {"arrayValue": {"values": [to_fs(x) for x in v]}}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_fs(x) for k, x in v.items() if x is not None}}}
    return {"nullValue": None}
def fv(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [fv(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: fv(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None
def get_doc(path, token=None):
    h = {"Authorization": "Bearer " + token} if token else None
    st, t = http(f"{FS}/{path}", headers=h)
    if st != 200: return None
    j = json.loads(t)
    return {k: fv(x) for k, x in j["fields"].items()} if "fields" in j else None
def patch_fields(path, fields, token):
    mask = "&".join("updateMask.fieldPaths=" + urllib.parse.quote(k) for k in fields)
    return http(f"{FS}/{path}?{mask}", data={"fields": {k: to_fs(v) for k, v in fields.items()}},
                headers={"Authorization": "Bearer " + token}, method="PATCH")
def get_catalog():
    d = get_doc("catalog/index"); return (d or {}).get("items", []) if d else []

# ------------------------------------------------------------------ util
def norm(s): return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
def dec_ent(s): return (s or "").replace("&#39;", "'").replace("&quot;", '"').replace("&amp;", "&").strip()
def slugify(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))
MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
def fmt_date(d):
    if not d or len(d) < 10: return ""
    try:
        y, m, day = d[:10].split("-"); return f"{MESES[int(m)]} {int(day)}, {y}"
    except Exception: return ""
def audio_label(langs):
    """Mapea los idiomas presentes al valor 'audio' del sitio."""
    has_lat = "Latino" in langs; has_sub = "Sub" in langs; has_cas = "Castellano" in langs
    if has_lat and has_sub: return "Sub | Dob"
    if has_cas and has_sub: return "Sub | Cas"
    if has_lat: return "Latino"
    if has_cas: return "Castellano"
    return "Sub"
def best(cands, title):
    if not cands: return None
    want = norm(title)
    def sc(c):
        cn = norm(c.replace("-", " ").replace("/", " "))
        if cn == want: return 100
        if cn.startswith(want) or want.startswith(cn): return 70
        ws = set(want.split()); return len([w for w in cn.split() if w in ws])
    return sorted(cands, key=sc, reverse=True)[0]

# ------------------------------------------------------------------ TMDB (API si hay key; si no, scraping)
def tmdb_resolve(title, key):
    if key:
        j = get_json(f"https://api.themoviedb.org/3/search/tv?api_key={key}&language=es-ES&query={urllib.parse.quote(title)}")
        r = (j.get("results") or [])
        return str(r[0]["id"]) if r else None
    t = get_text(f"https://www.themoviedb.org/search/tv?query={urllib.parse.quote(title)}")
    m = re.search(r'href="/tv/(\d+)', t); return m.group(1) if m else None

def tmdb_full(tv, key):
    """Devuelve dict con title real, year, genres, desc, poster, backdrop, LOGO, imdb, seasons, stills."""
    out = {"title": "", "year": None, "genres": [], "description": "", "poster": "", "backdrop": "",
           "logo": "", "imdb": "", "seasons": [], "stills": {}, "altTitles": [], "creator": "", "runtime": 24}
    if key:
        d = get_json(f"https://api.themoviedb.org/3/tv/{tv}?api_key={key}&language=es-ES")
        out["title"] = d.get("name") or d.get("original_name") or ""
        out["description"] = d.get("overview") or ""
        out["genres"] = [g["name"] for g in d.get("genres", [])][:5]
        fad = d.get("first_air_date") or ""; out["year"] = int(fad[:4]) if fad[:4].isdigit() else None
        if d.get("poster_path"): out["poster"] = f"{IMG}/w500{d['poster_path']}"
        if d.get("backdrop_path"): out["backdrop"] = f"{IMG}/w1280{d['backdrop_path']}"
        rt = d.get("episode_run_time") or []; out["runtime"] = rt[0] if rt else 24
        out["creator"] = (d.get("created_by") or [{}])[0].get("name") or (d.get("production_companies") or [{}])[0].get("name") or (d.get("networks") or [{}])[0].get("name") or ""
        # títulos alternativos (otros países) + original
        alts = get_json(f"https://api.themoviedb.org/3/tv/{tv}/alternative_titles?api_key={key}")
        at = [a.get("title") for a in (alts.get("results") or []) if a.get("title")]
        if d.get("original_name"): at.insert(0, d["original_name"])
        seen = set(); out["altTitles"] = [x for x in at if x and x != out["title"] and not (x.lower() in seen or seen.add(x.lower()))][:8]
        seasons = [s for s in d.get("seasons", []) if s.get("season_number", 0) >= 1 and s.get("episode_count", 0) > 0]
        out["seasons"] = [{"season": s["season_number"], "count": s["episode_count"]} for s in seasons]
        ext = get_json(f"https://api.themoviedb.org/3/tv/{tv}/external_ids?api_key={key}")
        out["imdb"] = ext.get("imdb_id") or ""
        im = get_json(f"https://api.themoviedb.org/3/tv/{tv}/images?api_key={key}&include_image_language=es,en,null")
        logos = im.get("logos") or []
        def lscore(l): return (2 if l.get("iso_639_1") == "es" else 1 if l.get("iso_639_1") == "en" else 0, l.get("vote_average", 0))
        if logos:
            lg = sorted(logos, key=lscore, reverse=True)[0]
            out["logo"] = f"{IMG}/w500{lg['file_path']}"
        for S in out["seasons"]:
            sd = get_json(f"https://api.themoviedb.org/3/tv/{tv}/season/{S['season']}?api_key={key}&language=es-ES")
            for e in sd.get("episodes", []):
                n = e.get("episode_number")
                out["stills"][f"{S['season']}x{n}"] = {
                    "still": f"{IMG}/w500{e['still_path']}" if e.get("still_path") else "",
                    "title": e.get("name") or "", "overview": e.get("overview") or "",
                    "air_date": fmt_date(e.get("air_date")), "runtime": e.get("runtime") or out["runtime"]}
            time.sleep(0.05)
        return out
    # ---- Fallback scraping (sin logo) ----
    h = get_text(f"https://www.themoviedb.org/tv/{tv}?language=es-ES")
    mt = re.search(r'property="og:title" content="([^"]+)"', h) or re.search(r"<title>([^(<]+)", h)
    out["title"] = dec_ent(mt.group(1)) if mt else ""
    poster = re.search(r'property="og:image" content="[^"]*/([A-Za-z0-9]{16,})\.(?:jpg|png)', h)
    if poster: out["poster"] = f"{IMG}/w500/{poster.group(1)}.jpg"
    bd = get_text(f"https://www.themoviedb.org/tv/{tv}/images/backdrops")
    m = re.search(r'image\.tmdb\.org/t/p/[a-z0-9_]+/([A-Za-z0-9]{20,})\.jpg', bd)
    if m: out["backdrop"] = f"{IMG}/w1280/{m.group(1)}.jpg"
    desc = re.search(r'<div class="overview">\s*<p>([^<]+)</p>', h)
    out["description"] = dec_ent(desc.group(1)) if desc else ""
    out["genres"] = [dec_ent(g) for g in list(dict.fromkeys(re.findall(r'/genre/\d+[^"]*"[^>]*>([^<]+)<', h)))[:5]]
    yr = re.search(r"<title>[^<]*?\((?:[^)]*?)(19[6-9]\d|20[0-4]\d)\)", h) or re.search(r"(20[0-4]\d|19[6-9]\d)", h)
    out["year"] = int(yr.group(1)) if yr else None
    for s in range(1, 9):
        hs = get_text(f"https://www.themoviedb.org/tv/{tv}/season/{s}?language=es-ES")
        chunks = re.split(r'id="episode_[0-9a-f]+"', hs)[1:]
        if not chunks:
            if s > 1: break
            continue
        out["seasons"].append({"season": s, "count": len(chunks)})
        for i, c in enumerate(chunks):
            im = re.search(r'(?:media\.themoviedb\.org|image\.tmdb\.org)/t/p/[a-z0-9_]+/([A-Za-z0-9]{16,})\.', c)
            ti = re.search(r'<div class="episode_title">\s*<h3>\s*<a[^>]*>([^<]+)</a>', c)
            out["stills"][f"{s}x{i+1}"] = {"still": f"{IMG}/w500/{im.group(1)}.jpg" if im else "", "title": dec_ent(ti.group(1)) if ti else ""}
        time.sleep(0.15)
    return out

def imdb_suggest(title, year=None):
    slug = re.sub(r"\s+", "_", re.sub(r"[^a-z0-9 ]", "", title.lower()).strip())
    if not slug: return None
    try:
        _, t = http(f"https://v2.sg.media-imdb.com/suggestion/{slug[0]}/{urllib.parse.quote(slug)}.json")
        d = [x for x in json.loads(t).get("d", []) if str(x.get("id", "")).startswith("tt")]
        tv = [x for x in d if re.search(r"TV series|TV mini", x.get("q", ""), re.I)]
        pool = tv or d
        if year:
            yr = [x for x in pool if x.get("y") and abs(x["y"] - int(year)) <= 1]
            if yr: return yr[0]["id"]
        return pool[0]["id"] if pool else None
    except Exception: return None

# ------------------------------------------------------------------ Fuentes de servidores
NAME = {"mega": "Mega", "sfastwish": "Streamwish", "streamwish": "Streamwish", "swiftplay": "Streamwish",
        "hglink": "Streamwish", "voe": "VOE", "vidhide": "VidHide", "vidhidevip": "VidHide",
        "filemoon": "Filemoon", "streamtape": "Streamtape", "mp4upload": "Mp4upload", "zilla": "AnimeAV1 HD"}
def nm(u):
    s = (u or "").lower()
    for k, v in NAME.items():
        if k in s: return v
    return "Servidor"
def prioritize(servers, prefer=None, only=False):
    prefer = [p.strip().lower() for p in (prefer or []) if p.strip()]
    def rank(s):
        n = s["name"].lower()
        for i, p in enumerate(prefer):
            if p in n: return i
        return len(prefer) + 5
    g = {}
    for s in servers:
        if only and prefer and not any(p in s["name"].lower() for p in prefer): continue
        g.setdefault(s["lang"], []).append(s)
    out = []
    for k in g: out += sorted(g[k], key=rank)[:3]
    return out

def embed69_lat(imdb, s, e):
    code = f"{imdb}-{s}x{str(e).zfill(2)}"
    h = get_text(f"https://embed69.org/f/{code}/", referer="https://pelisplushd.bz/")
    m = re.search(r'dataLink\s*=\s*(\[[\s\S]*?\]);', h)
    if not m: return None
    try: dl = json.loads(m.group(1))
    except Exception: return None
    if dl: return {"url": f"https://embed69.org/f/{code}/", "name": "PelisPlus", "lang": "Latino", "desc": "Audio Latino"}
    return None
JK_KEEP = ("mega", "sfastwish", "streamwish", "swiftplay", "voe", "vidhide", "vidhidevip", "filemoon", "streamtape")
def jk_search(title):
    h = get_text(f"https://jkanime.net/buscar/{urllib.parse.quote(title)}/")
    c = [m for m in dict.fromkeys(re.findall(r'href="https://jkanime\.net/([a-z0-9-]+)/"', h))
         if m not in ("buscar", "letra", "genero", "top", "horario", "directorio")]
    return best(c, title)
def jk_servers(slug, n):
    h = get_text(f"https://jkanime.net/{slug}/{n}/")
    m = re.search(r'var\s+servers\s*=\s*(\[[\s\S]*?\]);', h)
    if not m: return None
    try: arr = json.loads(m.group(1))
    except Exception: return []
    out, seen = [], set()
    for s in arr:
        try: u = base64.b64decode(s.get("remote", "")).decode().strip()
        except Exception: continue
        if not u.startswith("http") or not any(k in u.lower() for k in JK_KEEP): continue
        name = nm(u)
        if name in seen: continue
        seen.add(name); out.append({"url": u, "name": name, "lang": "Sub", "desc": ""})
    return out
def av1_search(title):
    for u in (f"https://animeav1.com/catalogo?search={urllib.parse.quote(title)}", f"https://animeav1.com/catalogo?q={urllib.parse.quote(title)}"):
        h = get_text(u)
        c = list(dict.fromkeys(re.findall(r'/media/([a-z0-9-]+)', h)))
        if c: return best(c, title)
    return None
def av1_servers(slug, n):
    h = get_text(f"https://animeav1.com/media/{slug}/{n}")
    if len(h) < 3000 and "embeds" not in h: return None
    res = []
    blk = re.search(r'embeds:\{([\s\S]*?)\}\}', h)
    raw = blk.group(0) if blk else h
    for lang, tag in (("DUB", "Latino"), ("SUB", "Sub")):
        seg = re.search(lang + r':\[([\s\S]*?)\]', raw)
        if not seg: continue
        seen = set()
        for m in re.finditer(r'server:"([^"]+)",url:"([^"]+)"', seg.group(1)):
            url = m.group(2); name = nm(url) if nm(url) != "Servidor" else (m.group(1) if m.group(1) != "HLS" else "AnimeAV1 HD")
            if name in seen: continue
            seen.add(name); res.append({"url": url, "name": name, "lang": tag, "desc": ""})
    return res

# ------------------------------------------------------------------ Construir
def build(title, opts, log, prog):
    log(f"== {title} ==")
    tmdb = tmdb_resolve(title, opts["tmdb_key"])
    info = tmdb_full(tmdb, opts["tmdb_key"]) if tmdb else {"title": title, "year": None, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": "", "imdb": "", "seasons": [], "stills": {}}
    real_title = info["title"] or title
    imdb = info["imdb"] or imdb_suggest(real_title, info["year"])
    log(f"título real: {real_title} | imdb={imdb} | tmdb={tmdb} | logo={'sí' if info['logo'] else 'no'}")
    seasons = info["seasons"] or [{"season": 1, "count": 60}]
    aid = slugify(real_title)
    jkslug = jk_search(title) if opts["jk"] else None
    avslug = av1_search(title) if opts["av1"] else None
    if opts["jk"]: log(f"jkanime: {jkslug or '(no)'}")
    if opts["av1"]: log(f"animeav1: {avslug or '(no)'}")
    manual = {}
    if opts["manual"]:
        for i, line in enumerate([l.strip() for l in opts["manual_text"].splitlines() if l.strip()]):
            mm = re.match(r'^(\d+)\s*\|\s*(https?://\S+)', line)
            manual[int(mm.group(1)) if mm else i + 1] = (mm.group(2) if mm else line)

    episodes, absn = [], 0
    total = sum(s["count"] for s in seasons) or 60
    for S in seasons:
        sname = f"Temporada {S['season']}" if len(seasons) > 1 else "Temporada 1"
        for n in range(1, S["count"] + 1):
            absn += 1; servers = []
            if opts["e69"] and imdb:
                r = embed69_lat(imdb, S["season"], n)
                if r: servers.append(r)
                time.sleep(0.85)
            if opts["av1"] and avslug:
                a = av1_servers(avslug, absn)
                if a is None and absn > total: break
                servers += (a or []); time.sleep(0.35)
            if opts["jk"] and jkslug:
                servers += (jk_servers(jkslug, absn) or []); time.sleep(0.3)
            if opts["manual"] and absn in manual:
                servers.append({"url": manual[absn], "name": nm(manual[absn]), "lang": "Latino", "desc": ""})
            prog(absn, total)
            servers = prioritize(servers, opts.get("prefer"), opts.get("only"))
            if not servers:
                log(f"  ep {absn} (S{S['season']}E{n}): sin servers"); continue
            em = info["stills"].get(f"{S['season']}x{n}", {})
            rt = em.get("runtime") or info.get("runtime") or 24
            episodes.append({"number": n, "season": sname, "title": em.get("title") or f"Episodio {n}",
                             "language": "Latino" if any(s["lang"] == "Latino" for s in servers) else "Sub",
                             "videoUrl": f"frame/player.html?a={aid}&s={urllib.parse.quote(sname)}&e={n}",
                             "img": em.get("still") or info["backdrop"] or info["poster"],
                             "description": em.get("overview") or "", "releaseDate": em.get("air_date") or "",
                             "duration": f"{rt} min", "servers": servers})
    langs = list(dict.fromkeys(e["language"] for e in episodes))
    log(f"== {len(episodes)} episodios construidos == audio: {audio_label(langs)}")
    return {"aid": aid, "info": info, "real_title": real_title, "seasons": seasons, "episodes": episodes,
            "audio": audio_label(langs), "altTitles": info.get("altTitles", []), "creator": info.get("creator", "")}

def save(data, token, replace, log):
    aid = data["aid"]; built = data["episodes"]; info = data["info"]
    if not built: log("Nada que guardar."); return
    existing = get_doc(f"animes/{aid}", token)
    if existing and existing.get("episodes"):
        ex = existing["episodes"]; idx = {f"{e.get('season')}|{e.get('number')}": e for e in ex}
        added = replaced = 0
        for b in built:
            k = f"{b['season']}|{b['number']}"
            if k in idx:
                if replace: idx[k]["servers"] = b["servers"]; idx[k]["language"] = b["language"]; idx[k]["img"] = b["img"]; idx[k]["title"] = b["title"]; replaced += 1
            else: ex.append(b); added += 1
        episodes = ex; doc = existing
        log(f"Existente: +{added} nuevos" + (f", {replaced} reemplazados" if replace else " (no se tocó lo demás)"))
    else:
        episodes = built
        doc = {"id": aid, "title": data["real_title"], "altTitles": [], "type": "TV", "audio": data["audio"],
               "status": "Finalizado", "quality": "1080p", "year": info["year"], "creator": "", "genres": info["genres"],
               "tags": [], "seasons": len(data["seasons"]), "rating": 4.4, "ratingCount": 300, "contentWarning": "",
               "description": info["description"], "img": info["poster"], "imgMobile": info["poster"],
               "heroImg": info["backdrop"], "fonImg": info["backdrop"], "logoImg": info["logo"], "trailerUrl": ""}
    # aplica los datos/ediciones del anime siempre
    doc["title"] = data["real_title"]; doc["img"] = info["poster"]; doc["imgMobile"] = info["poster"]
    doc["heroImg"] = info["backdrop"]; doc["fonImg"] = info["backdrop"]; doc["logoImg"] = info["logo"]
    doc["altTitles"] = data.get("altTitles", []); doc["audio"] = data.get("audio", "Sub")
    if data.get("creator"): doc["creator"] = data["creator"]
    if info.get("description") and not doc.get("description"): doc["description"] = info["description"]
    doc["episodes"] = episodes; doc["episodesTotal"] = len(episodes); doc["episodesCount"] = len(episodes)
    st, t = patch_fields(f"animes/{aid}", doc, token)
    if st != 200: log(f"ERROR guardar: {st} {t[:150]}"); return
    cat = get_catalog(); light = {k: v for k, v in doc.items() if k != "episodes"}
    i = next((j for j, x in enumerate(cat) if x.get("id") == aid), -1)
    if i >= 0: cat[i] = light
    else: cat.append(light)
    patch_fields("catalog/index", {"items": cat}, token)
    patch_fields("meta/catalog", {"version": int(time.time() * 1000)}, token)
    log(f"OK GUARDADO: {aid} — {len(episodes)} eps [{doc.get('audio', '')}]. Ya está en el sitio.")

# ================================================================== GUI
BG = "#0f0f12"; CARD = "#1a1a20"; LINE = "#2a2a33"; TXT = "#e9e9ee"; MUT = "#9aa0aa"; RED = "#e0231f"; GRN = "#25a35a"
AUDIOS = ["Sub", "Sub | Dob", "Sub | Cas", "Latino", "Castellano", "Subtitulado"]
def _icon_path():
    import sys
    for base in (getattr(sys, "_MEIPASS", None), os.path.dirname(os.path.abspath(__file__))):
        if base:
            p = os.path.join(base, "icon.ico")
            if os.path.exists(p): return p
    return None
class App:
    def __init__(self, root):
        self.root = root; self.token = None; self.data = None; self.cfg = load_cfg()
        root.title("All-Anime · Importador"); root.geometry("980x740"); root.configure(bg=BG); root.minsize(880, 640)
        try:
            ip = _icon_path()
            if ip: root.iconbitmap(ip)
        except Exception: pass
        s = ttk.Style(); s.theme_use("clam")
        s.configure(".", background=BG, foreground=TXT, fieldbackground="#101015", font=("Segoe UI", 10))
        s.configure("Card.TFrame", background=CARD)
        s.configure("TLabel", background=CARD, foreground=TXT)
        s.configure("Mut.TLabel", background=CARD, foreground=MUT, font=("Segoe UI", 9))
        s.configure("H.TLabel", background=CARD, foreground="#ff8a8a", font=("Segoe UI", 10, "bold"))
        s.configure("TButton", background="#26262e", foreground=TXT, padding=8, borderwidth=0, font=("Segoe UI", 10, "bold"))
        s.map("TButton", background=[("active", "#33333d")])
        s.configure("Red.TButton", background=RED); s.map("Red.TButton", background=[("active", "#b81c19")])
        s.configure("Grn.TButton", background=GRN); s.map("Grn.TButton", background=[("active", "#1c7d45")])
        s.configure("TCheckbutton", background=CARD, foreground=TXT); s.configure("TRadiobutton", background=CARD, foreground=TXT)
        s.configure("TEntry", fieldbackground="#101015", foreground=TXT, insertcolor=TXT, borderwidth=1)
        s.configure("Treeview", background="#101015", fieldbackground="#101015", foreground=TXT, rowheight=24, borderwidth=0)
        s.configure("Treeview.Heading", background="#22222a", foreground=TXT, font=("Segoe UI", 9, "bold"))
        s.configure("TNotebook", background=BG, borderwidth=0); s.configure("TNotebook.Tab", background="#1a1a20", foreground=MUT, padding=(14, 7))
        s.map("TNotebook.Tab", background=[("selected", CARD)], foreground=[("selected", TXT)])

        # Header
        hd = tk.Frame(root, bg="#141418"); hd.pack(fill="x")
        tk.Label(hd, text="▎", fg=RED, bg="#141418", font=("Segoe UI", 20, "bold")).pack(side="left", padx=(14, 0))
        tk.Label(hd, text="All-Anime · Importador", fg=TXT, bg="#141418", font=("Segoe UI", 14, "bold")).pack(side="left", pady=12)
        self.status = tk.Label(hd, text="Inicia sesión", fg="#ffcf7a", bg="#141418", font=("Segoe UI", 9)); self.status.pack(side="right", padx=16)

        body = tk.Frame(root, bg=BG); body.pack(fill="both", expand=True, padx=14, pady=12)

        def card(parent):
            c = tk.Frame(parent, bg=CARD, highlightbackground=LINE, highlightthickness=1); return c
        def head(c, t):
            ttk.Label(c, text=t, style="H.TLabel").pack(anchor="w", padx=14, pady=(12, 6))

        # Config card (login + tmdb)
        cf = card(body); cf.pack(fill="x")
        head(cf, "CUENTA Y AJUSTES")
        row = tk.Frame(cf, bg=CARD); row.pack(fill="x", padx=14, pady=(0, 12))
        ttk.Label(row, text="Correo admin").grid(row=0, column=0, sticky="w"); ttk.Label(row, text="Contraseña").grid(row=0, column=1, sticky="w", padx=(8, 0))
        ttk.Label(row, text="TMDB API key (opcional, para logo)").grid(row=0, column=2, sticky="w", padx=(8, 0))
        self.email = ttk.Entry(row, width=26); self.email.grid(row=1, column=0, sticky="w"); self.email.insert(0, self.cfg.get("email", ""))
        self.pw = ttk.Entry(row, width=18, show="•"); self.pw.grid(row=1, column=1, padx=(8, 0))
        self.tmdb = ttk.Entry(row, width=30); self.tmdb.grid(row=1, column=2, padx=(8, 0)); self.tmdb.insert(0, self.cfg.get("tmdb_key", ""))
        ttk.Button(row, text="Iniciar sesión", style="Red.TButton", command=self.login).grid(row=1, column=3, padx=(10, 0))

        # Search card
        sc = card(body); sc.pack(fill="x", pady=(12, 0))
        head(sc, "AGREGAR ANIME")
        sr = tk.Frame(sc, bg=CARD); sr.pack(fill="x", padx=14)
        self.title = ttk.Entry(sr, font=("Segoe UI", 12)); self.title.pack(side="left", fill="x", expand=True)
        self.build_btn = ttk.Button(sr, text="Buscar y construir", style="Red.TButton", command=self.do_build, state="disabled"); self.build_btn.pack(side="left", padx=(8, 0))
        opt = tk.Frame(sc, bg=CARD); opt.pack(fill="x", padx=14, pady=8)
        self.e69 = tk.BooleanVar(value=True); self.av1 = tk.BooleanVar(value=True); self.jk = tk.BooleanVar(value=True); self.man = tk.BooleanVar(value=False)
        for i, (t, v, cmd) in enumerate([("embed69 (Latino)", self.e69, None), ("animeav1 (Lat+Sub)", self.av1, None), ("jkanime (Sub)", self.jk, None), ("Manual", self.man, self.toggle_manual)]):
            ttk.Checkbutton(opt, text=t, variable=v, command=cmd or (lambda: None)).grid(row=0, column=i, sticky="w", padx=(0, 14))
        self.replace = tk.BooleanVar(value=False)
        ttk.Radiobutton(opt, text="Añadir nuevo", variable=self.replace, value=False).grid(row=0, column=5, padx=(10, 6))
        ttk.Radiobutton(opt, text="Reparar (reemplazar)", variable=self.replace, value=True).grid(row=0, column=6)
        pr = tk.Frame(sc, bg=CARD); pr.pack(fill="x", padx=14, pady=(0, 10))
        ttk.Label(pr, text="Prioridad de servidores:").pack(side="left")
        self.prefer = ttk.Entry(pr, width=40); self.prefer.pack(side="left", padx=6); self.prefer.insert(0, "Mega, Streamwish, VOE")
        self.only = tk.BooleanVar(value=False); ttk.Checkbutton(pr, text="solo estos", variable=self.only).pack(side="left")
        self.manbox = tk.Frame(sc, bg=CARD)
        ttk.Label(self.manbox, text="URLs manuales (N|URL por línea)", style="Mut.TLabel").pack(anchor="w", padx=14)
        self.mantext = tk.Text(self.manbox, height=3, bg="#101015", fg=TXT, insertbackground=TXT, relief="flat"); self.mantext.pack(fill="x", padx=14, pady=(0, 8))

        # Preview card (anime editable + episodes)
        pv = card(body); pv.pack(fill="both", expand=True, pady=(12, 0))
        head(pv, "VISTA PREVIA (todo editable · doble clic en un episodio para cambiar su imagen)")
        af = tk.Frame(pv, bg=CARD); af.pack(fill="x", padx=14)
        self.f_title = self._field(af, "Título", 0); self.f_year = self._field(af, "Año", 1, w=8)
        self.f_alt = self._field(af, "Títulos alternativos (coma)", 2)
        ttk.Label(af, text="Audio", style="Mut.TLabel").grid(row=3, column=0, sticky="w", pady=2)
        self.f_audio = ttk.Combobox(af, values=AUDIOS, width=16, state="readonly"); self.f_audio.grid(row=3, column=1, sticky="w", padx=8, pady=2); self.f_audio.set("Sub")
        self.f_creator = self._field(af, "Estudio/Creador", 4)
        self.f_poster = self._field(af, "Portada (img)", 5, w=40); self.f_back = self._field(af, "Fondo (heroImg)", 6, w=40)
        self.f_logo = self._field(af, "Logo (logoImg)", 7, w=40)
        self.bar = ttk.Progressbar(pv); self.bar.pack(fill="x", padx=14, pady=8)
        self.tree = ttk.Treeview(pv, columns=("t", "img", "srv"), show="headings", height=8)
        for c, txt, w in [("t", "Título", 240), ("img", "Imagen", 120), ("srv", "Servidores", 320)]:
            self.tree.heading(c, text=txt); self.tree.column(c, width=w)
        self.tree.pack(fill="both", expand=True, padx=14)
        self.tree.bind("<Double-1>", self.edit_episode)
        bb = tk.Frame(pv, bg=CARD); bb.pack(fill="x", padx=14, pady=10)
        self.save_btn = ttk.Button(bb, text="Guardar en la web", style="Grn.TButton", command=self.do_save, state="disabled"); self.save_btn.pack(side="left")
        ttk.Label(bb, text="  (aplica lo que edites arriba)", style="Mut.TLabel").pack(side="left")

        self.logbox = tk.Text(root, bg="#0a0a0c", fg="#c8c8d0", height=6, font=("Consolas", 9), relief="flat"); self.logbox.pack(fill="x", padx=14, pady=(0, 12))

    def _field(self, parent, label, r, w=None):
        ttk.Label(parent, text=label, style="Mut.TLabel").grid(row=r, column=0, sticky="w", pady=2)
        e = ttk.Entry(parent, width=w or 60); e.grid(row=r, column=1, sticky="we", padx=8, pady=2); parent.columnconfigure(1, weight=1)
        return e

    def toggle_manual(self):
        if self.man.get(): self.manbox.pack(fill="x", pady=(0, 6))
        else: self.manbox.pack_forget()
    def log(self, m): self.logbox.insert("end", m + "\n"); self.logbox.see("end"); self.root.update_idletasks()
    def prog(self, n, t): self.bar["maximum"] = t; self.bar["value"] = n; self.root.update_idletasks()

    def login(self):
        try:
            self.token = sign_in(self.email.get().strip(), self.pw.get())
            self.cfg.update(email=self.email.get().strip(), tmdb_key=self.tmdb.get().strip()); save_cfg(self.cfg)
            self.status.config(text="✅ Sesión iniciada", fg="#9fd89f"); self.build_btn.config(state="normal")
        except Exception as e: messagebox.showerror("Login", str(e))

    def do_build(self):
        t = self.title.get().strip()
        if not t or not self.token: return
        self.cfg["tmdb_key"] = self.tmdb.get().strip(); save_cfg(self.cfg)
        self.build_btn.config(state="disabled"); self.save_btn.config(state="disabled")
        for i in self.tree.get_children(): self.tree.delete(i)
        self.logbox.delete("1.0", "end")
        opts = {"e69": self.e69.get(), "av1": self.av1.get(), "jk": self.jk.get(), "manual": self.man.get(),
                "manual_text": self.mantext.get("1.0", "end"), "prefer": self.prefer.get().split(","),
                "only": self.only.get(), "tmdb_key": self.tmdb.get().strip()}
        def work():
            try:
                self.data = build(t, opts, self.log, self.prog); self.root.after(0, self.render)
            except Exception as e:
                self.log("ERROR: " + str(e))
            finally:
                self.root.after(0, lambda: self.build_btn.config(state="normal"))
        threading.Thread(target=work, daemon=True).start()

    def render(self):
        info = self.data["info"]
        for e, val in [(self.f_title, self.data["real_title"]), (self.f_year, info.get("year") or ""),
                       (self.f_alt, ", ".join(self.data.get("altTitles", []))), (self.f_creator, self.data.get("creator", "")),
                       (self.f_poster, info["poster"]), (self.f_back, info["backdrop"]), (self.f_logo, info["logo"])]:
            e.delete(0, "end"); e.insert(0, str(val))
        self.f_audio.set(self.data.get("audio", "Sub"))
        for i, e in enumerate(self.data["episodes"]):
            srv = ", ".join(f"{s['name']}({s['lang'][:3]})" for s in e["servers"])
            img = "sí" if e["img"] else "—"
            self.tree.insert("", "end", iid=str(i), text="", values=(f"E{e['number']} · {e['title']}", img, srv))
        self.save_btn.config(state="normal" if self.data["episodes"] else "disabled")
        if not info["logo"]: self.log("Sin logo (añade una TMDB API key para traerlo, o pégalo en el campo Logo).")

    def edit_episode(self, ev):
        iid = self.tree.focus()
        if not iid or not self.data: return
        ep = self.data["episodes"][int(iid)]
        new = simpledialog.askstring("Editar imagen del episodio", f"E{ep['number']} — URL de la imagen:", initialvalue=ep["img"], parent=self.root)
        if new is not None:
            ep["img"] = new.strip()
            self.tree.set(iid, "img", "sí" if ep["img"] else "—")

    def do_save(self):
        if not self.data: return
        # aplica ediciones del anime
        info = self.data["info"]
        self.data["real_title"] = self.f_title.get().strip() or self.data["real_title"]
        try: info["year"] = int(self.f_year.get().strip()) if self.f_year.get().strip() else info["year"]
        except Exception: pass
        info["poster"] = self.f_poster.get().strip(); info["backdrop"] = self.f_back.get().strip(); info["logo"] = self.f_logo.get().strip()
        self.data["altTitles"] = [x.strip() for x in self.f_alt.get().split(",") if x.strip()]
        self.data["audio"] = self.f_audio.get().strip() or self.data.get("audio", "Sub")
        self.data["creator"] = self.f_creator.get().strip()
        self.save_btn.config(state="disabled")
        def work():
            try: save(self.data, self.token, self.replace.get(), self.log)
            except Exception as e: self.log("ERROR guardar: " + str(e))
            finally: self.root.after(0, lambda: self.save_btn.config(state="normal"))
        threading.Thread(target=work, daemon=True).start()

if __name__ == "__main__":
    r = tk.Tk(); App(r); r.mainloop()
