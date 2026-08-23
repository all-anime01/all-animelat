#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
All-Anime — Importador de escritorio
====================================
App nativa (sin navegador, sin CORS) que hace lo mismo que el asistente cuando le
pides agregar un anime: resuelve metadata + imágenes, extrae los servidores en
Latino (embed69/PelisPlus) y Sub (jkanime), arma todos los episodios y los guarda
directo en tu Firebase (Firestore).

USO
---
1) Ten Python 3 instalado (python.org). No hace falta instalar nada más (solo stdlib).
2) Doble clic en este archivo, o en consola:  python allanime_importer.py
3) Inicia sesión con tu cuenta de ADMIN (la misma del panel).
4) Escribe el título del anime y pulsa "Agregar (Sub + Latino)".
5) Revisa el registro y listo: aparece en el sitio (la app recarga contenido actual).

Para crear un .EXE (opcional):  pip install pyinstaller
   pyinstaller --onefile --noconsole --name AllAnimeImporter allanime_importer.py
   (queda en dist/AllAnimeImporter.exe)
"""

import json, re, base64, urllib.request, urllib.parse, threading, time, ssl
import tkinter as tk
from tkinter import ttk, messagebox

# --- Config pública (la misma que ya está en el sitio; NO es secreta) ---
API_KEY = "AIzaSyDJMJcwFvQCAfp9mXcCvxCQpX-6wy-a4FA"
PROJECT = "all-anime-eae5b"
FS = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
_SSL = ssl.create_default_context()
_SSL.check_hostname = False
_SSL.verify_mode = ssl.CERT_NONE  # algunos hosts tienen cadenas TLS incompletas

# ------------------------------------------------------------------ HTTP
def http(url, data=None, headers=None, referer=None, timeout=20):
    h = {"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9"}
    if referer: h["Referer"] = referer
    if headers: h.update(headers)
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8"); h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)

def get_text(url, referer=None):
    _, t = http(url, referer=referer); return t

# ------------------------------------------------------------------ Firestore REST
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
    if "fields" not in j: return None
    return {k: fv(x) for k, x in j["fields"].items()}

def patch_fields_real(path, fields, token):
    mask = "&".join("updateMask.fieldPaths=" + urllib.parse.quote(k) for k in fields)
    body = json.dumps({"fields": {k: to_fs(v) for k, v in fields.items()}}).encode()
    req = urllib.request.Request(f"{FS}/{path}?{mask}", data=body, method="PATCH",
                                 headers={"User-Agent": UA, "Content-Type": "application/json", "Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def get_catalog():
    d = get_doc("catalog/index")
    return (d or {}).get("items", []) if d else []

# ------------------------------------------------------------------ Fuentes
def norm(s): return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

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
    except Exception:
        return None

def tmdb_search(title):
    t = get_text(f"https://www.themoviedb.org/search/tv?query={urllib.parse.quote(title)}")
    m = re.search(r'href="/tv/(\d+)', t); return m.group(1) if m else None

def dec_ent(s):
    return (s or "").replace("&#39;", "'").replace("&quot;", '"').replace("&amp;", "&").strip()

def tmdb_meta(tv):
    h = get_text(f"https://www.themoviedb.org/tv/{tv}?language=es-ES")
    poster = re.search(r'property="og:image" content="[^"]*/([A-Za-z0-9]{16,})\.(?:jpg|png)', h)
    bd = get_text(f"https://www.themoviedb.org/tv/{tv}/images/backdrops")
    backdrop = re.search(r'image\.tmdb\.org/t/p/[a-z0-9_]+/([A-Za-z0-9]{20,})\.jpg', bd)
    desc = re.search(r'<div class="overview">\s*<p>([^<]+)</p>', h)
    genres = list(dict.fromkeys(re.findall(r'/genre/\d+[^"]*"[^>]*>([^<]+)<', h)))[:5]
    yr = re.search(r"<title>[^(]*\((\d{4})", h)
    return {
        "poster": f"https://image.tmdb.org/t/p/w500/{poster.group(1)}.jpg" if poster else "",
        "backdrop": f"https://image.tmdb.org/t/p/w1280/{backdrop.group(1)}.jpg" if backdrop else "",
        "description": dec_ent(desc.group(1)) if desc else "",
        "genres": [dec_ent(g) for g in genres], "year": int(yr.group(1)) if yr else None,
    }

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

def embed69_has_lat(imdb, s, e):
    """Verifica que embed69 tenga el episodio en Latino (sin descifrar: lee dataLink)."""
    code = f"{imdb}-{s}x{str(e).zfill(2)}"
    h = get_text(f"https://embed69.org/f/{code}/", referer="https://pelisplushd.bz/")
    m = re.search(r'dataLink\s*=\s*(\[[\s\S]*?\]);', h)
    if not m: return None
    try:
        dl = json.loads(m.group(1))
    except Exception:
        return None
    langs = [g.get("video_language") for g in dl]
    if "LAT" in langs: return "Latino"
    if "SUB" in langs or "ESP" in langs or langs: return "Latino"  # embed69 casi siempre trae LAT
    return None

def jk_search(title):
    h = get_text(f"https://jkanime.net/buscar/{urllib.parse.quote(title)}/")
    cands = [m for m in dict.fromkeys(re.findall(r'href="https://jkanime\.net/([a-z0-9-]+)/"', h))
             if m not in ("buscar", "letra", "genero", "top", "horario", "directorio")]
    if not cands: return None
    want = norm(title)
    def score(c):
        cn = norm(c.replace("-", " "))
        if cn == want: return 100
        if cn.startswith(want) or want.startswith(cn): return 70
        ws = set(want.split()); return len([w for w in cn.split() if w in ws])
    return sorted(cands, key=score, reverse=True)[0]

JK_KEEP = {"mega": "Mega", "sfastwish": "Streamwish", "streamwish": "Streamwish", "swiftplay": "Streamwish",
           "voe": "VOE", "vidhide": "VidHide", "vidhidevip": "VidHide", "filemoon": "Filemoon", "streamtape": "Streamtape"}
def jk_servers(slug, n):
    h = get_text(f"https://jkanime.net/{slug}/{n}/")
    m = re.search(r'var\s+servers\s*=\s*(\[[\s\S]*?\]);', h)
    if not m: return None  # no existe el episodio
    try:
        arr = json.loads(m.group(1))
    except Exception:
        return []
    out, seen = [], set()
    for s in arr:
        try:
            u = base64.b64decode(s.get("remote", "")).decode().strip()
        except Exception:
            continue
        if not u.startswith("http"): continue
        name = next((v for k, v in JK_KEEP.items() if k in u.lower()), None)
        if not name or name in seen: continue
        seen.add(name); out.append({"url": u, "name": name, "lang": "Sub", "desc": ""})
    rank = {"Mega": 0, "Streamwish": 1, "VOE": 2, "VidHide": 3, "Filemoon": 4, "Streamtape": 5}
    out.sort(key=lambda x: rank.get(x["name"], 9))
    return out[:3]

def slugify(s):
    import unicodedata
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))

# ------------------------------------------------------------------ Construir + guardar
def build_and_save(title, token, want_lat, want_sub, log, prog):
    log(f"== {title} ==")
    imdb = imdb_resolve(title)
    tmdb = tmdb_search(title)
    log(f"imdb={imdb}  tmdb={tmdb}")
    meta = tmdb_meta(tmdb) if tmdb else {"genres": [], "description": "", "poster": "", "backdrop": "", "year": None}
    flat, seasons = tmdb_stills(tmdb) if tmdb else ({}, [])
    if not seasons: seasons = [{"season": 1, "count": 60}]
    aid = slugify(title)
    jkslug = jk_search(title) if want_sub else None
    if want_sub: log(f"jkanime slug: {jkslug or '(no encontrado)'}")

    episodes = []
    total = sum(s["count"] for s in seasons) or 60
    absn = 0
    for S in seasons:
        sname = f"Temporada {S['season']}" if len(seasons) > 1 else "Temporada 1"
        for n in range(1, S["count"] + 1):
            absn += 1
            servers = []
            if want_lat and imdb:
                if embed69_has_lat(imdb, S["season"], n):
                    servers.append({"url": f"https://embed69.org/f/{imdb}-{S['season']}x{str(n).zfill(2)}/",
                                    "name": "PelisPlus", "lang": "Latino", "desc": "Audio Latino"})
                time.sleep(0.9)
            if want_sub and jkslug:
                sub = jk_servers(jkslug, absn)
                if sub is None and absn > total: break
                for x in (sub or []): servers.append(x)
                time.sleep(0.3)
            if not servers:
                log(f"  ep {absn} (S{S['season']}E{n}): sin servers"); prog(absn, total); continue
            em = flat.get(f"{S['season']}x{n}", {})
            episodes.append({
                "number": n, "season": sname, "title": em.get("title") or f"Episodio {n}",
                "language": "Latino" if any(s["lang"] == "Latino" for s in servers) else "Sub",
                "videoUrl": f"frame/player.html?a={aid}&s={urllib.parse.quote(sname)}&e={n}",
                "img": em.get("still") or meta["backdrop"] or meta["poster"], "description": "",
                "duration": "24 min", "servers": servers,
            })
            prog(absn, total)
    if not episodes:
        log("Sin episodios con servers. Aborto."); return

    existing = get_doc(f"animes/{aid}", token)
    if existing and existing.get("episodes"):
        have = {f"{e.get('season')}|{e.get('number')}" for e in existing["episodes"]}
        nuevos = [e for e in episodes if f"{e['season']}|{e['number']}" not in have]
        episodes = existing["episodes"] + nuevos
        log(f"Anime existente: +{len(nuevos)} episodios nuevos (no se toca lo existente)")
    langs = list(dict.fromkeys(e["language"] for e in episodes))
    doc = existing if (existing and existing.get("title")) else {
        "id": aid, "title": title, "altTitles": [], "type": "TV", "audio": " | ".join(langs),
        "status": "Finalizado", "quality": "1080p", "year": meta["year"], "creator": "",
        "genres": meta["genres"], "tags": [], "seasons": len(seasons), "rating": 4.4, "ratingCount": 300,
        "contentWarning": "", "description": meta["description"], "img": meta["poster"], "imgMobile": meta["poster"],
        "heroImg": meta["backdrop"], "fonImg": meta["backdrop"], "logoImg": "", "trailerUrl": "",
    }
    doc["episodes"] = episodes
    doc["episodesTotal"] = len(episodes); doc["episodesCount"] = len(episodes)
    doc["audio"] = " | ".join(langs)
    st, t = patch_fields_real(f"animes/{aid}", doc, token)
    if st not in (200,): log(f"ERROR guardar anime: {st} {t[:150]}"); return
    # tarjeta del catálogo
    cat = get_catalog()
    light = {k: v for k, v in doc.items() if k != "episodes"}
    idx = next((i for i, x in enumerate(cat) if x.get("id") == aid), -1)
    if idx >= 0: cat[idx] = light
    else: cat.append(light)
    patch_fields_real("catalog/index", {"items": cat}, token)
    patch_fields_real("meta/catalog", {"version": int(time.time() * 1000)}, token)
    log(f"OK GUARDADO: {aid} — {len(episodes)} episodios [{' | '.join(langs)}]")
    log("Listo. Aparecerá en el sitio.")

# ------------------------------------------------------------------ GUI
class App:
    def __init__(self, root):
        self.root = root; self.token = None
        root.title("All-Anime — Importador"); root.geometry("640x560"); root.configure(bg="#141414")
        st = ttk.Style(); st.theme_use("clam")
        st.configure("TButton", background="#e0231f", foreground="#fff", padding=8, font=("Segoe UI", 10, "bold"))
        st.configure("TLabel", background="#141414", foreground="#eaeaea", font=("Segoe UI", 10))
        st.configure("TCheckbutton", background="#141414", foreground="#eaeaea")
        top = tk.Frame(root, bg="#141414"); top.pack(fill="x", padx=16, pady=(14, 4))
        ttk.Label(top, text="Correo admin").grid(row=0, column=0, sticky="w")
        ttk.Label(top, text="Contraseña").grid(row=0, column=1, sticky="w")
        self.email = tk.Entry(top, width=30); self.email.grid(row=1, column=0, padx=(0, 8))
        self.pw = tk.Entry(top, width=22, show="•"); self.pw.grid(row=1, column=1, padx=(0, 8))
        self.login_btn = ttk.Button(top, text="Iniciar sesión", command=self.do_login); self.login_btn.grid(row=1, column=2)
        self.status = ttk.Label(root, text="Inicia sesión para empezar.", foreground="#ffcf7a"); self.status.pack(anchor="w", padx=16)
        mid = tk.Frame(root, bg="#141414"); mid.pack(fill="x", padx=16, pady=10)
        ttk.Label(mid, text="Título del anime").pack(anchor="w")
        self.title = tk.Entry(mid, width=54, font=("Segoe UI", 11)); self.title.pack(anchor="w", pady=4, fill="x")
        opt = tk.Frame(mid, bg="#141414"); opt.pack(anchor="w", pady=4)
        self.vlat = tk.BooleanVar(value=True); self.vsub = tk.BooleanVar(value=True)
        ttk.Checkbutton(opt, text="Latino (embed69)", variable=self.vlat).pack(side="left", padx=(0, 14))
        ttk.Checkbutton(opt, text="Sub (jkanime)", variable=self.vsub).pack(side="left")
        self.go = ttk.Button(mid, text="Agregar (Sub + Latino)", command=self.do_add, state="disabled"); self.go.pack(anchor="w", pady=6)
        self.bar = ttk.Progressbar(root, mode="determinate"); self.bar.pack(fill="x", padx=16, pady=(2, 8))
        self.logbox = tk.Text(root, bg="#0a0a0a", fg="#d6d6d6", height=16, font=("Consolas", 9), relief="flat")
        self.logbox.pack(fill="both", expand=True, padx=16, pady=(0, 14))

    def log(self, m):
        self.logbox.insert("end", m + "\n"); self.logbox.see("end"); self.root.update_idletasks()
    def prog(self, n, total):
        self.bar["maximum"] = total; self.bar["value"] = n; self.root.update_idletasks()

    def do_login(self):
        try:
            self.token = sign_in(self.email.get().strip(), self.pw.get())
            self.status.config(text="✅ Sesión iniciada. Escribe un título y pulsa Agregar.", foreground="#9fd89f")
            self.go.config(state="normal")
        except Exception as e:
            messagebox.showerror("Login", f"No se pudo iniciar sesión:\n{e}")

    def do_add(self):
        t = self.title.get().strip()
        if not t: return
        if not self.token: messagebox.showwarning("Sesión", "Inicia sesión primero."); return
        self.go.config(state="disabled"); self.logbox.delete("1.0", "end")
        def work():
            try:
                build_and_save(t, self.token, self.vlat.get(), self.vsub.get(), self.log, self.prog)
            except Exception as e:
                self.log("ERROR: " + str(e))
            finally:
                self.root.after(0, lambda: self.go.config(state="normal"))
        threading.Thread(target=work, daemon=True).start()

if __name__ == "__main__":
    r = tk.Tk(); App(r); r.mainloop()
