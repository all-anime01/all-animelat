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
def _obf(s):
    """Ofusca la contraseña guardada (no es cifrado fuerte, evita verla a simple vista)."""
    try: return base64.b64encode(("aa::" + s).encode("utf-8")).decode() if s else ""
    except Exception: return ""
def _deobf(s):
    try:
        v = base64.b64decode((s or "").encode()).decode("utf-8")
        return v[4:] if v.startswith("aa::") else ""
    except Exception: return ""

# --- Respaldos locales (para REVERTIR cambios) ---
BACKUP_DIR = os.path.join(os.path.expanduser("~"), ".allanime_backups")
def backup_doc(aid, doc):
    """Guarda el estado ACTUAL del anime antes de modificarlo, para poder revertir."""
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        p = os.path.join(BACKUP_DIR, f"{aid}__{int(time.time())}.json")
        with open(p, "w", encoding="utf-8") as f: json.dump(doc, f, ensure_ascii=False)
        # conserva solo los últimos 6 respaldos por anime
        bks = sorted([x for x in os.listdir(BACKUP_DIR) if x.startswith(aid + "__")])
        for old in bks[:-6]:
            try: os.remove(os.path.join(BACKUP_DIR, old))
            except Exception: pass
        return p
    except Exception: return None
def latest_backup(aid):
    try:
        bks = sorted([x for x in os.listdir(BACKUP_DIR) if x.startswith(aid + "__")])
        if not bks: return None
        with open(os.path.join(BACKUP_DIR, bks[-1]), encoding="utf-8") as f: return json.load(f)
    except Exception: return None

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
def es_ep_title(name, n):
    """Prioriza el título en español. Si TMDB no tiene traducción y devuelve el genérico en
    inglés ('Episode 5') o viene vacío, usa 'Episodio N' en español."""
    name = (name or "").strip()
    if not name or re.match(r"(?i)^(episode|episodio|ep\.?|capitulo|capítulo)\s*\d+$", name):
        return f"Episodio {n}"
    return name
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
def parse_range(s, total):
    """'117-125' | '5,8,12' | '51-' | '' → set de números absolutos (o None = todos)."""
    s = (s or "").strip()
    if not s: return None
    out = set()
    for part in s.split(","):
        part = part.strip()
        if not part: continue
        if "-" in part:
            a, b = part.split("-", 1)
            try: a = int(a) if a.strip() else 1; b = int(b) if b.strip() else total
            except Exception: continue
            out.update(range(a, b + 1))
        elif part.isdigit(): out.add(int(part))
    return out or None
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
        if not r: return None
        # PREFERIR anime: género Animación (16) y/o idioma original japonés → evita el
        # "live action" (ej. One Piece de Netflix) cuando el título coincide.
        def score(x):
            s = 0
            if 16 in (x.get("genre_ids") or []): s += 2
            if x.get("original_language") == "ja": s += 1
            return s
        r = sorted(r, key=score, reverse=True)
        return str(r[0]["id"])
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
                    "title": es_ep_title(e.get("name"), n), "overview": e.get("overview") or "",
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
            out["stills"][f"{s}x{i+1}"] = {"still": f"{IMG}/w500/{im.group(1)}.jpg" if im else "", "title": es_ep_title(dec_ent(ti.group(1)) if ti else "", i + 1)}
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

def guess_kind(title):
    """'movie' o 'tv' según la API de sugerencias de IMDB (feature/video/short = película)."""
    slug = re.sub(r"\s+", "_", re.sub(r"[^a-z0-9 ]", "", title.lower()).strip())
    if not slug: return "tv"
    try:
        d = [x for x in json.loads(http(f"https://v2.sg.media-imdb.com/suggestion/{slug[0]}/{urllib.parse.quote(slug)}.json")[1]).get("d", []) if str(x.get("id", "")).startswith("tt")]
        if not d: return "tv"
        q = (d[0].get("q") or "").lower()
        return "movie" if re.search(r"feature|video|short|tv movie|movie", q) else "tv"
    except Exception: return "tv"

def imdb_movie(title, year=None):
    slug = re.sub(r"\s+", "_", re.sub(r"[^a-z0-9 ]", "", title.lower()).strip())
    if not slug: return None
    try:
        d = [x for x in json.loads(http(f"https://v2.sg.media-imdb.com/suggestion/{slug[0]}/{urllib.parse.quote(slug)}.json")[1]).get("d", []) if str(x.get("id", "")).startswith("tt")]
        mv = [x for x in d if re.search(r"feature|video|tv movie|short", (x.get("q") or ""), re.I)] or d
        if year:
            yr = [x for x in mv if x.get("y") and abs(x["y"] - int(year)) <= 1]
            if yr: return yr[0]["id"]
        return mv[0]["id"] if mv else None
    except Exception: return None

def tmdb_movie(title, key):
    """Metadata de PELÍCULA (título real, imágenes, sinopsis, año, duración, imdb, logo)."""
    out = {"title": "", "year": None, "genres": [], "description": "", "poster": "", "backdrop": "", "logo": "", "imdb": "", "runtime": 0}
    if not key:
        s = get_text(f"https://www.themoviedb.org/search/movie?query={urllib.parse.quote(title)}")
        mid = (re.search(r'href="/movie/(\d+)', s) or [None, None])[1]
        if not mid: return out
        h = get_text(f"https://www.themoviedb.org/movie/{mid}?language=es-ES")
        out["title"] = dec_ent((re.search(r'og:title" content="([^"]+)"', h) or re.search(r"<title>([^(<]+)", h) or [None, ""])[1])
        p = re.search(r'og:image" content="[^"]*/([A-Za-z0-9]{16,})\.(?:jpg|png)', h)
        if p: out["poster"] = f"{IMG}/w500/{p.group(1)}.jpg"
        de = re.search(r'<div class="overview">\s*<p>([^<]+)</p>', h); out["description"] = dec_ent(de.group(1)) if de else ""
        return out
    j = get_json(f"https://api.themoviedb.org/3/search/movie?api_key={key}&language=es-ES&query={urllib.parse.quote(title)}")
    r = (j.get("results") or [])
    if not r: return out
    mid = r[0]["id"]
    d = get_json(f"https://api.themoviedb.org/3/movie/{mid}?api_key={key}&language=es-ES")
    out["title"] = d.get("title") or d.get("original_title") or ""
    out["description"] = d.get("overview") or ""
    out["genres"] = [g["name"] for g in d.get("genres", [])][:5]
    out["runtime"] = d.get("runtime") or 0
    rd = d.get("release_date") or ""; out["year"] = int(rd[:4]) if rd[:4].isdigit() else None
    if d.get("poster_path"): out["poster"] = f"{IMG}/w500{d['poster_path']}"
    if d.get("backdrop_path"): out["backdrop"] = f"{IMG}/w1280{d['backdrop_path']}"
    out["imdb"] = (get_json(f"https://api.themoviedb.org/3/movie/{mid}/external_ids?api_key={key}") or {}).get("imdb_id") or ""
    im = get_json(f"https://api.themoviedb.org/3/movie/{mid}/images?api_key={key}&include_image_language=es,en,null")
    logos = im.get("logos") or []
    if logos: out["logo"] = f"{IMG}/w500{sorted(logos, key=lambda l: (l.get('iso_639_1') == 'es', l.get('vote_average', 0)), reverse=True)[0]['file_path']}"
    return out

# ------------------------------------------------------------------ Fuentes de servidores
NAME = {"mega": "Mega", "sfastwish": "Streamwish", "streamwish": "Streamwish", "swiftplay": "Streamwish",
        "hglink": "Streamwish", "voe": "VOE", "vidhide": "VidHide", "vidhidevip": "VidHide",
        "filemoon": "Filemoon", "filemooon": "Filemoon", "byse": "Filemoon", "bysc": "Filemoon", "moonplayer": "Filemoon",
        "vidara": "Vidara", "streamtape": "Streamtape", "mp4upload": "Mp4upload",
        "zilla": "AnimeAV1 HD", "mediafire": "Mediafire", "mixdrop": "Mixdrop", "mdbekj": "Mixdrop", "mdy48": "Mixdrop",
        "d-s.io": "Doodstream", "dood": "Doodstream", "desu": "Desu", "desuka": "Desu", "okru": "Okru", "ok.ru": "Okru",
        "uqload": "Uqload", "yourupload": "YourUpload"}
def nm(u):
    s = (u or "").lower()
    for k, v in NAME.items():
        if k in s: return v
    return "Servidor"
# Prioridad de servidores (los mejores primero) si no eliges una manual. Orden pedido:
# Filemoon(byse) → StreamWish → Vidara → PelisPlus/embed69 → HLS(animeav1) → Desu(jkanime) → VidHide.
QUALITY = ["filemoon", "streamwish", "vidara", "pelisplus", "embed69", "animeav1", "hls", "desu",
           "vidhide", "voe", "mega", "magi", "streamtape", "mp4upload", "mixdrop", "doodstream", "mediafire"]
def prioritize(servers, prefer=None, only=False, cap=3):
    """Máx `cap` por idioma; LATINO primero; ordenados por tu preferencia o por calidad."""
    prefer = [p.strip().lower() for p in (prefer or []) if p.strip()]
    order = prefer if prefer else QUALITY
    def rank(s):
        n = s["name"].lower()
        for i, p in enumerate(order):
            if p in n: return i
        return len(order) + 5
    g = {}
    for s in servers:
        if only and prefer and not any(p in s["name"].lower() for p in prefer): continue
        g.setdefault(s.get("lang", "Sub"), []).append(s)
    out = []
    for lang in ["Latino", "Castellano", "Sub"] + [k for k in g if k not in ("Latino", "Castellano", "Sub")]:
        if lang in g: out += sorted(g[lang], key=rank)[:cap]
    return out

def embed69_movie(imdb):
    if not imdb: return None
    for _ in range(3):
        h = get_text(f"https://embed69.org/f/{imdb}/", referer="https://pelisplushd.bz/")
        m = re.search(r'dataLink\s*=\s*(\[[\s\S]*?\]);', h)
        if m:
            try:
                if json.loads(m.group(1)):
                    return {"url": f"https://embed69.org/f/{imdb}/", "name": "PelisPlus", "lang": "Latino", "desc": "Audio Latino"}
            except Exception: pass
            return None
        if "Rate limit" in h or not h: time.sleep(4); continue
        return None
    return None
def embed69_lat(imdb, s, e):
    if not imdb: return None
    code = f"{imdb}-{s}x{str(e).zfill(2)}"
    # Reintenta si embed69 responde vacío (suele ser rate-limit temporal en sesiones largas).
    for attempt in range(3):
        h = get_text(f"https://embed69.org/f/{code}/", referer="https://pelisplushd.bz/")
        m = re.search(r'dataLink\s*=\s*(\[[\s\S]*?\]);', h)
        if m:
            try:
                if json.loads(m.group(1)):
                    return {"url": f"https://embed69.org/f/{code}/", "name": "PelisPlus", "lang": "Latino", "desc": "Audio Latino"}
            except Exception: pass
            return None  # existe la página pero sin datos → no hay en embed69
        if "Rate limit" in h or not h:
            time.sleep(4)  # rate-limit: espera y reintenta
            continue
        return None
    return None
def search_variants(title):
    """Variantes de búsqueda: título, parte principal (antes de :/-/(), y primeras palabras."""
    v = [title]
    main = re.split(r"[:\-–—(|~]", title)[0].strip()
    if main and main != title: v.append(main)
    words = main.split()
    if len(words) > 2: v.append(" ".join(words[:2]))
    if len(words) > 1: v.append(words[0])
    seen = set(); return [x for x in v if x and not (x.lower() in seen or seen.add(x.lower()))]
def jk_search(title):
    for q in search_variants(title):
        h = get_text(f"https://jkanime.net/buscar/{urllib.parse.quote(q)}/")
        c = [m for m in dict.fromkeys(re.findall(r'href="https://jkanime\.net/([a-z0-9-]+)/"', h))
             if m not in ("buscar", "letra", "genero", "top", "horario", "directorio")]
        if c: return best(c, title)
    return None

# --- Descubrimiento AUTOMÁTICO de temporadas/secuelas -----------------------
# jkanime/animeav1 separan las temporadas en slugs distintos (ishura, ishura-2nd-season…).
# Estos helpers buscan TODAS las secuelas de un anime y las devuelven ORDENADAS por
# temporada, para agregarlas todas sin pedirle los slugs al usuario.
_SEASONISH = re.compile(r"(?:^|-)(?:2nd|3rd|4th|5th|6th|final|part-?\d|parte-?\d|cour-?\d|season-?\d|temporada-?\d|[2-9]|ii|iii|iv|v|vi)(?:-season|-cour)?$", re.I)
_NOT_SEQUEL = re.compile(r"(movie|pelicula|ova|oad|especial|special|recap|resumen|-live|latino$)", re.I)
_ROMAN = {"ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7}
def _season_rank(slug, base):
    """Orden de temporada de un slug secuela respecto al base (base=1)."""
    if slug == base: return 1
    suf = slug[len(base):].lstrip("-").lower()
    if "final" in suf: return 89
    m = re.search(r"(\d+)", suf)
    if m: return int(m.group(1))
    for r, v in _ROMAN.items():
        if re.search(r"\b" + r + r"\b", suf): return v
    return 50
def _collect_seasons(base, slugs):
    """De una lista de slugs candidatos deja los que son SECUELAS del base, ordenados."""
    if not base: return []
    found = {base}
    for s in slugs:
        if s == base: continue
        if s.startswith(base + "-") and not _NOT_SEQUEL.search(s) and _SEASONISH.search(s[len(base):]):
            found.add(s)
    return sorted(found, key=lambda s: _season_rank(s, base))
def jk_seasons(title, base):
    if not base: return []
    slugs = set()
    for q in search_variants(title):
        h = get_text(f"https://jkanime.net/buscar/{urllib.parse.quote(q)}/")
        for m in re.findall(r'href="https://jkanime\.net/([a-z0-9-]+)/"', h):
            slugs.add(m)
    return _collect_seasons(base, slugs)
def av1_seasons(title, base):
    if not base: return []
    slugs = set()
    for q in search_variants(title):
        for u in (f"https://animeav1.com/catalogo?search={urllib.parse.quote(q)}", f"https://animeav1.com/catalogo?q={urllib.parse.quote(q)}"):
            for m in re.findall(r'/media/([a-z0-9-]+)', get_text(u)):
                slugs.add(m)
    return _collect_seasons(base, slugs)
def jk_meta(slug):
    """Poster + sinopsis desde jkanime (fallback cuando TMDB no tiene el anime)."""
    if not slug: return {}
    h = get_text(f"https://jkanime.net/{slug}/")
    poster = (re.search(r'og:image"\s+content="([^"]+)"', h) or [None, ""])[1]
    desc = (re.search(r'class="[^"]*(?:sinopsis|description|scroll)[^"]*"[^>]*>\s*([^<]{20,})', h) or [None, ""])[1]
    if not desc:
        desc = (re.search(r'og:description"\s+content="([^"]{20,})"', h) or [None, ""])[1]
    return {"poster": poster, "description": dec_ent(desc)}
def jk_max(slug):
    """Último episodio disponible en jkanime para ese slug (para animes al día)."""
    if not slug: return 0
    h = get_text(f"https://jkanime.net/{slug}/")
    nums = [int(x) for x in re.findall(re.escape(slug) + r"/(\d+)", h)]
    if nums: return max(nums)
    m = re.search(r"(\d+)\s*[Ee]pisodios", h)
    return int(m.group(1)) if m else 0
def av1_max(slug):
    if not slug: return 0
    h = get_text(f"https://animeav1.com/media/{slug}")
    nums = [int(x) for x in re.findall(re.escape(slug) + r"/(\d+)", h)]
    return max(nums) if nums else 0
def jk_servers(slug, n):
    h = get_text(f"https://jkanime.net/{slug}/{n}/")
    m = re.search(r'var\s+servers\s*=\s*(\[[\s\S]*?\]);', h)
    if not m: return None
    try: arr = json.loads(m.group(1))
    except Exception: return []
    # Conserva TODOS los servidores de jkanime (Desu, Magi, Mega, Streamwish, VOE, VidHide,
    # Mediafire, Mixdrop, Mp4upload, Doodstream…). Los nombra como jkanime los llama y
    # descarta solo los que no son una URL http real (wrappers internos sin enlace).
    out, seen = [], set()
    # 1) Players PROPIOS de jkanime (Desu, Magi) → jkanime.net/jkplayer/{um,umv}?...
    #    (se omite el tipo 'jk' porque lleva la IP del cliente y no es reutilizable).
    JKP = {"um": "Desu", "umv": "Magi"}
    for m in re.finditer(r'jkplayer/(um|umv)\?[^"\'\s<)]+', h):
        name = JKP.get(m.group(1))
        if not name or name in seen: continue
        seen.add(name); out.append({"url": "https://jkanime.net/" + m.group(0).replace("&amp;", "&"), "name": name, "lang": "Sub", "desc": ""})
    # 2) Servidores externos del array var servers.
    for s in arr:
        try: u = base64.b64decode(s.get("remote", "")).decode().strip()
        except Exception: continue
        if not u.startswith("http"): continue
        jkname = (s.get("server") or "").strip()
        known = nm(u)
        name = known if known != "Servidor" else (jkname or "Servidor")
        if name in seen: continue
        seen.add(name); out.append({"url": u, "name": name, "lang": "Sub", "desc": ""})
    return out
def av1_search(title):
    for q in search_variants(title):
        for u in (f"https://animeav1.com/catalogo?search={urllib.parse.quote(q)}", f"https://animeav1.com/catalogo?q={urllib.parse.quote(q)}"):
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

# ------------------------------------------------------------------ Construir (2 fases)
def build_meta(title, opts, log):
    """FASE 1 (rápida): metadata + imágenes. Rellena la ficha al instante."""
    log(f"== {title} ==")
    tmdb = tmdb_resolve(title, opts["tmdb_key"])
    info = tmdb_full(tmdb, opts["tmdb_key"]) if tmdb else {"title": title, "year": None, "genres": [], "description": "",
            "poster": "", "backdrop": "", "logo": "", "imdb": "", "seasons": [], "stills": {}, "altTitles": [], "creator": "", "runtime": 24}
    real_title = info["title"] or title
    imdb = info["imdb"] or imdb_suggest(real_title, info["year"])
    info["imdb"] = imdb
    # FALLBACK de imágenes/descripción: si TMDB no trae (ej. Beyblade Burst), usa jkanime.
    if not info.get("poster") or not info.get("description"):
        slug0 = (opts.get("src_slug") or "").split(",")[0].strip()
        slug0 = re.sub(r"^https?://[^/]+/(?:media/|anime/|ver/)?", "", slug0).strip("/").split("/")[0] if slug0 else jk_search(title)
        jm = jk_meta(slug0) if slug0 else {}
        if jm.get("poster") and not info.get("poster"): info["poster"] = jm["poster"]; log("imagen desde jkanime")
        if jm.get("poster") and not info.get("backdrop"): info["backdrop"] = jm["poster"]
        if jm.get("description") and not info.get("description"): info["description"] = jm["description"]
        if not info.get("title"): info["title"] = title
    real_title = info["title"] or title
    log(f"título real: {real_title} | imdb={imdb} | tmdb={tmdb} | logo={'sí' if info['logo'] else 'no'} | img={'sí' if info.get('poster') else 'no'}")
    if not tmdb: log("⚠ TMDB no resolvió el título — se usó jkanime para imagen/descripción si estaba.")
    seasons = info["seasons"] or [{"season": 1, "count": 60}]
    return {"aid": slugify(real_title), "info": info, "real_title": real_title, "seasons": seasons,
            "episodes": [], "audio": "Sub", "altTitles": info.get("altTitles", []), "creator": info.get("creator", ""), "tmdb": tmdb}

def build_movie(title, opts, log):
    """Arma una PELÍCULA de anime (1 entrada, type Película)."""
    key = opts["tmdb_key"]
    m = tmdb_movie(title, key)
    real = m["title"] or title
    imdb = m["imdb"] or imdb_movie(real, m["year"])
    aid = slugify(real)
    # fallback jkanime para imagen/descripción
    if not m["poster"] or not m["description"]:
        slug0 = (opts.get("src_slug") or "").split(",")[0].strip()
        slug0 = re.sub(r"^https?://[^/]+/(?:media/|anime/|ver/)?", "", slug0).strip("/").split("/")[0] if slug0 else jk_search(title)
        jm = jk_meta(slug0) if slug0 else {}
        if jm.get("poster") and not m["poster"]: m["poster"] = jm["poster"]
        if jm.get("poster") and not m["backdrop"]: m["backdrop"] = jm["poster"]
        if jm.get("description") and not m["description"]: m["description"] = jm["description"]
    log(f"PELÍCULA: {real} | imdb={imdb} | img={'sí' if m['poster'] else 'no'}")
    servers = []
    if opts["e69"] and imdb:
        try:
            r = embed69_movie(imdb)
            if r: servers.append(r)
        except Exception: pass
    slug = (opts.get("src_slug") or "").split(",")[0].strip()
    slug = re.sub(r"^https?://[^/]+/(?:media/|anime/|ver/)?", "", slug).strip("/").split("/")[0] if slug else None
    if opts["av1"]:
        avs = slug or av1_search(title)
        try:
            for x in (av1_servers(avs, 1) or []): servers.append(x)
        except Exception: pass
    if opts["jk"]:
        jks = slug or jk_search(title)
        try:
            for x in (jk_servers(jks, 1) or []): servers.append(x)
        except Exception: pass
    servers = prioritize(servers, opts.get("prefer"), opts.get("only"))
    dur = f"{m['runtime']} min" if m.get("runtime") else "1h 30 min"
    ep = {"number": 1, "season": "Película", "title": real, "language": "Latino" if any(s["lang"] == "Latino" for s in servers) else "Sub",
          "videoUrl": f"frame/player.html?a={aid}&s={urllib.parse.quote('Película')}&e=1",
          "img": m["backdrop"] or m["poster"], "description": m["description"], "releaseDate": "", "duration": dur, "servers": servers}
    info = {"title": real, "year": m["year"], "genres": m["genres"], "description": m["description"], "poster": m["poster"],
            "backdrop": m["backdrop"] or m["poster"], "logo": m["logo"], "imdb": imdb, "seasons": [], "stills": {}, "altTitles": [], "creator": "", "runtime": m.get("runtime", 0)}
    log(f"== película: {len(servers)} servers ==")
    return {"aid": aid, "info": info, "real_title": real, "seasons": [{"season": "Película", "count": 1}],
            "episodes": [ep], "audio": ep["language"], "altTitles": [], "creator": "", "tmdb": None, "type": "Película"}

def build_episodes(data, opts, log, prog, on_ep):
    """FASE 2 (lenta): servidores por episodio, se van mostrando en vivo."""
    info = data["info"]; imdb = info["imdb"]; seasons = data["seasons"]; aid = data["aid"]
    title = data["real_title"]
    # SLUG/URL manual de la fuente. Acepta VARIOS separados por coma (uno por temporada,
    # en orden) → así se ensamblan las SECUELAS como temporadas del mismo anime
    # (ej. beyblade-burst, beyblade-burst-god, beyblade-burst-chouzetsu…). Cada slug se
    # numera POR TEMPORADA (empiezan en ep 1).
    def _clean(s): return re.sub(r"^https?://[^/]+/(?:media/|anime/|ver/)?", "", s.strip()).strip("/").split("/")[0].split("?")[0]
    src_slugs = [_clean(x) for x in (opts.get("src_slug") or "").split(",") if x.strip()]
    multi = len(src_slugs) > 1
    jkslug = avslug = None
    if multi:
        # MANUAL: cada slug = una temporada (para franquicias con nombres arbitrarios,
        # ej. beyblade-burst, beyblade-burst-god…). Se usa el mismo slug para jk y av.
        seasons = [{"season": i + 1, "count": 400, "name": f"Temporada {i + 1}", "jk": s, "av": s, "e69s": i + 1} for i, s in enumerate(src_slugs)]
        per_season_num = True
        log(f"SECUELAS como temporadas (manual): {len(src_slugs)} → {', '.join(src_slugs)}")
    else:
        src_slug = src_slugs[0] if src_slugs else ""
        base_jk = src_slug or (jk_search(title) if opts["jk"] else "")
        base_av = src_slug or (av1_search(title) if opts["av1"] else "")
        # AUTO: descubre TODAS las secuelas (jkanime/av1 separan por temporada). Así se
        # agregan completas sin pedir slugs (ej. Ishura → ishura + ishura-2nd-season).
        jk_list = (jk_seasons(title, base_jk) if (opts["jk"] and base_jk and not src_slug) else ([base_jk] if base_jk else []))
        av_list = (av1_seasons(title, base_av) if (opts["av1"] and base_av and not src_slug) else ([base_av] if base_av else []))
        nsrc = max(len(jk_list), len(av_list))
        tmdb_seasons = list(seasons)   # estructura de TMDB (nº eps por temporada)
        if nsrc > 1:
            multi = True; per_season_num = True
            seasons = []
            for i in range(nsrc):
                jk = jk_list[i] if i < len(jk_list) else None
                av = av_list[i] if i < len(av_list) else None
                # cuenta ABIERTA (se corta sola al acabarse la fuente) → no cortar por
                # subconteo de TMDB y captar los episodios recién salidos (al día).
                e69s = tmdb_seasons[i]["season"] if i < len(tmdb_seasons) else (i + 1)
                seasons.append({"season": i + 1, "count": 400, "name": f"Temporada {i + 1}", "jk": jk, "av": av, "e69s": e69s})
            log(f"AUTO temporadas: {nsrc} (jk={jk_list} · av={av_list})")
        else:
            jkslug = base_jk or None; avslug = base_av or None
            per_season_num = bool(src_slug)
            if opts["jk"]: log(f"jkanime: {jkslug or '(no)'}" + (" [slug manual · nº por temporada]" if src_slug else ""))
            if opts["av1"]: log(f"animeav1: {avslug or '(no)'}")
    episodes = data["episodes"]
    manual = {}
    if opts["manual"]:
        for i, line in enumerate([l.strip() for l in opts["manual_text"].splitlines() if l.strip()]):
            mm = re.match(r'^(\d+)\s*\|\s*(https?://\S+)', line)
            manual[int(mm.group(1)) if mm else i + 1] = (mm.group(2) if mm else line)

    absn = 0
    total = sum(s["count"] for s in seasons) or 60
    season_sel = (opts.get("season") or "").strip()
    # CONTEO REAL POR LAS FUENTES (jkanime/animeav1) como AUTORIDAD; TMDB solo de respaldo.
    # TMDB suele estar adelantado/atrasado (ej. One Piece: TMDB 1181 vs real 1175), así que se
    # ajusta la última temporada para que el total coincida con lo que hay hoy en las fuentes.
    if not per_season_num and not season_sel:
        try:
            smax = max(jk_max(jkslug) if (opts["jk"] and jkslug) else 0, av1_max(avslug) if (opts["av1"] and avslug) else 0)
            if smax > 0 and abs(smax - total) <= 400 and seasons:   # confía en la fuente; cap anti-datos-raros
                diff = smax - total
                if diff != 0:
                    log(f"conteo por fuentes: {smax} eps hoy (TMDB decía {total}) → ajuste {'+' if diff > 0 else ''}{diff} en la última temporada")
                    seasons[-1] = {**seasons[-1], "count": max(1, seasons[-1]["count"] + diff)}
                    total = sum(s["count"] for s in seasons)
        except Exception: pass
    rng = parse_range(opts.get("range"), total)
    if season_sel: log(f"solo Temporada {season_sel}" + (f", episodios {opts.get('range')}" if rng else ""))
    elif rng: log(f"solo episodios: {sorted(rng)[:3]}…{sorted(rng)[-1]} ({len(rng)})")
    # Guardas: dejar de consultar una fuente que claramente NO tiene este anime, y terminar
    # cuando la fuente se acaba (evita construir cientos de episodios vacíos / franquicias).
    skip = {"e69": False, "av1": False, "jk": False}; miss = {"e69": 0, "av1": 0, "jk": 0}
    empty_streak = 0; stop = False
    for S in seasons:
        if stop: break
        sname = S.get("name") or (f"Temporada {S['season']}" if len(seasons) > 1 else "Temporada 1")
        jkcur = S.get("jk") or S.get("slug") or jkslug   # slug de jkanime de ESTA temporada
        avcur = S.get("av") or S.get("slug") or avslug   # slug de animeav1 de ESTA temporada
        if multi:  # cada secuela es independiente: reinicia guardas
            skip = {"e69": False, "av1": False, "jk": False}; miss = {"e69": 0, "av1": 0, "jk": 0}; empty_streak = 0
            log(f"— {sname}: jk={jkcur or '—'} av={avcur or '—'}")
        if season_sel and str(S["season"]) != season_sel:
            absn += S["count"]; continue   # salta la temporada pero mantiene el nº absoluto
        for n in range(1, S["count"] + 1):
            absn += 1; servers = []
            if rng and (n if season_sel else absn) not in rng: continue
            src_num = n if per_season_num else absn   # nº para jkanime/animeav1
            ce = ca = cj = 0
            if opts["e69"] and imdb and not skip["e69"]:
                try:
                    r = embed69_lat(imdb, S.get("e69s", S["season"]), n)
                    if r: servers.append(r); ce = 1
                except Exception as ex: log(f"  (embed69 err: {str(ex)[:40]})")
                miss["e69"] = 0 if ce else miss["e69"] + 1
                if miss["e69"] >= 6: skip["e69"] = True
                time.sleep(0.6)
            if opts["av1"] and avcur and not skip["av1"]:
                try:
                    a = av1_servers(avcur, src_num); servers += (a or []); ca = len(a or [])
                except Exception as ex: log(f"  (animeav1 err: {str(ex)[:40]})")
                miss["av1"] = 0 if ca else miss["av1"] + 1
                if miss["av1"] >= 6: skip["av1"] = True
                time.sleep(0.3)
            if opts["jk"] and jkcur and not skip["jk"]:
                try:
                    js = jk_servers(jkcur, src_num) or []; servers += js; cj = len(js)
                except Exception as ex: log(f"  (jkanime err: {str(ex)[:40]})")
                miss["jk"] = 0 if cj else miss["jk"] + 1
                if miss["jk"] >= 6: skip["jk"] = True
                time.sleep(0.3)
            if opts["manual"] and absn in manual:
                servers.append({"url": manual[absn], "name": nm(manual[absn]), "lang": "Latino", "desc": ""})
            if absn == 1 or (not servers and absn <= 3):
                log(f"  ep {absn}: embed69={ce} animeav1={ca} jkanime={cj}" + (f" · imdb={imdb} jk={jkslug} av1={avslug}" if not servers else ""))
            prog(absn, total)
            servers = prioritize(servers, opts.get("prefer"), opts.get("only"))
            if not servers:
                empty_streak += 1
                if empty_streak >= (4 if multi else 10) and not rng and not season_sel:
                    if multi:
                        log(f"  fin de {sname} — se pasa a la siguiente"); break   # siguiente secuela/temporada
                    log(f"  fin del anime (sin servers) — construidos {len(episodes)}"); stop = True; break
                continue
            empty_streak = 0
            em = info["stills"].get(f"{S['season']}x{n}", {})
            rt = em.get("runtime") or info.get("runtime") or 24
            ep = {"number": n, "season": sname, "title": em.get("title") or f"Episodio {n}",
                  "language": "Latino" if any(s["lang"] == "Latino" for s in servers) else "Sub",
                  "videoUrl": f"frame/player.html?a={aid}&s={urllib.parse.quote(sname)}&e={n}",
                  "img": em.get("still") or info["backdrop"] or info["poster"],
                  "description": em.get("overview") or "", "releaseDate": em.get("air_date") or "",
                  "duration": f"{rt} min", "servers": servers}
            episodes.append(ep)
            if on_ep: on_ep(ep)
    langs = list(dict.fromkeys(e["language"] for e in episodes))
    data["audio"] = audio_label(langs)
    log(f"== {len(episodes)} episodios == audio: {data['audio']}")
    return data

def save(data, token, replace, log):
    aid = data["aid"]; built = data["episodes"]; info = data["info"]
    if not built: log("Nada que guardar."); return
    existing = get_doc(f"animes/{aid}", token)
    if existing:  # RESPALDA el estado actual antes de tocarlo (para poder revertir)
        if backup_doc(aid, existing): log("Respaldo guardado (puedes revertir este cambio).")
    if existing and existing.get("episodes"):
        ex = existing["episodes"]
        # Al ACTUALIZAR (añadir episodios a un anime del catálogo): coloca cada episodio nuevo
        # en la temporada EXISTENTE que le corresponde por número, para no crear temporadas
        # duplicadas ("Temporada 22" junto a "Temporada 22: Elbaph"). Si el número es nuevo
        # (más reciente), usa el nombre de la temporada del episodio de mayor número.
        if data.get("_update_only") and ex:
            by_num = {}
            for e in ex:
                try: by_num[int(e.get("number"))] = e.get("season")
                except (TypeError, ValueError): pass
            last_season = None
            if by_num: last_season = by_num[max(by_num)]
            for b in built:
                # Solo se corrige el nombre GENÉRICO de TMDB ("Temporada 5"); si ya trae un
                # nombre personalizado (ej. "Temporada 22: Elbaph"), se respeta tal cual.
                if not re.match(r"^Temporada\s+\d+$", str(b.get("season", ""))): continue
                try: bn = int(b.get("number"))
                except (TypeError, ValueError): continue
                if bn in by_num: b["season"] = by_num[bn]
                elif last_season: b["season"] = last_season
        idx = {f"{e.get('season')}|{e.get('number')}": e for e in ex}
        added = replaced = 0
        for b in built:
            k = f"{b['season']}|{b['number']}"
            if k in idx:
                if replace:
                    # Al reemplazar, CONSERVA las subidas propias del usuario (Vidara/Filemoon/
                    # Streamwish subidos) — nunca se tocan sin preguntar. Se añaden las nuevas.
                    keep = [s for s in (idx[k].get("servers") or []) if re.search(r"vidara", s.get("url", ""), re.I)]
                    idx[k]["servers"] = prioritize(keep + b["servers"]); idx[k]["language"] = b["language"]
                    if b.get("img"): idx[k]["img"] = b["img"]
                    replaced += 1
            else: ex.append(b); added += 1
        episodes = ex; doc = existing
        log(f"Existente: +{added} nuevos" + (f", {replaced} reemplazados" if replace else " (no se tocó lo demás)"))
    else:
        episodes = built
        doc = {"id": aid, "title": data["real_title"], "altTitles": [], "type": data.get("type", "TV"), "audio": data["audio"],
               "status": "Finalizado", "quality": "1080p", "year": info["year"], "creator": "", "genres": info["genres"],
               "tags": [], "seasons": len(data["seasons"]), "rating": 4.4, "ratingCount": 300, "contentWarning": "",
               "description": info["description"], "img": info["poster"], "imgMobile": info["poster"],
               "heroImg": info["backdrop"], "fonImg": info["backdrop"], "logoImg": info["logo"], "trailerUrl": ""}
    # Al ACTUALIZAR un anime cargado del catálogo (añadir episodios) NO se cambia su
    # info/imágenes/título — solo se guardan los episodios. Evita duplicar y respeta lo que hay.
    if not (data.get("_update_only") and existing):
        doc["title"] = data["real_title"]; doc["img"] = info["poster"]; doc["imgMobile"] = info["poster"]
        doc["heroImg"] = info["backdrop"]; doc["fonImg"] = info["backdrop"]; doc["logoImg"] = info["logo"]
        doc["altTitles"] = data.get("altTitles", []); doc["audio"] = data.get("audio", "Sub")
        if data.get("creator"): doc["creator"] = data["creator"]
        if info.get("description") and not doc.get("description"): doc["description"] = info["description"]
    doc["episodes"] = episodes; doc["episodesTotal"] = len(episodes); doc["episodesCount"] = len(episodes)
    # Recalcula el nº de temporadas a partir de los episodios reales (corrige datos viejos,
    # ej. Mushoku Tensei que tenía "2" cuando en verdad hay 3).
    doc["seasons"] = len({e.get("season") for e in episodes if e.get("season")}) or doc.get("seasons", 1)
    st, t = patch_fields(f"animes/{aid}", doc, token)
    if st != 200: log(f"ERROR guardar: {st} {t[:150]}"); return False
    cat = get_catalog(); light = {k: v for k, v in doc.items() if k != "episodes"}
    i = next((j for j, x in enumerate(cat) if x.get("id") == aid), -1)
    if i >= 0: cat[i] = light
    else: cat.append(light)
    patch_fields("catalog/index", {"items": cat}, token)
    patch_fields("meta/catalog", {"version": int(time.time() * 1000)}, token)
    log(f"OK GUARDADO: {aid} — {len(episodes)} eps [{doc.get('audio', '')}]. Ya está en el sitio.")
    return True

# ================================================================== GUI
# Paleta moderna (dark, tono azulado + acento rojo de marca)
BG   = "#0b0d13"   # fondo general (casi negro azulado)
CARD = "#151922"   # tarjetas
CARD2= "#1b2030"   # tarjeta elevada / cabecera de sección
FIELD= "#0e1119"   # campos / inputs
LINE = "#252b39"   # bordes sutiles
TXT  = "#eef1f7"   # texto principal
MUT  = "#8b93a6"   # texto secundario
RED  = "#e11d2a"   # acento de marca
REDH = "#ff3846"   # acento hover
GRN  = "#22c55e"   # guardar / éxito
GRNH = "#34d76e"
BLUE = "#3b82f6"   # acción secundaria
BLUEH= "#5a97ff"
HEAD = "#0e1118"   # barra superior
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
        self.loaded_aid = None; self.loaded_title = ""; self._loaded_info = {}   # anime cargado del catálogo (para actualizar, no duplicar)
        self.loaded_seasons = []; self.loaded_season_by_num = {}                 # nombres/rangos reales de temporada del anime cargado
        self._tree_eps = []                                                     # episodios visibles en el listado (mapa fila→episodio)
        root.title("All-Anime Scrapper"); root.geometry("1020x780"); root.configure(bg=BG); root.minsize(900, 660)
        try:
            ip = _icon_path()
            if ip: root.iconbitmap(ip)
        except Exception: pass
        FBODY = ("Segoe UI", 10); FSMALL = ("Segoe UI", 9); FBOLD = ("Segoe UI Semibold", 10)
        s = ttk.Style(); s.theme_use("clam")
        s.configure(".", background=BG, foreground=TXT, fieldbackground=FIELD, font=FBODY)
        s.configure("Card.TFrame", background=CARD)
        s.configure("TLabel", background=CARD, foreground=TXT)
        s.configure("Mut.TLabel", background=CARD, foreground=MUT, font=FSMALL)
        s.configure("H.TLabel", background=CARD, foreground=TXT, font=("Segoe UI Semibold", 11))
        # Botones: base (neutro), acento (rojo), guardar (verde), secundario (azul)
        s.configure("TButton", background="#232838", foreground=TXT, padding=(14, 9), borderwidth=0, font=FBOLD, focuscolor=CARD)
        s.map("TButton", background=[("active", "#2e3550"), ("pressed", "#2e3550")])
        s.configure("Red.TButton", background=RED, foreground="#ffffff"); s.map("Red.TButton", background=[("active", REDH), ("pressed", REDH)])
        s.configure("Grn.TButton", background=GRN, foreground="#062b15"); s.map("Grn.TButton", background=[("active", GRNH), ("pressed", GRNH)])
        s.configure("Blue.TButton", background=BLUE, foreground="#ffffff"); s.map("Blue.TButton", background=[("active", BLUEH), ("pressed", BLUEH)])
        s.configure("Ghost.TButton", background=CARD2, foreground=MUT, padding=(10, 7)); s.map("Ghost.TButton", background=[("active", "#242a3b")], foreground=[("active", TXT)])
        s.configure("AA.Horizontal.TProgressbar", troughcolor=FIELD, bordercolor=FIELD, background=GRN, lightcolor=GRNH, darkcolor="#1aa54f", thickness=14)
        s.configure("TCheckbutton", background=CARD, foreground=TXT, focuscolor=CARD); s.map("TCheckbutton", background=[("active", CARD)])
        s.configure("TRadiobutton", background=CARD, foreground=TXT, focuscolor=CARD); s.map("TRadiobutton", background=[("active", CARD)])
        s.configure("TEntry", fieldbackground=FIELD, foreground=TXT, insertcolor=TXT, borderwidth=1, bordercolor=LINE, padding=5)
        s.map("TEntry", bordercolor=[("focus", RED)])
        s.configure("TCombobox", fieldbackground=FIELD, background=FIELD, foreground=TXT, arrowcolor=MUT, bordercolor=LINE, padding=4)
        s.map("TCombobox", fieldbackground=[("readonly", FIELD)])
        s.configure("Treeview", background=FIELD, fieldbackground=FIELD, foreground=TXT, rowheight=26, borderwidth=0, font=FSMALL)
        s.map("Treeview", background=[("selected", "#26314a")], foreground=[("selected", TXT)])
        s.configure("Treeview.Heading", background=CARD2, foreground=MUT, font=("Segoe UI Semibold", 9), borderwidth=0, padding=6)
        s.configure("Vertical.TScrollbar", background=CARD2, troughcolor=BG, bordercolor=BG, arrowcolor=MUT)

        # ---- Header (barra superior con marca + estado + cerrar sesión) ----
        hd = tk.Frame(root, bg=HEAD, height=58); hd.pack(fill="x"); hd.pack_propagate(False)
        badge = tk.Label(hd, text=" ▶ ", fg="#ffffff", bg=RED, font=("Segoe UI", 12, "bold")); badge.pack(side="left", padx=(16, 10), pady=13)
        tk.Label(hd, text="All-Anime", fg=TXT, bg=HEAD, font=("Segoe UI Semibold", 15)).pack(side="left")
        tk.Label(hd, text="Scrapper", fg=MUT, bg=HEAD, font=("Segoe UI", 12)).pack(side="left", padx=(6, 0))
        self.logout_btn = ttk.Button(hd, text="Cerrar sesión", style="Ghost.TButton", command=self.logout)
        self.status = tk.Label(hd, text="●  Sin sesión", fg="#ffcf7a", bg=HEAD, font=("Segoe UI Semibold", 10)); self.status.pack(side="right", padx=16)

        # Log FIJO abajo
        self.logbox = tk.Text(root, bg="#0a0a0c", fg="#c8c8d0", height=6, font=("Consolas", 9), relief="flat")
        self.logbox.pack(side="bottom", fill="x", padx=14, pady=(0, 12))
        # Área DESPLAZABLE (scroll) con todo el contenido
        outer = tk.Frame(root, bg=BG); outer.pack(fill="both", expand=True)
        canvas = tk.Canvas(outer, bg=BG, highlightthickness=0)
        vsb = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y"); canvas.pack(side="left", fill="both", expand=True)
        _inner = tk.Frame(canvas, bg=BG)
        _win = canvas.create_window((0, 0), window=_inner, anchor="nw")
        _inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(_win, width=e.width))
        self._canvas = canvas
        # Rueda del ratón: desplaza la página. Antes de desplazar cierra cualquier desplegable
        # abierto (así no queda "flotando") y evita que la rueda sobre un combo cambie su valor.
        canvas.bind_all("<MouseWheel>", self._wheel)
        root.bind_class("TCombobox", "<MouseWheel>", self._wheel)
        body = tk.Frame(_inner, bg=BG); body.pack(fill="both", expand=True, padx=14, pady=12)

        def card(parent):
            c = tk.Frame(parent, bg=CARD, highlightbackground=LINE, highlightthickness=1); return c
        def head(c, t, sub=None):
            hf = tk.Frame(c, bg=CARD); hf.pack(fill="x", padx=16, pady=(14, 8))
            tk.Frame(hf, bg=RED, width=4, height=18).pack(side="left", padx=(0, 10))
            box = tk.Frame(hf, bg=CARD); box.pack(side="left", fill="x")
            tk.Label(box, text=t, bg=CARD, fg=TXT, font=("Segoe UI Semibold", 11)).pack(anchor="w")
            if sub: tk.Label(box, text=sub, bg=CARD, fg=MUT, font=("Segoe UI", 9)).pack(anchor="w")

        # Config card (login + tmdb)
        cf = card(body); cf.pack(fill="x")
        head(cf, "Cuenta y ajustes", "Tu sesión y la TMDB API key quedan guardadas en este equipo.")
        row = tk.Frame(cf, bg=CARD); row.pack(fill="x", padx=16, pady=(0, 14))
        ttk.Label(row, text="Correo admin", style="Mut.TLabel").grid(row=0, column=0, sticky="w"); ttk.Label(row, text="Contraseña", style="Mut.TLabel").grid(row=0, column=1, sticky="w", padx=(8, 0))
        ttk.Label(row, text="TMDB API key (opcional, para logo)", style="Mut.TLabel").grid(row=0, column=2, sticky="w", padx=(8, 0))
        self.email = ttk.Entry(row, width=26); self.email.grid(row=1, column=0, sticky="w", pady=(2, 0)); self.email.insert(0, self.cfg.get("email", ""))
        self.pw = ttk.Entry(row, width=18, show="•"); self.pw.grid(row=1, column=1, padx=(8, 0), pady=(2, 0)); self.pw.insert(0, _deobf(self.cfg.get("pw", "")))
        self.tmdb = ttk.Entry(row, width=30); self.tmdb.grid(row=1, column=2, padx=(8, 0), pady=(2, 0)); self.tmdb.insert(0, self.cfg.get("tmdb_key", ""))
        self.login_btn = ttk.Button(row, text="Iniciar sesión", style="Red.TButton", command=self.login); self.login_btn.grid(row=1, column=3, padx=(10, 0))
        self.remember = tk.BooleanVar(value=bool(self.cfg.get("pw")))
        ttk.Checkbutton(row, text="Recordar sesión", variable=self.remember).grid(row=1, column=4, padx=(10, 0))

        # Search card
        sc = card(body); sc.pack(fill="x", pady=(12, 0))
        head(sc, "Agregar o editar anime", "Carga uno de tu catálogo para actualizarlo, o escribe un título nuevo.")
        # Catálogo existente (para editar info, reparar servers o añadir episodios).
        # Buscador + lista con scroll PROPIO (evita el bug del antiguo desplegable, que se
        # descolocaba al hacer scroll porque la rueda movía también el fondo).
        cr = tk.Frame(sc, bg=CARD); cr.pack(fill="x", padx=16, pady=(0, 4))
        ttk.Label(cr, text="Buscar en tu catálogo:", style="Mut.TLabel").pack(side="left")
        self.cat_search = ttk.Entry(cr, width=34); self.cat_search.pack(side="left", padx=6)
        self.cat_search.bind("<KeyRelease>", self._filter_catalog)
        self.load_btn = ttk.Button(cr, text="Cargar", command=self.load_from_catalog, state="disabled"); self.load_btn.pack(side="left")
        self.addnew_btn = ttk.Button(cr, text="➕ Añadir episodios nuevos", style="Blue.TButton", command=self.do_add_new, state="disabled"); self.addnew_btn.pack(side="left", padx=(8, 0))
        self.cat_count = ttk.Label(cr, text="", style="Mut.TLabel"); self.cat_count.pack(side="left", padx=(8, 0))
        lf = tk.Frame(sc, bg=CARD); lf.pack(fill="x", padx=16, pady=(0, 8))
        self.cat_list = tk.Listbox(lf, height=5, bg=FIELD, fg=TXT, selectbackground="#26314a", selectforeground=TXT,
                                   relief="flat", highlightthickness=1, highlightbackground=LINE, font=("Segoe UI", 9), activestyle="none")
        clsb = ttk.Scrollbar(lf, orient="vertical", command=self.cat_list.yview); self.cat_list.configure(yscrollcommand=clsb.set)
        clsb.pack(side="right", fill="y"); self.cat_list.pack(side="left", fill="x", expand=True)
        self.cat_list.bind("<Double-1>", lambda e: self.load_from_catalog())
        # la rueda sobre la lista la desplaza a ELLA (no al fondo) → sin descolocarse
        self.cat_list.bind("<MouseWheel>", lambda e: (self.cat_list.yview_scroll(int(-1 * (e.delta / 120)), "units"), "break")[1])
        sr = tk.Frame(sc, bg=CARD); sr.pack(fill="x", padx=16, pady=(2, 0))
        self.title = ttk.Entry(sr, font=("Segoe UI", 12)); self.title.pack(side="left", fill="x", expand=True, ipady=3)
        self.kind = ttk.Combobox(sr, values=["Auto", "Serie", "Película"], width=9, state="readonly"); self.kind.set("Auto"); self.kind.pack(side="left", padx=(8, 0))
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
        self.prefer = ttk.Entry(pr, width=48); self.prefer.pack(side="left", padx=6)
        self.prefer.insert(0, "Filemoon, Streamwish, Vidara, PelisPlus, HLS, Desu, VidHide")
        self.only = tk.BooleanVar(value=False); ttk.Checkbutton(pr, text="solo estos", variable=self.only).pack(side="left")
        rg = tk.Frame(sc, bg=CARD); rg.pack(fill="x", padx=14, pady=(0, 8))
        ttk.Label(rg, text="Temporada:", style="Mut.TLabel").pack(side="left")
        self.seasonf = ttk.Entry(rg, width=5); self.seasonf.pack(side="left", padx=(4, 10))
        ttk.Label(rg, text="Episodios a agregar (ej: 5-12 · vacío = todos):", style="Mut.TLabel").pack(side="left")
        self.rangef = ttk.Entry(rg, width=16); self.rangef.pack(side="left", padx=6)
        ttk.Button(rg, text="Detectar faltantes", style="Ghost.TButton", command=self.detect_missing).pack(side="left")
        # Temporada DESTINO (nombre personalizado, ej. "Temporada 22: Elbaph"). Se llena con
        # los nombres reales del anime al cargarlo; editable para crear una temporada nueva.
        dr = tk.Frame(sc, bg=CARD); dr.pack(fill="x", padx=14, pady=(0, 8))
        ttk.Label(dr, text="Temporada destino (para «Añadir episodios nuevos»):", style="Mut.TLabel").pack(side="left")
        self.dest_season = ttk.Combobox(dr, width=34, values=["(automática por número)"]); self.dest_season.set("(automática por número)")
        self.dest_season.pack(side="left", padx=6)
        ttk.Label(dr, text="↳ respeta nombres como «Temporada 22: Elbaph»", style="Mut.TLabel").pack(side="left")
        sg = tk.Frame(sc, bg=CARD); sg.pack(fill="x", padx=14, pady=(0, 8))
        ttk.Label(sg, text="Slug(s) de la fuente (opcional · varios por coma = secuelas como temporadas):").pack(side="left")
        self.srcslug = ttk.Entry(sg, width=44); self.srcslug.pack(side="left", padx=6)
        ttk.Label(sg, text="↳ ej: beyblade-burst, beyblade-burst-god, beyblade-burst-chouzetsu", style="Mut.TLabel").pack(side="left")
        self.manbox = tk.Frame(sc, bg=CARD)
        ttk.Label(self.manbox, text="URLs manuales (N|URL por línea)", style="Mut.TLabel").pack(anchor="w", padx=14)
        self.mantext = tk.Text(self.manbox, height=3, bg="#101015", fg=TXT, insertbackground=TXT, relief="flat"); self.mantext.pack(fill="x", padx=14, pady=(0, 8))

        # Preview card (anime editable + episodes)
        pv = card(body); pv.pack(fill="both", expand=True, pady=(12, 0))
        head(pv, "Vista previa", "Todo es editable · doble clic en un episodio para cambiar su imagen.")
        af = tk.Frame(pv, bg=CARD); af.pack(fill="x", padx=14)
        self.f_title = self._field(af, "Título", 0); self.f_year = self._field(af, "Año", 1, w=8)
        self.f_alt = self._field(af, "Títulos alternativos (coma)", 2)
        ttk.Label(af, text="Audio", style="Mut.TLabel").grid(row=3, column=0, sticky="w", pady=2)
        self.f_audio = ttk.Combobox(af, values=AUDIOS, width=16, state="readonly"); self.f_audio.grid(row=3, column=1, sticky="w", padx=8, pady=2); self.f_audio.set("Sub")
        self.f_creator = self._field(af, "Estudio/Creador", 4)
        self.f_poster = self._field(af, "Portada (img)", 5, w=40); self.f_back = self._field(af, "Fondo (heroImg)", 6, w=40)
        self.f_logo = self._field(af, "Logo (logoImg)", 7, w=40)
        pgrow = tk.Frame(pv, bg=CARD); pgrow.pack(fill="x", padx=14, pady=8)
        self.bar = ttk.Progressbar(pgrow, style="AA.Horizontal.TProgressbar"); self.bar.pack(side="left", fill="x", expand=True)
        self.count_lbl = ttk.Label(pgrow, text="0 episodios", style="Mut.TLabel"); self.count_lbl.pack(side="left", padx=10)
        # Navegador de TEMPORADAS: se llena con las temporadas del anime; al elegir una, el
        # listado de abajo muestra solo esa temporada y pasa a ser la temporada destino.
        svrow = tk.Frame(pv, bg=CARD); svrow.pack(fill="x", padx=14, pady=(0, 4))
        ttk.Label(svrow, text="Ver temporada:", style="Mut.TLabel").pack(side="left")
        self.season_view = ttk.Combobox(svrow, width=32, state="readonly", values=["Todas"]); self.season_view.set("Todas")
        self.season_view.pack(side="left", padx=6)
        self.season_view.bind("<<ComboboxSelected>>", self.on_season_view)
        self.season_info = ttk.Label(svrow, text="", style="Mut.TLabel"); self.season_info.pack(side="left", padx=8)
        tw = tk.Frame(pv, bg=CARD); tw.pack(fill="both", expand=True, padx=14)
        # selectmode extended → puedes marcar VARIOS episodios (Ctrl/Shift+clic) para repararlos.
        self.tree = ttk.Treeview(tw, columns=("t", "img", "srv"), show="headings", height=9, selectmode="extended")
        tvsb = ttk.Scrollbar(tw, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tvsb.set)
        for c, txt, w in [("t", "Título", 240), ("img", "Imagen", 120), ("srv", "Servidores", 320)]:
            self.tree.heading(c, text=txt); self.tree.column(c, width=w)
        tvsb.pack(side="right", fill="y"); self.tree.pack(side="left", fill="both", expand=True)
        self.tree.bind("<Double-1>", self.edit_episode)
        # La rueda sobre el listado lo desplaza a ÉL (no al scroll general).
        self.tree.bind("<MouseWheel>", lambda e: (self.tree.yview_scroll(int(-1 * (e.delta / 120)), "units"), "break")[1])
        # Barra de REPARACIÓN MANUAL por selección (marca uno o varios episodios arriba)
        rr = tk.Frame(pv, bg=CARD); rr.pack(fill="x", padx=14, pady=(8, 0))
        ttk.Label(rr, text="Seleccionados:", style="Mut.TLabel").pack(side="left")
        ttk.Button(rr, text="➕ Agregar Latino", style="Blue.TButton", command=lambda: self.repair_selected("latino")).pack(side="left", padx=(6, 0))
        ttk.Button(rr, text="🔧 Reparar servers", command=lambda: self.repair_selected("servers")).pack(side="left", padx=6)
        ttk.Button(rr, text="🖼 Reparar imagen", command=lambda: self.repair_selected("image")).pack(side="left")
        ttk.Label(rr, text="  (marca uno o varios con Ctrl/Shift+clic · siempre pregunta antes)", style="Mut.TLabel").pack(side="left", padx=8)
        bb = tk.Frame(pv, bg=CARD); bb.pack(fill="x", padx=14, pady=10)
        self.save_btn = ttk.Button(bb, text="Guardar en la web", style="Grn.TButton", command=self.do_save, state="disabled"); self.save_btn.pack(side="left")
        ttk.Button(bb, text="🖼 Reparar imágenes", command=self.do_fix_images).pack(side="left", padx=10)
        ttk.Button(bb, text="↶ Revertir último cambio", command=self.do_revert).pack(side="left", padx=10)
        ttk.Button(bb, text="🧹 Limpiar", style="Ghost.TButton", command=self.do_clear).pack(side="left", padx=10)
        ttk.Label(bb, text="  (aplica lo que edites arriba)", style="Mut.TLabel").pack(side="left")

    def _field(self, parent, label, r, w=None):
        ttk.Label(parent, text=label, style="Mut.TLabel").grid(row=r, column=0, sticky="w", pady=2)
        e = ttk.Entry(parent, width=w or 60); e.grid(row=r, column=1, sticky="we", padx=8, pady=2); parent.columnconfigure(1, weight=1)
        return e

    def toggle_manual(self):
        if self.man.get(): self.manbox.pack(fill="x", pady=(0, 6))
        else: self.manbox.pack_forget()
    def _wheel(self, e):
        """Desplaza la página con la rueda; cierra desplegables abiertos y evita que la rueda
        sobre un combobox cambie su valor (submenús ya no quedan flotando)."""
        try:
            w = self.root.focus_get()
            if isinstance(w, ttk.Combobox): w.event_generate("<Escape>")
        except Exception: pass
        try: self._canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
        except Exception: pass
        return "break"

    def log(self, m): self.logbox.insert("end", m + "\n"); self.logbox.see("end"); self.root.update_idletasks()
    def prog(self, n, t): self.bar["maximum"] = t; self.bar["value"] = n; self.root.update_idletasks()

    def _auto_login(self):
        """Inicia sesión sola al abrir si hay credenciales recordadas."""
        if self.token: return
        if self.cfg.get("email") and _deobf(self.cfg.get("pw", "")):
            self.log("Sesión recordada — iniciando sesión…")
            self.login(silent=True)

    def logout(self):
        self.token = None
        self.cfg.pop("pw", None); save_cfg(self.cfg)
        self.remember.set(False)
        self.status.config(text="●  Sin sesión", fg="#ffcf7a")
        self.logout_btn.pack_forget()
        for b in (self.build_btn, self.save_btn, self.load_btn, self.addnew_btn):
            try: b.config(state="disabled")
            except Exception: pass
        try: self.cat_list.delete(0, "end"); self.cat_count.config(text="")
        except Exception: pass
        self.log("Sesión cerrada. (La contraseña recordada se borró de este equipo.)")

    def login(self, silent=False):
        try:
            self.token = sign_in(self.email.get().strip(), self.pw.get())
            key = self.tmdb.get().strip()
            self.cfg.update(email=self.email.get().strip(), tmdb_key=key)
            # Recordar sesión: guarda la contraseña ofuscada (o la borra si se desmarca).
            if self.remember.get(): self.cfg["pw"] = _obf(self.pw.get())
            else: self.cfg.pop("pw", None)
            save_cfg(self.cfg)
            self.logout_btn.pack(side="right", padx=(0, 6), pady=13)
            self.status.config(text="●  Sesión iniciada", fg="#7ee0a3"); self.build_btn.config(state="normal")
            # Valida la TMDB API key para que sepas que la está usando.
            if key:
                def chk():
                    ok = False
                    try: ok = bool((get_json(f"https://api.themoviedb.org/3/configuration?api_key={key}") or {}).get("images"))
                    except Exception: ok = False
                    self.root.after(0, lambda: self.log("TMDB API key: " + ("✅ válida (logo y datos completos activados)" if ok else "❌ inválida — revisa que sea la 'Llave API (v3)'")))
                threading.Thread(target=chk, daemon=True).start()
            else:
                self.log("Sin TMDB API key: se llenarán título/imágenes/servidores, pero NO el logo ni el detalle por episodio.")
            # Carga el catálogo de la web para el selector (elegir un anime existente).
            def loadcat():
                try:
                    cat = get_catalog()
                    self._catalog = sorted(cat, key=lambda x: (x.get("title") or "").lower())
                    self.root.after(0, lambda: (self._filter_catalog(),
                                                self.load_btn.config(state="normal"),
                                                self.log(f"Catálogo cargado: {len(self._catalog)} animes (escribe arriba para buscar).")))
                except Exception as e: self.root.after(0, lambda: self.log("No se pudo cargar el catálogo: " + str(e)))
            threading.Thread(target=loadcat, daemon=True).start()
        except Exception as e:
            self.token = None
            self.status.config(text="●  Sin sesión", fg="#ff9a9a")
            if silent: self.log("No se pudo iniciar sesión automáticamente: " + str(e))
            else: messagebox.showerror("Login", str(e))

    def _filter_catalog(self, ev=None):
        if not hasattr(self, "_catalog"): return
        q = self.cat_search.get().strip().lower()
        self._filtered = [c for c in self._catalog
                          if (not q) or q in (c.get("title") or "").lower() or q in (c.get("id") or "").lower()]
        self.cat_list.delete(0, "end")
        for c in self._filtered:
            self.cat_list.insert("end", f"{c.get('title')}   ·   {c.get('id')}")
        self.cat_count.config(text=f"{len(self._filtered)} de {len(self._catalog)}")

    def load_from_catalog(self):
        if not self.token: return
        # Toma el anime seleccionado en la lista; si no hay selección pero el buscador dejó
        # una sola coincidencia, usa esa. El texto es "Título   ·   id" → el id es real.
        sel = None
        cur = self.cat_list.curselection()
        if cur: sel = self.cat_list.get(cur[0])
        elif len(getattr(self, "_filtered", [])) == 1:
            c = self._filtered[0]; sel = f"{c.get('title')}   ·   {c.get('id')}"
        if not sel:
            messagebox.showinfo("Cargar", "Busca y selecciona un anime de la lista."); return
        aid = sel.split("·")[-1].strip()
        self.log(f"Cargando '{aid}' del catálogo…")
        def work():
            try:
                d = get_doc(f"animes/{aid}", self.token)
                if not d: self.log("No se encontró el anime en la base."); return
                eps = d.get("episodes") or []
                seasons_names = list(dict.fromkeys(e.get("season") for e in eps if e.get("season")))
                # Recuerda los nombres REALES de temporada y el rango de nº de cada una
                # (para colocar/mostrar los episodios nuevos en «Temporada 22: Elbaph», etc.).
                self.loaded_seasons = seasons_names
                self.loaded_season_by_num = {}
                for e in eps:
                    try: self.loaded_season_by_num[int(e.get("number"))] = e.get("season")
                    except (TypeError, ValueError): pass
                info = {"title": d.get("title", ""), "year": d.get("year"), "genres": d.get("genres", []),
                        "description": d.get("description", ""), "poster": d.get("img", ""), "backdrop": d.get("heroImg", d.get("fonImg", "")),
                        "logo": d.get("logoImg", ""), "imdb": "", "seasons": [], "stills": {}, "altTitles": d.get("altTitles", []),
                        "creator": d.get("creator", ""), "runtime": 24}
                self.data = {"aid": aid, "info": info, "real_title": d.get("title", aid),
                             "seasons": [{"season": s, "count": 0} for s in seasons_names], "episodes": list(eps),
                             "audio": d.get("audio", "Sub"), "altTitles": d.get("altTitles", []), "creator": d.get("creator", ""), "tmdb": None}
                # Recuerda el anime cargado → al construir se ACTUALIZA este (no se duplica).
                self.loaded_aid = aid; self.loaded_title = d.get("title", ""); self._loaded_info = dict(info)
                def show():
                    self.title.delete(0, "end"); self.title.insert(0, d.get("title", ""))
                    self.render_meta()
                    self.update_season_view(select="Todas")   # muestra la LISTA COMPLETA al cargar
                    if not self._tree_eps and eps:            # red de seguridad: nunca dejar la lista vacía
                        self.refresh_tree(None)
                    self.save_btn.config(state="normal"); self.addnew_btn.config(state="normal")
                    ordered = self._distinct_seasons()
                    self.log(f"Cargado: {d.get('title')} — {len(eps)} episodios · {len(ordered)} temporada(s): {', '.join(ordered[:6])}{'…' if len(ordered) > 6 else ''}")
                    self.log("Lista completa cargada; en «Ver temporada» puedes filtrar por temporada.")
                self.root.after(0, show)
            except Exception as e: self.log("ERROR cargar: " + str(e))
        threading.Thread(target=work, daemon=True).start()

    def do_add_new(self):
        """Añade SOLO episodios nuevos al anime cargado del catálogo — conserva la lista
        existente y no crea duplicados. Es el botón dedicado a 'un episodio se estrenó'."""
        if not self.loaded_aid or not self.data or not self.data.get("episodes"):
            messagebox.showinfo("Añadir episodios nuevos",
                "Primero carga el anime desde «Del catálogo» → Cargar.\n\n"
                "Este botón suma los episodios nuevos SIN borrar ni cambiar lo que ya tiene.")
            return
        rng = self.rangef.get().strip()
        if not rng:
            if not messagebox.askyesno("Añadir episodios nuevos",
                    "No indicaste qué episodios agregar.\n\nPuedes pulsar «Detectar faltantes» para rellenarlo, "
                    "o continuar para buscar TODOS y añadir solo los que falten.\n\n¿Continuar de todos modos?"):
                return
        self.do_build(add_only=True)

    def do_build(self, add_only=False):
        t = self.title.get().strip()
        if not t or not self.token: return
        if add_only and not self.loaded_aid:
            messagebox.showinfo("Añadir episodios nuevos", "Carga primero el anime del catálogo."); return
        self.cfg["tmdb_key"] = self.tmdb.get().strip(); save_cfg(self.cfg)
        self.build_btn.config(state="disabled"); self.save_btn.config(state="disabled"); self.addnew_btn.config(state="disabled")
        # En modo "añadir episodios" NO se borra la lista existente (se conserva a la vista);
        # en modo construir normal, se limpia para reconstruir desde cero.
        existing_eps = []
        if add_only:
            existing_eps = list(self.data.get("episodes") or [])
            self.replace.set(False)  # añadir episodios NUNCA reemplaza lo existente
        else:
            self.clear_tree()
        self.logbox.delete("1.0", "end")
        opts = {"e69": self.e69.get(), "av1": self.av1.get(), "jk": self.jk.get(), "manual": self.man.get(),
                "manual_text": self.mantext.get("1.0", "end"), "prefer": self.prefer.get().split(","),
                "only": self.only.get(), "tmdb_key": self.tmdb.get().strip(), "range": self.rangef.get().strip(),
                "season": self.seasonf.get().strip(), "src_slug": self.srcslug.get().strip()}
        kind = self.kind.get()
        # ¿Actualizar el anime cargado del catálogo? (mismo título, o modo añadir) → NO duplicar.
        updating = add_only or bool(self.loaded_aid and t == self.loaded_title)
        def _keep_loaded(keep_eps=False):
            self.data["aid"] = self.loaded_aid
            self.data["real_title"] = self.loaded_title
            for k in ("poster", "backdrop", "logo"):
                if self._loaded_info.get(k): self.data["info"][k] = self._loaded_info[k]
            self.data["_update_only"] = True   # save() solo añade episodios, no cambia la info
            if keep_eps:  # conserva los episodios ya cargados y AÑADE los nuevos encima
                self.data["episodes"] = list(existing_eps)
            self.log(f"Actualizando '{self.loaded_aid}' (no se crea duplicado).")
        def work():
            try:
                is_movie = (kind == "Película") or (kind == "Auto" and guess_kind(t) == "movie")
                if is_movie:
                    self.log("Detectado: PELÍCULA de anime")
                    self.data = build_movie(t, opts, self.log)
                    if updating: _keep_loaded()
                    self.root.after(0, self.render_meta)
                    for e in self.data["episodes"]:
                        self.root.after(0, lambda ep=e: self.add_ep_row(ep))
                    self.root.after(0, self.after_episodes)
                    return
                # FASE 1: metadata → rellena la ficha AL INSTANTE
                self.data = build_meta(t, opts, self.log)
                if updating: _keep_loaded(keep_eps=add_only)
                self.root.after(0, self.render_meta)
                # FASE 2: episodios en vivo (en modo añadir, se APILAN sobre los existentes)
                nbefore = len(self.data.get("episodes") or [])
                build_episodes(self.data, opts, self.log, self.prog,
                               on_ep=lambda ep: self.root.after(0, lambda e=ep: self.add_ep_row(e)))
                if add_only:
                    self.root.after(0, lambda: self._finish_add(nbefore))
                else:
                    self.root.after(0, self.after_episodes)
            except Exception as e:
                self.log("ERROR: " + str(e))
            finally:
                self.root.after(0, lambda: (self.build_btn.config(state="normal"),
                                            self.addnew_btn.config(state="normal" if self.loaded_aid else "disabled")))
        threading.Thread(target=work, daemon=True).start()

    def _finish_add(self, nbefore):
        """Tras «Añadir episodios nuevos»: pone el NOMBRE de temporada correcto a los
        episodios recién creados (destino elegido, o el nombre real que ya usa ese número,
        o la última temporada) y refresca la lista para mostrarlo tal cual se guardará."""
        eps = self.data.get("episodes") or []
        new_eps = eps[nbefore:]
        dest = self.dest_season.get().strip()
        custom = bool(dest) and not dest.startswith("(autom")
        for e in new_eps:
            try: num = int(e.get("number"))
            except (TypeError, ValueError): num = None
            if custom: e["season"] = dest
            elif num is not None and num in self.loaded_season_by_num: e["season"] = self.loaded_season_by_num[num]
            elif self.loaded_seasons: e["season"] = self.loaded_seasons[-1]
            # el videoUrl codifica el nombre de temporada → mantenerlo en sintonía
            e["videoUrl"] = f"frame/player.html?a={self.loaded_aid}&s={urllib.parse.quote(str(e.get('season', '')))}&e={e.get('number')}"
        # muestra la temporada donde entraron los episodios nuevos
        target = new_eps[-1].get("season") if new_eps else "auto"
        self.f_audio.set(self.data.get("audio", "Sub"))
        self.update_season_view(select=target)
        self.save_btn.config(state="normal" if eps else "disabled")
        dst = f"«{dest}»" if custom else "temporada asignada por número"
        self.log(f"➕ {len(new_eps)} episodio(s) nuevo(s) → {dst}. Revisa y pulsa «Guardar en la web».")

    def render_meta(self):
        """Rellena la ficha del anime en cuanto llega la metadata (rápido)."""
        info = self.data["info"]
        for e, val in [(self.f_title, self.data["real_title"]), (self.f_year, info.get("year") or ""),
                       (self.f_alt, ", ".join(self.data.get("altTitles", []))), (self.f_creator, self.data.get("creator", "")),
                       (self.f_poster, info["poster"]), (self.f_back, info["backdrop"]), (self.f_logo, info["logo"])]:
            e.delete(0, "end"); e.insert(0, str(val))
        self.f_audio.set(self.data.get("audio", "Sub"))
        if not info["logo"]: self.log("Sin logo (pon una TMDB API key para traerlo, o pégalo en el campo Logo).")
        if not info["poster"]: self.log("⚠ Sin imágenes de TMDB — revisa el título o usa la TMDB API key.")

    def clear_tree(self):
        for i in self.tree.get_children(): self.tree.delete(i)
        self._tree_eps = []

    def add_ep_row(self, e):
        """Añade una fila y recuerda a qué episodio corresponde (para editarlo/filtrarlo)."""
        srv = ", ".join(f"{s['name']}({s['lang'][:3]})" for s in e["servers"])
        iid = str(len(self._tree_eps))
        self.tree.insert("", "end", iid=iid, text="",
                         values=(f"{e['season']} · E{e['number']} · {e['title']}", "sí" if e["img"] else "—", srv))
        self._tree_eps.append(e)
        total = len(self.data.get("episodes", [])) if self.data else len(self._tree_eps)
        self.count_lbl.config(text=(f"{len(self._tree_eps)} de {total} episodios" if len(self._tree_eps) != total else f"{total} episodios"))
        self.save_btn.config(state="normal")

    @staticmethod
    def _season_key(s):
        """Orden natural de temporadas: 'Temporada 2' antes que 'Temporada 10'."""
        nums = re.findall(r"\d+", str(s))
        return (int(nums[0]) if nums else 9999, str(s))

    def _distinct_seasons(self):
        eps = (self.data or {}).get("episodes") or []
        return sorted({e.get("season") for e in eps if e.get("season")}, key=self._season_key)

    def update_season_view(self, select="auto"):
        """Rellena el navegador con TODAS las temporadas del anime (cualquier formato:
        «Temporada N», «Season N» o nombre personalizado) y renderiza una selección.
        select: 'auto' (última temporada si hay varias), 'Todas', o un nombre de temporada."""
        seasons = self._distinct_seasons()
        counts = {}
        for e in (self.data or {}).get("episodes") or []:
            s = e.get("season")
            if s: counts[s] = counts.get(s, 0) + 1
        vals = [f"Todas ({sum(counts.values())})"] + [f"{s}  ({counts.get(s, 0)})" for s in seasons]
        self.season_view.config(values=vals)
        self.season_info.config(text=(f"{len(seasons)} temporada(s)" if seasons else ""))
        # sincroniza también el selector de temporada DESTINO con los nombres reales
        self.dest_season.config(values=["(automática por número)"] + seasons)
        # decide qué mostrar: por defecto la ÚLTIMA temporada (como el sitio; además evita
        # dibujar cientos de filas de golpe en animes enormes como One Piece).
        if select == "auto":
            sel = seasons[-1] if len(seasons) >= 2 else None
        elif select in ("Todas", None):
            sel = None
        else:
            sel = select if select in seasons else (seasons[-1] if seasons else None)
        if sel is None:
            self.season_view.set(vals[0]); self.refresh_tree(None)
        else:
            self.season_view.set(f"{sel}  ({counts.get(sel, 0)})"); self.dest_season.set(sel); self.refresh_tree(sel)

    def _current_season_sel(self):
        sel = self.season_view.get()
        if not sel or sel.startswith("Todas"): return "Todas"
        return re.sub(r"\s*\(\d+\)\s*$", "", sel)

    def on_season_view(self, ev=None):
        """Al elegir una temporada: filtra el listado y la fija como temporada destino."""
        sel = self.season_view.get()
        if sel.startswith("Todas"):
            self.dest_season.set("(automática por número)")
            self.refresh_tree(None)
        else:
            name = re.sub(r"\s*\(\d+\)\s*$", "", sel)   # quita el " (N)" del final
            self.dest_season.set(name)
            self.refresh_tree(name)

    def refresh_tree(self, season=None):
        """Redibuja el listado; si `season` no es None, muestra solo esa temporada."""
        self.clear_tree()
        for e in (self.data or {}).get("episodes") or []:
            if season is None or e.get("season") == season:
                self.add_ep_row(e)

    def after_episodes(self):
        self.f_audio.set(self.data.get("audio", "Sub"))
        self.update_season_view(select="Todas")
        self.save_btn.config(state="normal" if self.data["episodes"] else "disabled")
        if not self.data["episodes"]: self.log("No se encontraron servidores. Revisa fuentes/título.")

    def do_clear(self, silent=False):
        """Deja la app lista para otra operación sin arrastrar el estado anterior (evita
        conflictos). Se puede llamar a mano con «🧹 Limpiar» o automático tras guardar."""
        self.data = None
        self.loaded_aid = None; self.loaded_title = ""; self._loaded_info = {}
        self.loaded_seasons = []; self.loaded_season_by_num = {}
        self.clear_tree()
        for e in (self.f_title, self.f_year, self.f_alt, self.f_creator, self.f_poster, self.f_back, self.f_logo,
                  self.title, self.rangef, self.seasonf, self.srcslug):
            try: e.delete(0, "end")
            except Exception: pass
        self.f_audio.set("Sub"); self.kind.set("Auto")
        self.season_view.config(values=["Todas"]); self.season_view.set("Todas"); self.season_info.config(text="")
        self.dest_season.config(values=["(automática por número)"]); self.dest_season.set("(automática por número)")
        self.bar["value"] = 0; self.count_lbl.config(text="0 episodios")
        try: self.cat_search.delete(0, "end"); self._filter_catalog()
        except Exception: pass
        self.save_btn.config(state="disabled"); self.addnew_btn.config(state="disabled")
        if not silent: self.log("🧹 Limpio. Listo para cargar/buscar otro anime.")

    def detect_missing(self):
        """Compara lo que existe en la web con lo que TMDB dice que hay → rellena el rango con los faltantes."""
        t = self.title.get().strip()
        if not t or not self.token: messagebox.showwarning("Faltantes", "Escribe el título e inicia sesión."); return
        self.log("Detectando episodios faltantes…")
        def work():
            try:
                key = self.tmdb.get().strip()
                # La ESTRUCTURA de temporadas (cuántos episodios hay) se resuelve SIEMPRE en
                # TMDB: el anime cargado del catálogo trae count=0 y nombres personalizados,
                # que no sirven para contar. El id, en cambio, es el del anime cargado.
                meta = build_meta(t, {"tmdb_key": key, "src_slug": self.srcslug.get().strip()}, self.log)
                aid = self.loaded_aid or meta["aid"]
                seasons = [dict(s) for s in meta["seasons"]]
                season_sel = self.seasonf.get().strip()
                # CONTEO REAL POR LAS FUENTES (jkanime/animeav1) = autoridad; TMDB de respaldo.
                # Ajusta (sube o BAJA) el total para que coincida con lo que hay hoy en las
                # fuentes (ej. One Piece: fuentes 1175, TMDB 1181 → se usa 1175).
                tmdb_total = sum(s["count"] for s in seasons)
                if not season_sel and seasons:
                    slug = (self.srcslug.get().strip() or "")
                    slug = re.sub(r"^https?://[^/]+/(?:media/|anime/|ver/)?", "", slug).strip("/").split("/")[0].split("?")[0] if slug else ""
                    jks = slug or (jk_search(meta["real_title"]) if self.jk.get() else "")
                    avs = slug or (av1_search(meta["real_title"]) if self.av1.get() else "")
                    smax = max(jk_max(jks) if jks else 0, av1_max(avs) if avs else 0)
                    if smax > 0 and abs(smax - tmdb_total) <= 400:
                        diff = smax - tmdb_total
                        seasons[-1]["count"] = max(1, seasons[-1]["count"] + diff)
                        self.log(f"conteo por fuentes: {smax} eps hoy (TMDB decía {tmdb_total})")
                # claves = número de episodio (absoluto, o por temporada si se fijó una)
                keymap = {}; absn = 0
                for S in seasons:
                    for n in range(1, S["count"] + 1):
                        absn += 1
                        if season_sel and str(S["season"]) != season_sel: continue
                        keymap[n if season_sel else absn] = n
                # Lo que YA existe se compara POR NÚMERO (ignora el nombre de temporada, que
                # puede ser personalizado como «Temporada 22: Elbaph») → así no marca como
                # faltantes los 1174 que One Piece ya tiene.
                existing = get_doc(f"animes/{aid}", self.token)
                have = set()
                if existing and existing.get("episodes"):
                    for e in existing["episodes"]:
                        try: have.add(int(e.get("number")))
                        except (TypeError, ValueError): pass
                missing = sorted(k for k in keymap if k not in have)
                # compacta a rangos: 117,118,...125 → "117-125"
                parts, i = [], 0
                while i < len(missing):
                    j = i
                    while j + 1 < len(missing) and missing[j + 1] == missing[j] + 1: j += 1
                    parts.append(str(missing[i]) if i == j else f"{missing[i]}-{missing[j]}"); i = j + 1
                txt = ", ".join(parts)
                scope = f"Temporada {season_sel}" if season_sel else "todo"
                def fill():
                    self.rangef.delete(0, "end"); self.rangef.insert(0, txt)
                    self.log(f"[{scope}] TMDB tiene {len(keymap)} · faltan {len(missing)}: {txt or 'ninguno'}")
                self.root.after(0, fill)
            except Exception as e:
                self.log("ERROR detectar: " + str(e))
        threading.Thread(target=work, daemon=True).start()

    def do_revert(self):
        if not self.token: messagebox.showwarning("Revertir", "Inicia sesión primero."); return
        aid = slugify((self.f_title.get().strip() or self.title.get().strip()))
        if not aid: messagebox.showwarning("Revertir", "Escribe/construye primero el anime a revertir."); return
        bk = latest_backup(aid)
        if not bk: messagebox.showinfo("Revertir", f"No hay respaldo de '{aid}'.\n(Se crea uno cada vez que guardas.)"); return
        n = len(bk.get("episodes", []))
        if not messagebox.askyesno("Revertir", f"¿Restaurar '{bk.get('title', aid)}' al estado anterior?\n({n} episodios). Esto deshace el último cambio."): return
        def work():
            try:
                st, t = patch_fields(f"animes/{aid}", bk, self.token)
                if st != 200: self.log(f"ERROR revertir: {st} {t[:120]}"); return
                cat = get_catalog(); light = {k: v for k, v in bk.items() if k != "episodes"}
                i = next((j for j, x in enumerate(cat) if x.get("id") == aid), -1)
                if i >= 0: cat[i] = light
                else: cat.append(light)
                patch_fields("catalog/index", {"items": cat}, self.token)
                patch_fields("meta/catalog", {"version": int(time.time() * 1000)}, self.token)
                self.log(f"↶ REVERTIDO: {aid} restaurado ({n} episodios).")
            except Exception as e: self.log("ERROR revertir: " + str(e))
        threading.Thread(target=work, daemon=True).start()

    def _ensure_sources(self):
        """Resuelve y cachea imdb + slugs de jkanime/animeav1 + stills de TMDB para el anime
        actual (necesario para reparar/agregar servidores o imágenes por episodio)."""
        if self.data.get("_src_ready"): return
        title = self.data.get("real_title") or self.title.get().strip()
        key = self.tmdb.get().strip()
        info = self.data.get("info") or {}
        imdb = info.get("imdb")
        stills = info.get("stills") or {}
        tmdb = self.data.get("tmdb")
        if not imdb or not stills:
            tmdb = tmdb or tmdb_resolve(title, key)
            full = tmdb_full(tmdb, key) if tmdb else {}
            imdb = imdb or full.get("imdb") or imdb_suggest(title)
            if full.get("stills"): stills = full["stills"]; info["stills"] = stills
            if full.get("seasons"): info["seasons"] = full["seasons"]   # para los patrones de embed69
            info["imdb"] = imdb; self.data["tmdb"] = tmdb; self.data["info"] = info
        slug = (self.srcslug.get().strip() or "")
        slug = re.sub(r"^https?://[^/]+/(?:media/|anime/|ver/)?", "", slug).strip("/").split("/")[0].split("?")[0] if slug else ""
        self.data["_jkslug"] = slug or (jk_search(title) if self.jk.get() else "")
        self.data["_avslug"] = slug or (av1_search(title) if self.av1.get() else "")
        self.data["_src_ready"] = True
        self.log(f"Fuentes: imdb={imdb or '—'} jk={self.data['_jkslug'] or '—'} av1={self.data['_avslug'] or '—'}")

    def _fetch_ep_servers(self, ep):
        """Trae los servidores de un episodio concreto desde TODAS las fuentes activas
        (embed69/pelisplushd, animeav1, jkanime). Prueba varios patrones de código de embed69
        porque cada anime numera distinto (1x{absoluto} tipo One Piece, o {temporada}x{nº})."""
        imdb = (self.data.get("info") or {}).get("imdb"); jks = self.data.get("_jkslug"); avs = self.data.get("_avslug")
        try: num = int(ep.get("number"))
        except (TypeError, ValueError): return []
        servers = []; ce = ca = cj = 0
        if self.e69.get() and imdb:
            cands = [(1, num)]                                   # One Piece y continuos: 1x{absoluto}
            m = re.search(r"(\d+)", str(ep.get("season", "")))
            if m and int(m.group(1)) != 1: cands.append((int(m.group(1)), num))   # {temporada}x{nº}
            for S in (self.data.get("info") or {}).get("seasons", []):            # temporadas conocidas de TMDB
                c = (S.get("season"), num)
                if c not in cands: cands.append(c)
            for s, n in cands:
                try:
                    r = embed69_lat(imdb, s, n)
                    if r: servers.append(r); ce = 1; break
                except Exception: pass
                time.sleep(0.3)
        if self.av1.get() and avs:
            try: a = av1_servers(avs, num) or []; servers += a; ca = len(a)
            except Exception: pass
        if self.jk.get() and jks:
            try: j = jk_servers(jks, num) or []; servers += j; cj = len(j)
            except Exception: pass
        lat = sum(1 for s in servers if s.get("lang") == "Latino")
        self.log(f"  E{num}: embed69={ce} av1={ca} jk={cj} · Latino={lat}" + ("" if servers else f"  (imdb={imdb or '—'} jk={jks or '—'} av1={avs or '—'})"))
        return servers

    def repair_selected(self, mode):
        """Repara/añade en los episodios MARCADOS del listado. mode: 'latino' | 'servers' | 'image'.
        Siempre pide confirmación y nunca borra las subidas propias (Vidara)."""
        if not self.data or not self.data.get("episodes"):
            messagebox.showinfo("Reparar selección", "Primero carga o construye un anime."); return
        iids = self.tree.selection()
        eps = []
        for iid in iids:
            try: eps.append(self._tree_eps[int(iid)])
            except (IndexError, ValueError): pass
        if not eps:
            messagebox.showinfo("Reparar selección", "Marca uno o varios episodios en el listado (Ctrl/Shift+clic)."); return
        labels = {"latino": "AGREGAR Latino a", "servers": "REPARAR (reemplazar) servers de", "image": "REPARAR imagen/título de"}
        msg = f"{labels[mode]} {len(eps)} episodio(s) seleccionados."
        if mode == "servers": msg += "\n\n(Se conservan tus subidas de Vidara; se reemplazan los demás por los de las fuentes.)"
        if mode == "latino": msg += "\n\n(Solo AÑADE pistas en Latino; no toca nada de lo existente.)"
        if not messagebox.askyesno("Confirmar", msg + "\n\n¿Continuar?"): return
        self.log(f"{labels[mode]} {len(eps)} episodio(s)…")
        def work():
            try:
                if mode != "image": self._ensure_sources()
                elif not (self.data.get("info") or {}).get("stills"): self._ensure_sources()
                stills = (self.data.get("info") or {}).get("stills") or {}
                changed = 0
                for ep in eps:
                    if mode == "image":
                        sm = re.search(r"(\d+)", str(ep.get("season", "1"))); s = sm.group(1) if sm else "1"
                        st = stills.get(f"{s}x{ep.get('number')}") or stills.get(f"1x{ep.get('number')}")
                        if st and st.get("still"):
                            ep["img"] = st["still"]; changed += 1
                            if not ep.get("title") or re.match(r"(?i)^episodio?\s*\d+$", str(ep.get("title", ""))): ep["title"] = st.get("title") or ep["title"]
                            if not ep.get("description"): ep["description"] = st.get("overview", "")
                        continue
                    found = self._fetch_ep_servers(ep)
                    if mode == "latino":
                        lat = [s for s in found if s.get("lang") == "Latino"]
                        have = {(s.get("name"), s.get("url")) for s in (ep.get("servers") or [])}
                        add = [s for s in lat if (s.get("name"), s.get("url")) not in have]
                        if add:
                            ep["servers"] = prioritize((ep.get("servers") or []) + add, self.prefer.get().split(","))
                            if not re.search(r"latino|dob", ep.get("language", ""), re.I):
                                ep["language"] = "Sub | Dob" if ep.get("language") else "Latino"
                            changed += 1
                    else:  # servers → reemplaza conservando Vidara
                        if found:
                            keep = [s for s in (ep.get("servers") or []) if re.search(r"vidara", s.get("url", ""), re.I)]
                            ep["servers"] = prioritize(keep + found, self.prefer.get().split(","), self.only.get())
                            ep["language"] = "Latino" if any(s["lang"] == "Latino" for s in ep["servers"]) else "Sub"
                            changed += 1
                self.root.after(0, lambda: (self.update_season_view(select=self._current_season_sel()),
                                            self.log(f"✅ {changed}/{len(eps)} episodio(s) actualizados. Revisa y pulsa «Guardar en la web».")))
            except Exception as e:
                self.log("ERROR reparar selección: " + str(e))
        threading.Thread(target=work, daemon=True).start()

    def do_fix_images(self):
        if not self.data or not self.data.get("episodes"):
            messagebox.showinfo("Reparar imágenes", "Primero carga o construye un anime."); return
        key = self.tmdb.get().strip()
        self.log("Reparando imágenes/descripciones de episodios desde TMDB…")
        def work():
            try:
                tmdb = self.data.get("tmdb") or tmdb_resolve(self.data["real_title"], key)
                info = tmdb_full(tmdb, key) if tmdb else {"stills": {}}
                stills = info.get("stills", {})
                if not stills:
                    self.log("TMDB no tiene stills por episodio (necesitas la TMDB API key). Usa doble clic para poner imágenes a mano."); return
                fixed = 0
                for e in self.data["episodes"]:
                    sm = re.search(r"(\d+)", str(e.get("season", "1"))); s = sm.group(1) if sm else "1"
                    st = stills.get(f"{s}x{e['number']}")
                    if st and st.get("still"):
                        e["img"] = st["still"]; fixed += 1
                        if not e.get("title") or str(e["title"]).startswith("Episodio "): e["title"] = st.get("title") or e["title"]
                        if not e.get("description"): e["description"] = st.get("overview", "")
                def refresh():
                    self.update_season_view(select=self._current_season_sel())
                    self.log(f"Imágenes/descripciones reparadas: {fixed} episodios. Ajusta alguna con doble clic. Pulsa Guardar para aplicar.")
                self.root.after(0, refresh)
            except Exception as e: self.log("ERROR reparar imágenes: " + str(e))
        threading.Thread(target=work, daemon=True).start()

    def edit_episode(self, ev):
        iid = self.tree.focus()
        if not iid or not self.data: return
        try: ep = self._tree_eps[int(iid)]   # mapea la fila visible al episodio real (respeta el filtro)
        except (IndexError, ValueError): return
        new = simpledialog.askstring("Editar imagen del episodio", f"E{ep['number']} — URL de la imagen:", initialvalue=ep["img"], parent=self.root)
        if new is not None:
            ep["img"] = new.strip()
            self.tree.set(iid, "img", "sí" if ep["img"] else "—")

    def do_save(self):
        if not self.data: return
        if self.replace.get():
            if not messagebox.askyesno("Reemplazar enlaces",
                    "Modo REEMPLAZAR: cambiará los servidores de los episodios que coincidan.\n"
                    "(Se conservan tus subidas de Vidara.)\n\n¿Continuar?"):
                return
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
            ok = False
            try: ok = bool(save(self.data, self.token, self.replace.get(), self.log))
            except Exception as e: self.log("ERROR guardar: " + str(e))
            finally:
                if ok:
                    # se guardó bien → limpia para no arrastrar estado y evitar conflictos
                    self.root.after(0, lambda: (self.do_clear(silent=True),
                                                self.log("✅ Guardado y limpiado. Listo para el siguiente.")))
                else:
                    self.root.after(0, lambda: self.save_btn.config(state="normal"))
        threading.Thread(target=work, daemon=True).start()

if __name__ == "__main__":
    r = tk.Tk(); app = App(r)
    r.after(400, app._auto_login)   # inicia sesión sola si hay credenciales recordadas
    r.mainloop()
