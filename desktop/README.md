# All-Anime — Importador de escritorio

App **nativa** (sin navegador, sin CORS) que hace lo mismo que el asistente al agregar un
anime: resuelve metadata + imágenes, extrae los servidores por episodio de varias fuentes,
muestra una **vista previa** y guarda directo en tu **Firebase**.

## Funciones

- **Fuentes:** embed69 (Latino = catálogo de animeonline.ninja ya decodificado),
  **animeav1** (Latino + Sub: Mega/HLS/MP4Upload), **jkanime** (Sub:
  Mega/StreamWish/VOE/VidHide/Streamtape) y **Manual** (pegas tú las URLs `N|URL`).
- **Vista previa:** antes de guardar ves la lista de episodios con sus servidores.
- **Prioridad de servidores:** escribe el orden (ej. `Mega, Streamwish, VOE`) y, si quieres,
  marca "Usar SOLO estos" para descartar los demás.
- **Modos:** *Solo añadir lo nuevo* (no toca nada) o *Reemplazar enlaces (reparar rotos)*
  (cambia los servidores de los episodios que vuelvas a construir).
- Máx **3 servidores por idioma**. Si el anime ya existe, en modo "añadir" solo agrega lo
  que falte.

## Usarla (lo más simple — sin .exe)

1. Instala **Python 3** desde https://python.org (marca **"Add Python to PATH"**).
2. **Doble clic** en `allanime_importer.py`. (Si no abre con doble clic: clic derecho →
   *Abrir con* → *Python*.)
3. Inicia sesión con tu **correo y contraseña de admin**.
4. Escribe el **título**, elige fuentes/prioridad → **Construir (vista previa)**.
5. Revisa la lista → **Guardar en la web**.

## Crear un .EXE (para no depender de Python) — ¿dónde ejecuto los comandos?

Los comandos van en una **terminal de Windows**, dentro de la carpeta `desktop`:

1. Abre el **Explorador de archivos** y entra a la carpeta `desktop` (donde está este
   archivo `allanime_importer.py`).
2. En la **barra de direcciones** de esa carpeta escribe `cmd` y pulsa **Enter**
   → se abre una consola YA ubicada en esa carpeta. (Alternativa: menú Inicio →
   escribe `cmd` → Enter, y luego `cd` a la carpeta.)
3. En esa consola escribe estos dos comandos (uno y Enter, luego el otro y Enter):

   ```
   pip install pyinstaller
   pyinstaller --onefile --noconsole --name AllAnimeImporter allanime_importer.py
   ```

4. Al terminar, el ejecutable queda en `desktop\dist\AllAnimeImporter.exe`.
   Doble clic y funciona sin tener que abrir Python.

> Si `pip` o `pyinstaller` "no se reconoce": reinstala Python marcando *Add to PATH*, o usa
> `python -m pip install pyinstaller` y `python -m PyInstaller --onefile --noconsole allanime_importer.py`.

## Notas

- La contraseña **no** se guarda en el código; la escribes al iniciar sesión.
- `animeonline.ninja` bloquea el scraping directo (Cloudflare 403), pero **su catálogo
  Latino ya viene por embed69** — por eso esa casilla dice "Latino / animeonlineninja".
