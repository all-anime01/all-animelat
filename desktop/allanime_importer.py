#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
All-Anime — Importador de escritorio (v2)
=========================================
App nativa (sin navegador, sin CORS) que hace lo mismo que el asistente al agregar un
anime: resuelve metadata + imágenes y extrae los servidores por episodio de varias
fuentes, muestra una VISTA PREVIA, y guarda directo en tu Firebase (Firestore).

Fuentes:
  - embed69  (Latino)  = el catálogo de animeonline.ninja ya decodificado.
  - animeav1 (Latino "DUB" + Sub) = Mega / HLS / MP4Upload.
  - jkanime  (Sub)     = Mega / StreamWish / VOE / VidHide / Streamtape.
  - Manual             = pegas tú las URLs (N|URL por línea).

Modos:
  - Solo añadir lo nuevo (no toca nada existente).
  - Reemplazar enlaces (REPARAR rotos): cambia los servidores de los episodios que
    vuelvas a construir. Úsalo cuando un anime tenga enlaces caídos.

USO
---
1) Instala Python 3 (python.org, marca "Add Python to PATH"). No hace falta nada más.
2) Doble clic en este archivo, o:  python allanime_importer.py
3) Inicia sesión con tu cuenta de ADMIN.
4) Escribe el título, elige fuentes → "Construir (vista previa)".
5) Revisa la lista → "Guardar en la web".

Para .EXE:  pip install pyinstaller
   pyinstaller --onefile --noconsole --name AllAnimeImporter allanime_importer.py
"""

import json, re, base64, urllib.request, urllib.parse, urllib.error, threading, time, ssl, unicodedata
import tkinter as tk
from tkinter import ttk, messagebox

API_KEY = "AIzaSyDJMJcwFvQCAfp9mXcCvxCQpX-6wy-a4FA"
PROJECT = "all-anime-eae5b"
FS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
_SSL = ssl.create_default_context(); _SSL.check_hostname = False; _SSL.verify_mode = ssl.CERT_NONE

# ------------------------------------------------------------------ HTTP
def http(url, data=None, headers=None, referer=None, method=None, timeout=25):
    h = {"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9"}
    if referer: h["Referer"] = referer
    if headers: h.update(headers)
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8"); h["Content-Type"] = "application/json"
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
def best(cands, title):
    if not cands: return None
    want = norm(title)
    def sc(c):
        cn = norm(c.replace("-", " ").replace("/", " "))
        if cn == want: return 100
        if cn.startswith(want) or want.startswith(cn): return 70
        ws = set(want.split()); return len([w for w in cn.split() if w in ws])
    return sorted(cands, key=sc, reverse=True)[0]

# ------------------------------------------------------------------ TMDB / IMDB
def imdb_resolve(title, year=None):
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

def tmdb_search(title):
    t = get_text(f"https://www.themoviedb.org/search/tv?query={urllib.parse.quote(title)}")
    m = re.search(r'href="/tv/(\d+)', t); return m.group(1) if m else None

def tmdb_meta(tv):
    h = get_text(f"https://www.themoviedb.org/tv/{tv}?language=es-ES")
    poster = re.search(r'property="og:image" content="[^"]*/([A-Za-z0-9]{16,})\.(?:jpg|png)', h)
    bd = get_text(f"https://www.themoviedb.org/tv/{tv}/images/backdrops")
    backdrop = re.search(r'image\.tmdb\.org/t/p/[a-z0-9_]+/([A-Za-z0-9]{20,})\.jpg', bd)
    desc = re.search(r'<div class="overview">\s*<p>([^<]+)</p>', h)
    genres = list(dict.fromkeys(re.findall(r'/genre/\d+[^"]*"[^>]*>([^<]+)<', h)))[:5]
    yr = re.search(r"<title>[^(]*\((\d{4})", h)
    return {"poster": f"https://image.tmdb.org/t/p/w500/{poster.group(1)}.jpg" if poster else "",
            "backdrop": f"https://image.tmdb.org/t/p/w1280/{backdrop.group(1)}.jpg" if backdrop else "",
            "description": dec_ent(desc.group(1)) if desc else "",
            "genres": [dec_ent(g) for g in genres], "year": int(yr.group(1)) if yr else None}

def tmdb_stills(tv, maxs=8):
    flat, seasons = {}, []
    for s in range(1, maxs + 1):
        h = get_text(f"https://www.themoviedb.org/tv/{tv}/season/{s}?language=es-ES")
        chunks = re.split(r'id="episode_[0-9a-f]+"', h)[1:]
        if not chunks:
            if s > 1: break
            continue
        seasons.append({"season": s, "count": len(chunks)})
        for i, c in enumerate(chunks):
            im = re.search(r'(?:media\.themoviedb\.org|image\.tmdb\.org)/t/p/[a-z0-9_]+/([A-Za-z0-9]{16,})\.', c)
            ti = re.search(r'<div class="episode_title">\s*<h3>\s*<a[^>]*>([^<]+)</a>', c)
            flat[f"{s}x{i+1}"] = {"still": f"https://image.tmdb.org/t/p/w500/{im.group(1)}.jpg" if im else "",
                                  "title": dec_ent(ti.group(1)) if ti else ""}
        time.sleep(0.2)
    return flat, seasons

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
    """Ordena por preferencia de host y deja máx 3 por idioma.
    prefer = lista de nombres en orden (ej. ['Mega','Streamwish']). only=True → solo esos."""
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
    for k in g:
        arr = sorted(g[k], key=rank)
        out += arr[:3]
    return out
def cap3(servers): return prioritize(servers)

def embed69_lat(imdb, s, e):
    code = f"{imdb}-{s}x{str(e).zfill(2)}"
    h = get_text(f"https://embed69.org/f/{code}/", referer="https://pelisplushd.bz/")
    m = re.search(r'dataLink\s*=\s*(\[[\s\S]*?\]);', h)
    if not m: return None
    try:
        dl = json.loads(m.group(1))
    except Exception:
        return None
    if any(g.get("video_language") in ("LAT", "ESP") for g in dl) or dl:
        return {"url": f"https://embed69.org/f/{code}/", "name": "PelisPlus", "lang": "Latino", "desc": "Audio Latino"}
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
    rank = {"Mega": 0, "Streamwish": 1, "VOE": 2, "VidHide": 3, "Filemoon": 4, "Streamtape": 5}
    out.sort(key=lambda x: rank.get(x["name"], 9)); return out[:3]

def av1_search(title):
    for u in (f"https://animeav1.com/catalogo?search={urllib.parse.quote(title)}", f"https://animeav1.com/catalogo?q={urllib.parse.quote(title)}"):
        h = get_text(u)
        c = list(dict.fromkeys(re.findall(r'/media/([a-z0-9-]+)', h)))
        if c: return best(c, title)
    return None
def av1_servers(slug, n):
    h = get_text(f"https://animeav1.com/media/{slug}/{n}")
    if "no encontr" in h.lower() and len(h) < 3000: return None
    res = []
    blk = re.search(r'embeds:\{([\s\S]*?\})\s*,\s*[a-zA-Z]+:', h) or re.search(r'embeds:\{([\s\S]*?)\}\}', h)
    raw = blk.group(0) if blk else h
    for lang, tag in (("DUB", "Latino"), ("SUB", "Sub")):
        seg = re.search(lang + r':\[([\s\S]*?)\]', raw)
        if not seg: continue
        seen = set()
        for m in re.finditer(r'server:"([^"]+)",url:"([^"]+)"', seg.group(1)):
            url = m.group(2)
            name = nm(url) if nm(url) != "Servidor" else (m.group(1) if m.group(1) != "HLS" else "AnimeAV1 HD")
            if name in seen: continue
            seen.add(name); res.append({"url": url, "name": name, "lang": tag, "desc": ""})
    return res

# ------------------------------------------------------------------ Construir (sin guardar)
def build(title, opts, log, prog):
    log(f"== {title} ==")
    imdb = imdb_resolve(title); tmdb = tmdb_search(title)
    log(f"imdb={imdb}  tmdb={tmdb}")
    meta = tmdb_meta(tmdb) if tmdb else {"genres": [], "description": "", "poster": "", "backdrop": "", "year": None}
    flat, seasons = tmdb_stills(tmdb) if tmdb else ({}, [])
    if not seasons: seasons = [{"season": 1, "count": int(opts.get("count") or 60)}]
    aid = slugify(title)
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
            absn += 1
            servers = []
            if opts["e69"] and imdb:
                r = embed69_lat(imdb, S["season"], n)
                if r: servers.append(r)
                time.sleep(0.85)
            if opts["av1"] and avslug:
                a = av1_servers(avslug, absn)
                if a is None and absn > total: break
                for x in (a or []): servers.append(x)
                time.sleep(0.35)
            if opts["jk"] and jkslug:
                for x in (jk_servers(jkslug, absn) or []): servers.append(x)
                time.sleep(0.3)
            if opts["manual"] and absn in manual:
                servers.append({"url": manual[absn], "name": nm(manual[absn]), "lang": opts.get("manual_lang", "Latino"), "desc": ""})
            prog(absn, total)
            servers = prioritize(servers, opts.get("prefer"), opts.get("only"))
            if not servers:
                log(f"  ep {absn} (S{S['season']}E{n}): sin servers"); continue
            em = flat.get(f"{S['season']}x{n}", {})
            episodes.append({"number": n, "season": sname, "title": em.get("title") or f"Episodio {n}",
                             "language": "Latino" if any(s["lang"] == "Latino" for s in servers) else "Sub",
                             "videoUrl": f"frame/player.html?a={aid}&s={urllib.parse.quote(sname)}&e={n}",
                             "img": em.get("still") or meta["backdrop"] or meta["poster"], "description": "",
                             "duration": "24 min", "servers": servers})
    log(f"== construidos {len(episodes)} episodios ==")
    return {"aid": aid, "title": title, "meta": meta, "seasons": seasons, "episodes": episodes}

def save(data, token, replace, log):
    aid = data["aid"]; built = data["episodes"]; meta = data["meta"]
    if not built: log("Nada que guardar."); return
    existing = get_doc(f"animes/{aid}", token)
    if existing and existing.get("episodes"):
        ex = existing["episodes"]
        idx = {f"{e.get('season')}|{e.get('number')}": e for e in ex}
        added = replaced = 0
        for b in built:
            k = f"{b['season']}|{b['number']}"
            if k in idx:
                if replace:
                    idx[k]["servers"] = b["servers"]; idx[k]["language"] = b["language"]; replaced += 1
            else:
                ex.append(b); idx[k] = b; added += 1
        episodes = ex
        log(f"Anime existente: +{added} nuevos" + (f", {replaced} con enlaces REEMPLAZADOS" if replace else " (no se tocó lo existente)"))
        doc = existing
    else:
        episodes = built
        langs = list(dict.fromkeys(e["language"] for e in episodes))
        doc = {"id": aid, "title": data["title"], "altTitles": [], "type": "TV", "audio": " | ".join(langs),
               "status": "Finalizado", "quality": "1080p", "year": meta["year"], "creator": "",
               "genres": meta["genres"], "tags": [], "seasons": len(data["seasons"]), "rating": 4.4, "ratingCount": 300,
               "contentWarning": "", "description": meta["description"], "img": meta["poster"], "imgMobile": meta["poster"],
               "heroImg": meta["backdrop"], "fonImg": meta["backdrop"], "logoImg": "", "trailerUrl": ""}
    langs = list(dict.fromkeys(e["language"] for e in episodes))
    doc["episodes"] = episodes; doc["episodesTotal"] = len(episodes); doc["episodesCount"] = len(episodes); doc["audio"] = " | ".join(langs)
    st, t = patch_fields(f"animes/{aid}", doc, token)
    if st != 200: log(f"ERROR guardar: {st} {t[:150]}"); return
    cat = get_catalog(); light = {k: v for k, v in doc.items() if k != "episodes"}
    i = next((j for j, x in enumerate(cat) if x.get("id") == aid), -1)
    if i >= 0: cat[i] = light
    else: cat.append(light)
    patch_fields("catalog/index", {"items": cat}, token)
    patch_fields("meta/catalog", {"version": int(time.time() * 1000)}, token)
    log(f"OK GUARDADO: {aid} — {len(episodes)} episodios [{' | '.join(langs)}]. Ya está en el sitio.")

# ------------------------------------------------------------------ GUI
class App:
    def __init__(self, root):
        self.root = root; self.token = None; self.data = None
        root.title("All-Anime — Importador"); root.geometry("820x680"); root.configure(bg="#141414")
        s = ttk.Style(); s.theme_use("clam")
        s.configure("TButton", background="#e0231f", foreground="#fff", padding=7, font=("Segoe UI", 10, "bold"))
        s.configure("G.TButton", background="#1f9d55"); s.configure("TLabel", background="#141414", foreground="#eaeaea", font=("Segoe UI", 10))
        s.configure("TCheckbutton", background="#141414", foreground="#eaeaea"); s.configure("TRadiobutton", background="#141414", foreground="#eaeaea")
        s.configure("Treeview", background="#0e0e0e", fieldbackground="#0e0e0e", foreground="#ddd", rowheight=22)
        top = tk.Frame(root, bg="#141414"); top.pack(fill="x", padx=14, pady=(12, 2))
        ttk.Label(top, text="Correo admin").grid(row=0, column=0, sticky="w"); ttk.Label(top, text="Contraseña").grid(row=0, column=1, sticky="w")
        self.email = tk.Entry(top, width=28); self.email.grid(row=1, column=0, padx=(0, 8))
        self.pw = tk.Entry(top, width=20, show="•"); self.pw.grid(row=1, column=1, padx=(0, 8))
        ttk.Button(top, text="Iniciar sesión", command=self.login).grid(row=1, column=2)
        self.status = ttk.Label(root, text="Inicia sesión para empezar.", foreground="#ffcf7a"); self.status.pack(anchor="w", padx=14)
        f = tk.Frame(root, bg="#141414"); f.pack(fill="x", padx=14, pady=8)
        ttk.Label(f, text="Título del anime").pack(anchor="w")
        self.title = tk.Entry(f, font=("Segoe UI", 11)); self.title.pack(fill="x", pady=3)
        src = tk.Frame(f, bg="#141414"); src.pack(anchor="w", pady=3)
        self.e69 = tk.BooleanVar(value=True); self.av1 = tk.BooleanVar(value=True); self.jk = tk.BooleanVar(value=True); self.man = tk.BooleanVar(value=False)
        ttk.Checkbutton(src, text="embed69 (Latino / animeonlineninja)", variable=self.e69).grid(row=0, column=0, sticky="w", padx=(0, 12))
        ttk.Checkbutton(src, text="animeav1 (Latino+Sub)", variable=self.av1).grid(row=0, column=1, sticky="w", padx=(0, 12))
        ttk.Checkbutton(src, text="jkanime (Sub)", variable=self.jk).grid(row=0, column=2, sticky="w", padx=(0, 12))
        ttk.Checkbutton(src, text="Manual", variable=self.man, command=self.toggle_manual).grid(row=0, column=3, sticky="w")
        self.manbox = tk.Frame(f, bg="#141414")
        ttk.Label(self.manbox, text="URLs manuales (una por línea: N|URL)").pack(anchor="w")
        self.mantext = tk.Text(self.manbox, height=3, bg="#0e0e0e", fg="#ddd"); self.mantext.pack(fill="x")
        pf = tk.Frame(f, bg="#141414"); pf.pack(anchor="w", pady=3, fill="x")
        ttk.Label(pf, text="Prioridad de servidores (coma, ej: Mega, Streamwish, VOE)").pack(anchor="w")
        prow = tk.Frame(pf, bg="#141414"); prow.pack(anchor="w", fill="x")
        self.prefer = tk.Entry(prow, width=48); self.prefer.pack(side="left", pady=2)
        self.only = tk.BooleanVar(value=False)
        ttk.Checkbutton(prow, text="Usar SOLO estos", variable=self.only).pack(side="left", padx=10)
        mode = tk.Frame(f, bg="#141414"); mode.pack(anchor="w", pady=4)
        self.replace = tk.BooleanVar(value=False)
        ttk.Radiobutton(mode, text="Solo añadir lo nuevo", variable=self.replace, value=False).pack(side="left", padx=(0, 14))
        ttk.Radiobutton(mode, text="Reemplazar enlaces (reparar rotos)", variable=self.replace, value=True).pack(side="left")
        btns = tk.Frame(f, bg="#141414"); btns.pack(anchor="w", pady=4)
        self.build_btn = ttk.Button(btns, text="Construir (vista previa)", command=self.do_build, state="disabled"); self.build_btn.pack(side="left", padx=(0, 8))
        self.save_btn = ttk.Button(btns, text="Guardar en la web", style="G.TButton", command=self.do_save, state="disabled"); self.save_btn.pack(side="left")
        self.bar = ttk.Progressbar(root); self.bar.pack(fill="x", padx=14, pady=3)
        # Vista previa
        pv = tk.Frame(root, bg="#141414"); pv.pack(fill="both", expand=True, padx=14, pady=(4, 2))
        self.tree = ttk.Treeview(pv, columns=("t", "srv"), show="tree headings", height=9)
        self.tree.heading("#0", text="Ep"); self.tree.column("#0", width=60)
        self.tree.heading("t", text="Título"); self.tree.column("t", width=300)
        self.tree.heading("srv", text="Servidores (idioma)"); self.tree.column("srv", width=360)
        self.tree.pack(fill="both", expand=True)
        self.logbox = tk.Text(root, bg="#0a0a0a", fg="#cfcfcf", height=7, font=("Consolas", 9), relief="flat")
        self.logbox.pack(fill="x", padx=14, pady=(4, 12))

    def toggle_manual(self):
        if self.man.get(): self.manbox.pack(fill="x", pady=3)
        else: self.manbox.pack_forget()
    def log(self, m): self.logbox.insert("end", m + "\n"); self.logbox.see("end"); self.root.update_idletasks()
    def prog(self, n, t): self.bar["maximum"] = t; self.bar["value"] = n; self.root.update_idletasks()
    def login(self):
        try:
            self.token = sign_in(self.email.get().strip(), self.pw.get())
            self.status.config(text="✅ Sesión iniciada.", foreground="#9fd89f"); self.build_btn.config(state="normal")
        except Exception as e: messagebox.showerror("Login", str(e))
    def do_build(self):
        t = self.title.get().strip()
        if not t or not self.token: return
        self.build_btn.config(state="disabled"); self.save_btn.config(state="disabled")
        for i in self.tree.get_children(): self.tree.delete(i)
        self.logbox.delete("1.0", "end")
        opts = {"e69": self.e69.get(), "av1": self.av1.get(), "jk": self.jk.get(), "manual": self.man.get(),
                "manual_text": self.mantext.get("1.0", "end"), "manual_lang": "Latino", "count": 0,
                "prefer": self.prefer.get().split(","), "only": self.only.get()}
        def work():
            try:
                self.data = build(t, opts, self.log, self.prog)
                self.root.after(0, self.render)
            except Exception as e:
                self.log("ERROR: " + str(e))
            finally:
                self.root.after(0, lambda: self.build_btn.config(state="normal"))
        threading.Thread(target=work, daemon=True).start()
    def render(self):
        for e in self.data["episodes"]:
            srv = ", ".join(f"{s['name']}({s['lang'][:3]})" for s in e["servers"])
            self.tree.insert("", "end", text=f"{e['season'][-1]}·{e['number']}", values=(e["title"], srv))
        self.save_btn.config(state="normal" if self.data["episodes"] else "disabled")
    def do_save(self):
        if not self.data: return
        self.save_btn.config(state="disabled")
        def work():
            try: save(self.data, self.token, self.replace.get(), self.log)
            except Exception as e: self.log("ERROR guardar: " + str(e))
            finally: self.root.after(0, lambda: self.save_btn.config(state="normal"))
        threading.Thread(target=work, daemon=True).start()

if __name__ == "__main__":
    r = tk.Tk(); App(r); r.mainloop()
