# All-Anime — Importador de escritorio

App **nativa** (sin navegador, sin CORS) que hace lo mismo que el asistente al agregar un
anime: resuelve metadata + imágenes, extrae los servidores por episodio de varias fuentes,
muestra una **vista previa** y guarda directo en tu **Firebase**.

## Novedades v12

- **Navegador de temporadas.** Al cargar un anime aparecen TODAS sus temporadas (se leen de
  los episodios). Con **«Ver temporada»** eliges una y el listado muestra solo esa; al hacerlo,
  esa temporada queda fijada como **destino** para «➕ Añadir episodios nuevos».
- **Corrige el nº de temporadas.** El campo `seasons` se recalcula solo al guardar a partir de
  los episodios reales (arreglado, p. ej., Mushoku Tensei que marcaba 2 cuando tiene 3).
- **Filemoon = «byse».** Filemoon ahora aparece como **byse/bysc** en las páginas; se reconoce
  y se etiqueta como Filemoon automáticamente.
- *Nota sobre animeyt:* su sitio actual (animeyt.cc) esconde los servidores tras un
  **redirector cifrado con protección anti-bot**, así que no se puede extraer en enlaces
  reproducibles/reutilizables (guardaría un `redirector.php` que no reproduce). Por eso no se
  añadió como fuente automática; las fuentes fiables siguen siendo embed69, animeav1 y jkanime.

## Novedades v11

- **Buscador del catálogo (arreglado el bug del desplegable).** El antiguo menú se
  descolocaba al hacer scroll (la rueda movía el fondo). Ahora hay un **campo de búsqueda**
  + una **lista con scroll propio**: escribe parte del título, selecciona y **Cargar** (o
  doble clic). La rueda sobre la lista la desplaza solo a ella.
- **«Detectar faltantes» ya no marca todo como faltante.** Antes, en animes con nombres de
  temporada personalizados (ej. One Piece / «Temporada 22: Elbaph»), comparaba por
  nombre+número y devolvía «1-1175». Ahora compara **por número**, así que solo señala los
  que de verdad faltan (ej. **1175**). Para sumar un episodio suelto: cárgalo del catálogo,
  escribe su número en «Episodios a agregar» y pulsa **➕ Añadir episodios nuevos** (no
  reemplaza nada).

## Novedades v10

- **Nombres personalizados de temporada.** Al cargar un anime del catálogo, la app lee y
  respeta los nombres reales de sus temporadas (ej. **«Temporada 22: Elbaph»**) y los
  muestra en la vista previa. Al usar **«➕ Añadir episodios nuevos»**, el episodio entra
  con el nombre correcto:
  - **Temporada destino:** nuevo selector (junto a "Episodios a agregar") que se rellena
    con las temporadas reales del anime. Elige a cuál va el episodio nuevo, o déjalo en
    **«automática por número»** para que use la temporada que ya usa ese número.
  - También puedes **escribir** un nombre nuevo (ej. «Temporada 23: …») para empezar una
    temporada; se respeta tal cual al guardar (ya no se convierte en "Temporada N").

## Novedades v9

- **Botón «➕ Añadir episodios nuevos».** Es el botón dedicado a "salió un episodio":
  cargas el anime del catálogo → (opcional) «Detectar faltantes» → **➕ Añadir episodios
  nuevos**. **Conserva** la lista que ya tiene a la vista, solo **suma** lo nuevo y guarda
  sobre el MISMO anime (no duplica, no borra). "Buscar y construir" sigue haciendo lo de
  antes (arma/rehace el anime desde cero).
  - *Arreglo:* antes, al cargar un anime viejo/oscuro (ej. Iron Wok Jan) y pulsar
    "Buscar y construir", la lista quedaba vacía porque reconstruía desde cero y las
    fuentes no lo tienen. El nuevo botón ya no borra lo cargado.
- **Sesión recordada + Cerrar sesión.** Marca **«Recordar sesión»** y la próxima vez la
  app **inicia sesión sola** al abrir. Botón **«Cerrar sesión»** arriba a la derecha para
  salir y borrar la contraseña guardada de este equipo.
- **Diseño renovado:** paleta moderna, cabeceras con acento, botones y listas más claros
  (sin cambiar cómo funciona).
- Carga del catálogo más robusta: resuelve el id real aunque escribas solo parte del
  título (arregla ids con mayúsculas como `TetsunabeNoJan`).

## Novedades v8

- **Cargar del catálogo + agregar episodio = ACTUALIZA (ya no duplica).** Antes, al cargar
  un anime del catálogo y construir para añadir un episodio nuevo, la app creaba un anime
  duplicado con el nombre real/japonés. Ahora, si el título coincide con el anime cargado,
  guarda sobre **ese mismo** anime: solo añade los episodios y **no cambia** su título,
  imágenes ni información.
- El episodio nuevo entra en la **temporada existente** que le corresponde por número
  (no crea una temporada duplicada tipo "Temporada 22" junto a "Temporada 22: Elbaph").

## Novedades v7

- **Secuelas como temporadas:** en el campo de slug puedes poner VARIOS separados por
  coma (uno por temporada, en orden) y se ensamblan como temporadas del mismo anime
  (ej. `beyblade-burst, beyblade-burst-god, beyblade-burst-chouzetsu`). Cada uno se numera
  por temporada y se corta solo al acabarse.
- El build se DETIENE cuando la fuente se acaba y OMITE fuentes que no tienen el anime
  (evita construir cientos de episodios vacíos en franquicias).

## Novedades v6

- Campo **Temporada** junto a "Episodios a agregar": si lo indicas, el rango de episodios
  aplica a esa temporada (numeración por temporada); vacío = todas (número absoluto).
  "Detectar faltantes" también respeta la temporada elegida.
- jkanime: incluye sus players propios **Desu** y **Magi**.
- Toda la ventana con **scroll**.

## Novedades v5

- **Agregar solo episodios que faltan.** Campo "Episodios a agregar" (ej. `117-125`,
  `5,8,12`, `51-`, o vacío = todos) para que construya solo esos.
- Botón **"Detectar faltantes"**: compara lo que ya tiene el anime en la web con lo que
  TMDB dice que existe y rellena el rango con los que faltan. Luego, con el modo
  "Añadir nuevo", los agrega sin tocar lo existente.

## Novedades v4

- **Audio** por anime (Sub / Sub | Dob / Latino / Castellano…) se calcula solo según lo
  encontrado y queda editable.
- **Títulos alternativos** (otros países: Kimetsu no Yaiba ↔ Demon Slayer) desde TMDB.
- Llena **TODOS los datos**: título real, títulos alternativos, estudio, géneros, año,
  descripción, y por episodio: **título, descripción, fecha de lanzamiento y duración real**.
  *(La descripción/fecha/duración por episodio requieren la TMDB API key — ver abajo.)*
- **Icono de All-Anime** en la ventana y el .exe.

## Novedades v3

- **Guarda con el nombre REAL** del anime (título oficial de TMDB), no con lo que
  escribiste para buscar.
- Trae **portada, fondo y LOGO** (el logo necesita una **TMDB API key** gratis; sin ella
  funciona todo menos el logo, que puedes pegar a mano).
- **Todo editable** antes de guardar: título, año, portada, fondo, logo, y la
  **imagen/título de cada episodio** (doble clic en un episodio para cambiar su imagen).
- Interfaz rediseñada.

### TMDB API key (opcional, para el LOGO y mejores datos)
Gratis: entra a https://www.themoviedb.org/settings/api → crea una key → copia la
**"API Key (v3 auth)"** y pégala en el campo TMDB de la app (se guarda). Con ella el logo,
el título real y las imágenes salen automáticos y más fiables.

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
   pyinstaller --onefile --noconsole --icon icon.ico --add-data "icon.ico;." --name AllAnimeImporter allanime_importer.py
   ```

4. Al terminar, el ejecutable queda en `desktop\dist\AllAnimeImporter.exe`.
   Doble clic y funciona sin tener que abrir Python.

> Si `pip` o `pyinstaller` "no se reconoce": reinstala Python marcando *Add to PATH*, o usa
> `python -m pip install pyinstaller` y `python -m PyInstaller --onefile --noconsole allanime_importer.py`.

## Notas

- La contraseña **no** se guarda en el código; la escribes al iniciar sesión.
- `animeonline.ninja` bloquea el scraping directo (Cloudflare 403), pero **su catálogo
  Latino ya viene por embed69** — por eso esa casilla dice "Latino / animeonlineninja".
