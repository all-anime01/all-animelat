# All-Anime — Importador de escritorio

App **nativa** (sin navegador, sin CORS) que hace lo mismo que el asistente al agregar un
anime: resuelve metadata + imágenes y extrae los servidores en **Latino (embed69/PelisPlus)**
y **Sub (jkanime)**, arma todos los episodios y los guarda directo en tu **Firebase**.

## Usarla (lo más simple)

1. Instala **Python 3** desde https://python.org (marca "Add Python to PATH" al instalar).
   No hace falta instalar nada más: usa solo librerías estándar.
2. Doble clic en `allanime_importer.py` (o en consola: `python allanime_importer.py`).
3. Escribe tu **correo y contraseña de admin** (los mismos del panel) → **Iniciar sesión**.
4. Escribe el **título** del anime → **Agregar (Sub + Latino)**.
5. Mira el registro: cuando diga "OK GUARDADO" ya está en el sitio.
   - Si el anime ya existe, **solo añade los episodios que falten** (no toca tus enlaces).

## Crear un .EXE (opcional, para no depender de Python)

```
pip install pyinstaller
pyinstaller --onefile --noconsole --name AllAnimeImporter allanime_importer.py
```

Queda `dist/AllAnimeImporter.exe` — lo abres con doble clic, sin instalar Python.

## Notas

- La contraseña **no** se guarda en el código; la escribes tú al iniciar sesión.
- Fuentes: **embed69** (Latino, wrapper estable que se ve en app y web) y **jkanime**
  (Sub: Mega/StreamWish/VOE/VidHide/Streamtape, máx 3 por idioma).
- Para añadir más fuentes (animeav1, tioanime, porygonsubs), se agregan funciones como
  `jk_servers` y se combinan en `build_and_save`.
