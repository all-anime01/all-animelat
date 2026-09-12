# -*- coding: utf-8 -*-
"""
all-anime Descargas — vigila los animes del catálogo en nekomitai y soanimesite,
avisa de los episodios nuevos y los deja descargados y ordenados en una carpeta,
listos para subirlos a los servidores en orden.

CÓMO FUNCIONA (y por qué es así)
--------------------------------
Las dos fuentes NO dejan ver el enlace de descarga a un programa:
  · nekomitai pone un Cloudflare Turnstile («Protección contra bots») delante de la
    sección «Enlaces».
  · soanimesite manda todos sus enlaces por ouo.io, que responde 403 con la pantalla
    «Just a moment…» a cualquier cliente que no sea un navegador de verdad.
Saltarse esos controles no se hace aquí. El reparto es:
  · el programa hace TODO lo aburrido — mirar qué hay nuevo, cruzarlo con el catálogo,
    decir qué episodios faltan, abrir la página correcta, nombrar el archivo, meterlo
    en su carpeta, llevar la cuenta y el orden de subida;
  · tú pasas el control una vez por episodio y copias el enlace que sale;
  · el programa se encarga de la descarga, con reanudación si se corta.
Pega el enlace y ya está: se detecta el host solo. El portapapeles se vigila, así que
normalmente basta con copiar y el episodio entra en la cola sin tocar nada más.
"""
import os, re, json, time, threading, urllib.parse, urllib.request, subprocess, webbrowser, shutil
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import customtkinter as ctk
import allanime_importer as A

BG, CARD, CARD2, FIELD = A.BG, A.CARD, A.CARD2, A.FIELD
TXT, MUT, RED, REDH, GRN, GRNH = A.TXT, A.MUT, A.RED, A.REDH, A.GRN, A.GRNH
AZUL, AZULH, AMB = "#2b7fff", "#4d95ff", "#f59e0b"

CFG = os.path.join(os.path.expanduser("~"), ".allanime_descargas.json")
NEKO = "https://nekomitai.net"
SOAN = "https://www.soanimesitehd.com"
VIDEO_EXT = (".mkv", ".mp4", ".avi", ".m4v", ".webm")

# Hosts cuyo enlace directo sabemos descargar por HTTP sin más trámite.
HOST_DIRECTO = re.compile(r"(?i)(pixeldrain|1fichier|mediafire|gofile|buzzheavier|"
                          r"workers\.dev|googleusercontent|drive\.usercontent|\.(?:mkv|mp4|avi)(?:\?|$))")
HOST_MEGA = re.compile(r"(?i)mega\.(?:nz|co\.nz)/")


# ------------------------------------------------------------------ preferencias
def cargar_cfg():
    try:
        with open(CFG, encoding="utf-8") as f: return json.load(f)
    except Exception:
        return {}

def guardar_cfg(c):
    try:
        with open(CFG, "w", encoding="utf-8") as f: json.dump(c, f, ensure_ascii=False, indent=1)
    except Exception: pass

def carpeta_por_defecto():
    d = os.path.join(os.path.expanduser("~"), "Downloads", "all-anime")
    return cargar_cfg().get("carpeta") or d


# ------------------------------------------------------------------ utilidades
_MALO = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
def sanea(s, limite=90):
    """Nombre de archivo/carpeta válido en Windows."""
    s = _MALO.sub("", str(s or "").strip()).rstrip(". ")
    return (s[:limite].rstrip(". ") or "sin-nombre")

def tam_legible(n):
    n = float(n or 0)
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024 or u == "GB": return f"{n:.0f} {u}" if u in ("B", "KB") else f"{n:.2f} {u}"
        n /= 1024
    return f"{n:.2f} GB"

def ep_del_titulo(t):
    """De «BLACK TORCH 11/12 [...]» saca (11, 12). Devuelve (None, None) si no lo dice."""
    m = re.search(r"(?<![\d/])(\d{1,4})\s*/\s*(\d{1,4})(?!\d)", str(t or ""))
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if 0 < a <= b <= 2000: return a, b
    return None, None

def limpia_titulo(t):
    """Quita del título todo lo que va entre corchetes y el «11/12» del final."""
    t = re.sub(r"\[[^\]]*\]", " ", str(t or ""))
    t = re.sub(r"(?<![\d/])\d{1,4}\s*/\s*\d{1,4}(?!\d)", " ", t)
    t = re.sub(r"(?i)\b(sub[\s-]*espa[nñ]ol|dual audio|multi audio|latino|castellano|online|"
               r"\d{3,4}p|hd|fullhd|\d+fps|mega|mediafire|gd|mf)\b", " ", t)
    return " ".join(t.split()).strip(" -–—·|")


def _tokens(s):
    """Palabras normalizadas y sin tildes, para comparar títulos."""
    import unicodedata
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return set(A.norm(s).split()) - {"the", "no", "wa", "ga", "ni", "to", "de", "season", "temporada", "nd", "rd", "th", "st"}

def casar(titulo, catalogo):
    """Anime del catálogo que corresponde a este título de la fuente (o None).
    Compara contra el título, los títulos alternativos y el id."""
    want = _tokens(titulo)
    if not want: return None, 0
    mejor, punt = None, 0.0
    for a in catalogo:
        for cand in [a.get("title", "")] + list(a.get("altTitles") or []) + [str(a.get("id", "")).replace("-", " ")]:
            cs = _tokens(cand)
            if not cs: continue
            comunes = len(want & cs)
            if not comunes: continue
            # Jaccard: premia que coincidan casi todas las palabras de los dos lados.
            sc = comunes / float(len(want | cs))
            if cs == want: sc = 1.0
            if sc > punt: punt, mejor = sc, a
    return (mejor, punt) if punt >= 0.55 else (None, punt)


# ------------------------------------------------------------------ fuentes (páginas abiertas)
_NEKO_CARD = re.compile(
    r'<a[^>]+href="(https?://nekomitai\.net/[^"]+/)"[^>]*class="[^"]*neko-schedule-card[^"]*"'
    r'[^>]*data-jst-day="([^"]*)"[^>]*data-jst-time="([^"]*)"([\s\S]{0,2600}?)</a>')

def nekomitai_horario(log=print):
    """Horario semanal de nekomitai: qué anime emite cada día y por qué episodio va.
    La página es abierta; lo que está protegido es la sección de enlaces de cada ficha."""
    try:
        h = A.get_text(f"{NEKO}/horario/")
    except Exception as ex:
        log(f"nekomitai: no respondió ({str(ex)[:60]})"); return []
    out = []
    for url, dia, hora, cuerpo in _NEKO_CARD.findall(h):
        tit = re.search(r'class="neko-card-title">([^<]+)<', cuerpo)
        ep = re.search(r'neko-card-episode-badge"[^>]*>\s*EP\s*(\d+)', cuerpo)
        if not tit: continue
        out.append({"fuente": "nekomitai", "titulo": A.dec_ent(tit.group(1)).strip(),
                    "url": url, "ep": int(ep.group(1)) if ep else None, "total": None,
                    "cuando": f"{dia} {hora}".strip()})
    log(f"nekomitai: {len(out)} animes en el horario")
    return out

def soanime_feed(maximo=150, log=print):
    """Índice de soanimesite por el feed de Blogger (abierto). El título trae el
    «11/12», así que ya sabemos por qué episodio va cada serie.
    El blog tiene el feed limitado a 7 entradas por página pase lo que pase, así que
    se avanza con start-index de tantas en tantas como devuelva de verdad."""
    out, vistos = [], set()
    inicio = 1
    while len(out) < maximo:
        u = f"{SOAN}/feeds/posts/default?alt=json&max-results=25&start-index={inicio}"
        try:
            j = A.get_json(u)
        except Exception as ex:
            log(f"soanimesite: no respondió ({str(ex)[:60]})"); break
        entradas = (j.get("feed") or {}).get("entry") or []
        if not entradas: break
        inicio += len(entradas)
        for e in entradas:
            t = (e.get("title") or {}).get("$t", "")
            link = next((l.get("href") for l in (e.get("link") or []) if l.get("rel") == "alternate"), "")
            if not link or link in vistos: continue
            vistos.add(link)
            ep, tot = ep_del_titulo(t)
            out.append({"fuente": "soanimesite", "titulo": limpia_titulo(t), "titulo_crudo": t,
                        "url": link.replace("http://", "https://"), "ep": ep, "total": tot,
                        "cuando": (e.get("published") or {}).get("$t", "")[:10]})
    log(f"soanimesite: {len(out)} publicaciones")
    return out


# ------------------------------------------------------------------ descarga
def host_de(url):
    u = (url or "").lower()
    if HOST_MEGA.search(u): return "mega"
    if "pixeldrain" in u: return "pixeldrain"
    if "1fichier" in u: return "1fichier"
    if "mediafire" in u: return "mediafire"
    if "drive.google" in u or "drive.usercontent" in u: return "drive"
    if "gofile" in u: return "gofile"
    return "directo"

def mega_cli():
    """Ruta de MEGAcmd o megatools si están instalados (MEGA no se descarga por HTTP)."""
    for c in ("mega-get", "megatools", "megadl", "MEGAclient"):
        p = shutil.which(c)
        if p: return c, p
    for p in (r"C:\Users\%s\AppData\Local\MEGAcmd\mega-get.exe" % os.environ.get("USERNAME", ""),
              r"C:\Program Files\MEGAcmd\mega-get.exe"):
        if os.path.exists(p): return "mega-get", p
    return None, None

def _nombre_de_cabeceras(resp, url):
    cd = resp.headers.get("Content-Disposition") or ""
    m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', cd)
    if m:
        try: return urllib.parse.unquote(m.group(1))
        except Exception: return m.group(1)
    base = urllib.parse.unquote(urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])
    return base or ""

def descarga_http(url, destino, prog=None, parar=None, log=print):
    """Descarga con reanudación: si el archivo ya está a medias, sigue por donde iba."""
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    parcial = destino + ".parte"
    hechos = os.path.getsize(parcial) if os.path.exists(parcial) else 0
    cab = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}
    if hechos: cab["Range"] = f"bytes={hechos}-"
    req = urllib.request.Request(url, headers=cab)
    resp = urllib.request.urlopen(req, timeout=60, context=A._SSL)
    total = int(resp.headers.get("Content-Length") or 0) + (hechos if resp.status == 206 else 0)
    if resp.status not in (200, 206):
        raise RuntimeError(f"el servidor respondió {resp.status}")
    if resp.status == 200 and hechos:
        hechos = 0                              # no admite reanudar: se empieza de cero
        try: os.remove(parcial)
        except OSError: pass
    modo = "ab" if hechos else "wb"
    t0, ultimo = time.time(), 0
    with open(parcial, modo) as f:
        while True:
            if parar and parar():
                log("  cancelado"); return None
            trozo = resp.read(262144)
            if not trozo: break
            f.write(trozo); hechos += len(trozo)
            if prog and time.time() - ultimo > 0.3:
                ultimo = time.time()
                vel = hechos / max(time.time() - t0, 0.1)
                prog(hechos, total, vel)
    os.replace(parcial, destino)
    return destino

def descarga_mega(url, carpeta, log=print, parar=None):
    """MEGA necesita su propio cliente: se usa MEGAcmd/megatools si está instalado."""
    nombre, ruta = mega_cli()
    if not nombre:
        raise RuntimeError("MEGA necesita MEGAcmd instalado (mega.io/cmd). "
                           "Instálalo y vuelve a intentarlo, o usa el enlace de otro host.")
    os.makedirs(carpeta, exist_ok=True)
    cmd = ([ruta, url, carpeta] if nombre in ("mega-get", "MEGAclient")
           else [ruta, "--path", carpeta, url])
    log("  " + nombre + " descargando…")
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or "falló MEGAcmd").strip()[:200])
    return carpeta


# ------------------------------------------------------------------ estado de la cola
class Cola:
    """Lo que se ha bajado y lo que falta. Se guarda en disco para no repetir
    descargas y para conservar el ORDEN en el que hay que subirlo todo."""
    def __init__(self, ruta):
        self.ruta = ruta
        self.datos = {"items": []}
        try:
            with open(ruta, encoding="utf-8") as f: self.datos = json.load(f)
        except Exception: pass
        self.datos.setdefault("items", [])

    def guardar(self):
        try:
            os.makedirs(os.path.dirname(self.ruta), exist_ok=True)
            with open(self.ruta, "w", encoding="utf-8") as f:
                json.dump(self.datos, f, ensure_ascii=False, indent=1)
        except Exception: pass

    def clave(self, it): return f"{it.get('aid') or it.get('titulo')}|{it.get('ep')}"

    def get(self, it):
        k = self.clave(it)
        return next((x for x in self.datos["items"] if x.get("k") == k), None)

    def marca(self, it, estado, **extra):
        k = self.clave(it)
        x = self.get(it)
        if not x:
            x = {"k": k, "orden": len(self.datos["items"]) + 1}
            self.datos["items"].append(x)
        x.update({"titulo": it.get("titulo"), "aid": it.get("aid"), "ep": it.get("ep"),
                  "fuente": it.get("fuente"), "estado": estado, "ts": int(time.time())})
        x.update(extra)
        self.guardar()
        return x


# ------------------------------------------------------------------ interfaz
def F(n, b=False): return ctk.CTkFont("Segoe UI", n, "bold" if b else "normal")

class App:
    def __init__(self, root):
        self.root = root
        root.title("all-anime Descargas")
        root.geometry("1220x780")
        root.configure(fg_color=BG)
        try:
            ip = A._icon_path()
            if ip: root.iconbitmap(ip)
        except Exception: pass

        self.cfg = cargar_cfg()
        self.carpeta = tk.StringVar(value=carpeta_por_defecto())
        self.catalogo = []
        self.filas = {}          # iid del árbol -> item
        self.cola = Cola(os.path.join(self.carpeta.get(), "_cola.json"))
        self.parar_flag = False
        self.ultimo_portapapeles = ""

        # ---------- cabecera
        cab = ctk.CTkFrame(root, fg_color=CARD2, corner_radius=0); cab.pack(fill="x")
        ctk.CTkLabel(cab, text="all-anime  ·  Descargas", font=F(19, True), text_color=TXT
                     ).pack(side="left", padx=16, pady=12)
        ctk.CTkLabel(cab, text="episodios nuevos de los animes del catálogo, ordenados para subir",
                     font=F(12), text_color=MUT).pack(side="left")
        self.estado = ctk.CTkLabel(cab, text="", font=F(12), text_color=MUT)
        self.estado.pack(side="right", padx=16)

        # ---------- carpeta
        fr = ctk.CTkFrame(root, fg_color="transparent"); fr.pack(fill="x", padx=16, pady=(12, 6))
        ctk.CTkLabel(fr, text="Carpeta de descargas:", font=F(12), text_color=MUT).pack(side="left")
        ctk.CTkEntry(fr, textvariable=self.carpeta, width=470, fg_color=FIELD, text_color=TXT,
                     border_color=CARD2, font=F(12)).pack(side="left", padx=8)
        self._btn(fr, "Cambiar…", self.elegir_carpeta).pack(side="left")
        self._btn(fr, "📂 Abrir", self.abrir_carpeta).pack(side="left", padx=6)
        self.auto_clip = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(fr, text="Vigilar el portapapeles", variable=self.auto_clip, font=F(12),
                        text_color=TXT, fg_color=AZUL, hover_color=AZULH, checkbox_width=18,
                        checkbox_height=18).pack(side="left", padx=(14, 0))

        # ---------- acciones
        ac = ctk.CTkFrame(root, fg_color="transparent"); ac.pack(fill="x", padx=16, pady=(0, 8))
        self.scan_btn = self._btn(ac, "🔎 Buscar novedades", self.do_scan, "red"); self.scan_btn.pack(side="left")
        self.solo_mios = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(ac, text="Solo los que están en mi catálogo", variable=self.solo_mios,
                        font=F(12), text_color=TXT, fg_color=AZUL, hover_color=AZULH,
                        checkbox_width=18, checkbox_height=18).pack(side="left", padx=12)
        self.solo_faltan = tk.BooleanVar(value=True)
        ctk.CTkCheckBox(ac, text="Solo episodios que me faltan", variable=self.solo_faltan,
                        font=F(12), text_color=TXT, fg_color=AZUL, hover_color=AZULH,
                        checkbox_width=18, checkbox_height=18).pack(side="left")
        self._btn(ac, "🌐 Abrir la página", self.abrir_pagina, "azul").pack(side="left", padx=(16, 4))
        self._btn(ac, "📋 Pegar enlace y descargar", self.pegar_y_descargar, "grn").pack(side="left", padx=4)
        self.stop_btn = self._btn(ac, "⏹ Parar", self.parar); self.stop_btn.pack(side="left", padx=4)

        # ---------- tabla
        est = ttk.Style(); est.theme_use("clam")
        est.configure("D.Treeview", background=CARD, fieldbackground=CARD, foreground=TXT,
                      rowheight=27, borderwidth=0, font=("Segoe UI", 10))
        est.configure("D.Treeview.Heading", background=CARD2, foreground=MUT,
                      font=("Segoe UI", 10, "bold"), borderwidth=0)
        est.map("D.Treeview", background=[("selected", "#26304a")])
        cols = ("anime", "ep", "fuente", "catalogo", "faltan", "estado")
        self.tree = ttk.Treeview(root, columns=cols, show="headings", style="D.Treeview", height=17)
        for c, t, w in [("anime", "Anime", 330), ("ep", "Último ep", 80), ("fuente", "Fuente", 105),
                        ("catalogo", "En mi catálogo", 260), ("faltan", "Me faltan", 150),
                        ("estado", "Estado", 200)]:
            self.tree.heading(c, text=t); self.tree.column(c, width=w, anchor="w")
        self.tree.pack(fill="both", expand=True, padx=16)
        self.tree.bind("<Double-1>", lambda e: self.abrir_pagina())
        self.tree.tag_configure("nuevo", foreground="#8ef0b0")
        self.tree.tag_configure("aldia", foreground=MUT)
        self.tree.tag_configure("fuera", foreground="#6b7280")

        # ---------- progreso + registro
        pr = ctk.CTkFrame(root, fg_color="transparent"); pr.pack(fill="x", padx=16, pady=(8, 0))
        self.barra = ctk.CTkProgressBar(pr, progress_color=GRN, fg_color=FIELD); self.barra.set(0)
        self.barra.pack(fill="x", side="left", expand=True)
        self.prog_lbl = ctk.CTkLabel(pr, text="", font=F(11), text_color=MUT, width=210)
        self.prog_lbl.pack(side="right", padx=(10, 0))
        self.logbox = ctk.CTkTextbox(root, height=140, fg_color="#0a0c12", text_color=TXT,
                                     corner_radius=8, font=("Consolas", 11))
        self.logbox.pack(fill="x", padx=16, pady=10)

        self.log("Listo. Pulsa «Buscar novedades» para ver qué ha salido de los animes del catálogo.")
        self.log("Recuerda: nekomitai pide su captcha y soanimesite pasa por ouo.io, así que el enlace")
        self.log("lo destapas tú en el navegador. Cópialo y esta ventana se encarga del resto.")
        self.root.after(1200, self._vigila_portapapeles)

    # ---------- utilidades de interfaz
    def _btn(self, p, t, cmd, color=None):
        c = {"red": (RED, REDH), "grn": (GRN, GRNH), "azul": (AZUL, AZULH)}.get(color, (CARD2, "#26304a"))
        return ctk.CTkButton(p, text=t, command=cmd, fg_color=c[0], hover_color=c[1],
                             text_color=TXT, font=F(12, True), corner_radius=8, height=32)

    def log(self, m):
        try: self.logbox.insert("end", str(m) + "\n")
        except Exception: self.logbox.insert("end", str(m).encode("ascii", "replace").decode() + "\n")
        self.logbox.see("end")
        try: self.root.update_idletasks()
        except Exception: pass

    def elegir_carpeta(self):
        d = filedialog.askdirectory(initialdir=self.carpeta.get() or os.path.expanduser("~"))
        if not d: return
        self.carpeta.set(d)
        self.cfg["carpeta"] = d; guardar_cfg(self.cfg)
        self.cola = Cola(os.path.join(d, "_cola.json"))
        self.log(f"Carpeta: {d}")

    def abrir_carpeta(self):
        d = self.carpeta.get()
        os.makedirs(d, exist_ok=True)
        try: os.startfile(d)
        except AttributeError: subprocess.Popen(["xdg-open", d])

    def parar(self):
        self.parar_flag = True
        self.log("Parando en cuanto termine el trozo en curso…")

    def _sel(self):
        s = self.tree.selection()
        return self.filas.get(s[0]) if s else None

    # ---------- buscar novedades
    def do_scan(self):
        self.scan_btn.configure(state="disabled")
        def work():
            try:
                self.log("\n=== buscando novedades ===")
                if not self.catalogo:
                    self.log("leyendo el catálogo…")
                    self.catalogo = A.get_catalog()
                self.log(f"catálogo: {len(self.catalogo)} animes")
                items = nekomitai_horario(self.log) + soanime_feed(150, self.log)
                self.log("cruzando con el catálogo…")
                for it in items:
                    a, punt = casar(it["titulo"], self.catalogo)
                    it["aid"] = a.get("id") if a else None
                    it["cat_titulo"] = a.get("title") if a else ""
                    it["cat_eps"] = int(a.get("episodesTotal") or a.get("episodesCount") or 0) if a else 0
                    it["punt"] = round(punt, 2)
                    it["faltan"] = self._faltan(it)
                self.root.after(0, lambda: self._pinta(items))
            except Exception as ex:
                self.log(f"ERROR: {str(ex)[:180]}")
            finally:
                self.root.after(0, lambda: self.scan_btn.configure(state="normal"))
        threading.Thread(target=work, daemon=True).start()

    def _faltan(self, it):
        """Episodios que la fuente ya publicó y nosotros todavía no tenemos."""
        if not it.get("aid") or not it.get("ep"): return []
        hay = it.get("cat_eps") or 0
        return list(range(hay + 1, int(it["ep"]) + 1)) if it["ep"] > hay else []

    def _pinta(self, items):
        self.tree.delete(*self.tree.get_children()); self.filas.clear()
        # primero lo que falta, y dentro de eso lo que más falta
        items.sort(key=lambda x: (0 if x.get("faltan") else (1 if x.get("aid") else 2),
                                  -len(x.get("faltan") or []), x.get("titulo", "").lower()))
        n_mios = n_faltan = 0
        for it in items:
            if self.solo_mios.get() and not it.get("aid"): continue
            if self.solo_faltan.get() and not it.get("faltan"): continue
            if it.get("aid"): n_mios += 1
            if it.get("faltan"): n_faltan += 1
            fal = it.get("faltan") or []
            texto_fal = ("%d–%d (%d)" % (fal[0], fal[-1], len(fal))) if len(fal) > 1 else (str(fal[0]) if fal else "—")
            guardado = self.cola.get(it)
            estado = (guardado or {}).get("estado") or ("pendiente" if fal else "al día")
            tag = "nuevo" if fal else ("aldia" if it.get("aid") else "fuera")
            iid = self.tree.insert("", "end", tags=(tag,), values=(
                it.get("titulo", "")[:56], it.get("ep") or "—", it.get("fuente"),
                (it.get("cat_titulo") or "— no está —")[:40], texto_fal, estado))
            self.filas[iid] = it
        self.estado.configure(text=f"{len(self.filas)} en la lista · {n_mios} del catálogo · {n_faltan} con episodios nuevos")
        self.log(f"listo: {n_faltan} animes del catálogo tienen episodios que nos faltan.")

    # ---------- abrir la página protegida
    def abrir_pagina(self):
        it = self._sel()
        if not it:
            messagebox.showinfo("Descargas", "Elige una fila de la lista."); return
        webbrowser.open(it["url"])
        fal = it.get("faltan") or []
        self.log(f"\n▶ {it['titulo']} — abierto en el navegador")
        if it["fuente"] == "nekomitai":
            self.log("  nekomitai: pasa el captcha de la sección «Enlaces» y copia el enlace del episodio.")
        else:
            self.log("  soanimesite: pulsa el enlace del episodio, pasa ouo.io y copia el enlace final.")
        if fal:
            self.log(f"  te faltan los episodios {fal[0]}–{fal[-1]}" if len(fal) > 1 else f"  te falta el episodio {fal[0]}")
        self.log("  cuando lo copies, entra solo (o pulsa «Pegar enlace y descargar»).")

    # ---------- portapapeles
    def _vigila_portapapeles(self):
        try:
            if self.auto_clip.get():
                t = (self.root.clipboard_get() or "").strip()
                if t != self.ultimo_portapapeles and t.startswith("http") and len(t) < 900:
                    self.ultimo_portapapeles = t
                    if host_de(t) != "directo" or HOST_DIRECTO.search(t):
                        self.log(f"📋 enlace copiado ({host_de(t)}) — pulsa «Pegar enlace y descargar»")
        except Exception: pass
        self.root.after(1500, self._vigila_portapapeles)

    def pegar_y_descargar(self):
        it = self._sel()
        if not it:
            messagebox.showinfo("Descargas", "Elige primero la fila del anime."); return
        try: url = (self.root.clipboard_get() or "").strip()
        except Exception: url = ""
        if not url.startswith("http"):
            messagebox.showinfo("Descargas", "No hay ningún enlace copiado."); return
        if "ouo.io" in url or "nekomitai.net" in url:
            messagebox.showinfo("Descargas",
                                "Ese es el enlace intermedio, todavía no el del archivo.\n\n"
                                "Ábrelo en el navegador, pasa la comprobación y copia el enlace "
                                "final (MEGA, 1Fichier, MediaFire, Drive, Pixeldrain…).")
            return
        fal = it.get("faltan") or []
        ep = fal[0] if fal else (it.get("ep") or 1)
        d = EpisodioDialog(self.root, it, ep, url)
        self.root.wait_window(d.win)
        if not d.ok: return
        self._descargar(it, d.ep, url, d.temporada, d.titulo_ep)

    # ---------- descarga
    def _ruta_destino(self, it, ep, temporada, titulo_ep, nombre_origen=""):
        anime = sanea(it.get("cat_titulo") or it.get("titulo"))
        temp = sanea(temporada or "Temporada 1")
        ext = os.path.splitext(nombre_origen)[1].lower()
        if ext not in VIDEO_EXT: ext = ".mkv"
        base = f"{int(ep):03d}" + (f" - {sanea(titulo_ep, 60)}" if titulo_ep else "")
        return os.path.join(self.carpeta.get(), anime, temp, base + ext)

    def _descargar(self, it, ep, url, temporada, titulo_ep):
        self.parar_flag = False
        def work():
            try:
                h = host_de(url)
                self.log(f"\n⬇ {it.get('cat_titulo') or it['titulo']} · episodio {ep} · {h}")
                self.cola.marca(it, "descargando", ep=ep, url=url)
                if h == "mega":
                    carpeta = os.path.dirname(self._ruta_destino(it, ep, temporada, titulo_ep))
                    descarga_mega(url, carpeta, self.log, lambda: self.parar_flag)
                    self._renombra_ultimo(carpeta, it, ep, temporada, titulo_ep)
                    destino = carpeta
                else:
                    # una cabezada para saber el nombre real del archivo
                    nombre = ""
                    try:
                        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
                        with urllib.request.urlopen(req, timeout=25) as r:
                            nombre = _nombre_de_cabeceras(r, url)
                    except Exception: pass
                    destino = self._ruta_destino(it, ep, temporada, titulo_ep, nombre)
                    if os.path.exists(destino):
                        self.log(f"  ya estaba descargado: {destino}")
                        self.cola.marca(it, "ya estaba", ep=ep, ruta=destino)
                        self.root.after(0, self.do_refrescar_estado); return
                    def prog(hechos, total, vel):
                        frac = (hechos / total) if total else 0
                        self.root.after(0, lambda: (self.barra.set(frac), self.prog_lbl.configure(
                            text=f"{tam_legible(hechos)} / {tam_legible(total)} · {tam_legible(vel)}/s")))
                    descarga_http(url, destino, prog, lambda: self.parar_flag, self.log)
                if self.parar_flag:
                    self.cola.marca(it, "pausado", ep=ep, url=url)
                    self.log("  pausado (se retoma donde iba la próxima vez)")
                else:
                    self.cola.marca(it, f"✅ ep {ep}", ep=ep, ruta=str(destino), url=url)
                    self.log(f"  ✅ guardado en {destino}")
            except Exception as ex:
                self.log(f"  ERROR: {str(ex)[:220]}")
                self.cola.marca(it, "error", ep=ep, url=url, error=str(ex)[:200])
            finally:
                self.root.after(0, lambda: (self.barra.set(0), self.prog_lbl.configure(text=""),
                                            self.do_refrescar_estado()))
        threading.Thread(target=work, daemon=True).start()

    def _renombra_ultimo(self, carpeta, it, ep, temporada, titulo_ep):
        """MEGAcmd guarda con el nombre del subidor: se renombra al formato de la carpeta."""
        try:
            vids = [f for f in os.listdir(carpeta) if f.lower().endswith(VIDEO_EXT)]
            if not vids: return
            nuevo = os.path.basename(self._ruta_destino(it, ep, temporada, titulo_ep, vids[0]))
            reciente = max(vids, key=lambda f: os.path.getmtime(os.path.join(carpeta, f)))
            if reciente != nuevo:
                os.replace(os.path.join(carpeta, reciente), os.path.join(carpeta, nuevo))
                self.log(f"  renombrado a {nuevo}")
        except Exception: pass

    def do_refrescar_estado(self):
        for iid, it in self.filas.items():
            g = self.cola.get(it)
            if g:
                v = list(self.tree.item(iid, "values")); v[5] = g.get("estado", "")
                self.tree.item(iid, values=v)


class EpisodioDialog:
    """Confirma a qué episodio y temporada corresponde el enlace antes de bajarlo."""
    def __init__(self, padre, it, ep, url):
        self.ok = False
        self.ep, self.temporada, self.titulo_ep = ep, "Temporada 1", ""
        w = self.win = ctk.CTkToplevel(padre)
        w.title("Confirmar el episodio"); w.configure(fg_color=CARD); w.geometry("560x330")
        w.transient(padre); w.grab_set()
        ctk.CTkLabel(w, text=(it.get("cat_titulo") or it.get("titulo"))[:60], font=F(16, True),
                     text_color=TXT).pack(anchor="w", padx=18, pady=(16, 2))
        ctk.CTkLabel(w, text=f"{host_de(url)} · {url[:66]}…", font=F(11), text_color=MUT
                     ).pack(anchor="w", padx=18, pady=(0, 12))
        fila = ctk.CTkFrame(w, fg_color="transparent"); fila.pack(fill="x", padx=18, pady=4)
        ctk.CTkLabel(fila, text="Episodio:", font=F(12), text_color=MUT, width=80, anchor="w").pack(side="left")
        self.e_ep = ctk.CTkEntry(fila, width=80, fg_color=FIELD, text_color=TXT, font=F(12))
        self.e_ep.insert(0, str(ep)); self.e_ep.pack(side="left")
        fila2 = ctk.CTkFrame(w, fg_color="transparent"); fila2.pack(fill="x", padx=18, pady=4)
        ctk.CTkLabel(fila2, text="Temporada:", font=F(12), text_color=MUT, width=80, anchor="w").pack(side="left")
        self.e_temp = ctk.CTkEntry(fila2, width=220, fg_color=FIELD, text_color=TXT, font=F(12))
        self.e_temp.insert(0, "Temporada 1"); self.e_temp.pack(side="left")
        fila3 = ctk.CTkFrame(w, fg_color="transparent"); fila3.pack(fill="x", padx=18, pady=4)
        ctk.CTkLabel(fila3, text="Título:", font=F(12), text_color=MUT, width=80, anchor="w").pack(side="left")
        self.e_tit = ctk.CTkEntry(fila3, width=360, fg_color=FIELD, text_color=TXT, font=F(12),
                                  placeholder_text="opcional — se añade al nombre del archivo")
        self.e_tit.pack(side="left")
        ctk.CTkLabel(w, text="El archivo se guardará como  Anime / Temporada / 007 - Título.mkv",
                     font=F(11), text_color=MUT).pack(anchor="w", padx=18, pady=(12, 0))
        bar = ctk.CTkFrame(w, fg_color="transparent"); bar.pack(fill="x", padx=18, pady=16)
        ctk.CTkButton(bar, text="Descargar", command=self._ok, fg_color=GRN, hover_color=GRNH,
                      text_color="#04210f", font=F(13, True), height=36).pack(side="left")
        ctk.CTkButton(bar, text="Cancelar", command=w.destroy, fg_color=CARD2, hover_color="#26304a",
                      text_color=TXT, font=F(13), height=36).pack(side="left", padx=8)

    def _ok(self):
        try: self.ep = int(self.e_ep.get().strip())
        except ValueError:
            messagebox.showinfo("Episodio", "El número de episodio no es válido."); return
        self.temporada = self.e_temp.get().strip() or "Temporada 1"
        self.titulo_ep = self.e_tit.get().strip()
        self.ok = True
        self.win.destroy()


if __name__ == "__main__":
    ctk.set_appearance_mode("dark")
    r = ctk.CTk()
    App(r)
    r.mainloop()
