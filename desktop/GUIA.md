# Guía completa — All-Anime Scrapper

Aplicación de escritorio para agregar y mantener el catálogo de All-Anime: buscas un título
y arma el anime con sus **datos reales** (título original, global y Latinoamérica, imágenes,
temporadas, OVAs y películas) y sus **servidores por episodio** en Latino y Sub, todo
editable antes de guardar. Incluye a **Yoru**, el asistente de voz.

---

## 1. Iniciar

1. Abre **AllAnimeImporter.exe** (o `python allanime_importer.py`).
2. En **Cuenta y ajustes** escribe el **correo y contraseña de admin**. Marca **«Recordar
   sesión»** para que entre sola la próxima vez.
3. (Opcional pero recomendado) pega tu **TMDB API key** (v3) → habilita logo, títulos por
   país e imágenes/descripciones por episodio.
4. Pulsa **Iniciar sesión**. Se carga tu catálogo para buscar y editar.
5. Marca **🔊 Yoru (voz)** si quieres que el asistente te avise por voz cuando empieza la
   búsqueda, cuántas temporadas encontró y cuándo termina/guarda.

---

## 2. Agregar un anime nuevo (serie)

1. Escribe el **título** en el campo grande (deja **Tipo** en *Auto*).
2. Deja marcadas las fuentes: **embed69** (Latino/PelisPlus), **animeav1** (Latino+Sub, HLS),
   **jkanime** (Sub: Desu/Magi…). *Manual* solo si vas a pegar URLs tú.
3. Pulsa **Buscar y construir**. La app:
   - resuelve el título real + títulos **original (japonés)**, **global (inglés)** y **LatAm**;
   - descubre **todas las temporadas** aunque en jkanime/animeav1 estén separadas por
     secuelas (incluso con nombre distinto, vía la cadena de **AniList**: Tokyo Ghoul √A/:re,
     Megalo Box Nomad, InuYasha Final Act…);
   - anexa **OVAs** si la fuente las tiene;
   - trae los servidores por episodio con la **prioridad**: Filemoon (byse) → StreamWish →
     Vidara → PelisPlus/embed69 → HLS (animeav1) → Desu (jkanime) → VidHide.
4. Revisa la **Vista previa** (Temporada · Ep · Título · Duración · Idioma · Imagen · N° de
   servidores · lista). Los episodios con **Latino** salen resaltados en verde.
5. Ajusta lo que quieras (ver §7) y pulsa **Guardar en la web**. Al guardar se limpia solo.

> **Regla de la casa:** si el anime tiene doblaje **Latino**, se agrega siempre.

---

## 3. Películas

- **Una película:** escribe su título (o pon **Tipo → Película**) y **Buscar y construir**.
  Se guarda como entrada tipo «Película».
- **Colección (varias películas en una entrada, tipo «Dragon Ball Películas»):** *en camino*
  como modo «Películas (colección)». Por ahora se arman como entradas individuales.

## 4. OVA / ONA / especiales

Se detectan automáticamente si la fuente tiene el slug (`{anime}-ova`, `-ovas`, `-oad`…) y
se **anexan al mismo anime** como bloque **«OVAs»** con numeración propia.

---

## 5. Completar / editar un anime que ya existe

1. En **Buscar en tu catálogo** escribe parte del nombre → selecciona en la lista → **Cargar**.
   Se muestra su lista completa; en **«Ver temporada»** puedes filtrar por temporada.
2. Para **sumar episodios/temporadas nuevas** (un estreno, o una temporada que faltaba):
   **➕ Añadir episodios nuevos**. Solo agrega lo que falta, **sin tocar** el resto ni tus
   servidores. (Opcional: **Temporada destino** o **Detectar faltantes** para el rango.)
3. Para **reparar** episodios concretos: márcalos en la lista (Ctrl/Shift+clic) y usa
   **➕ Agregar Latino**, **🔧 Reparar servers** (conserva tus subidas de Vidara) o
   **🖼 Reparar imagen**. Siempre pregunta antes.
4. **↶ Revertir último cambio** deshace el último guardado de ese anime.

---

## 6. Agregar VARIOS a la vez (Lote)

Botón **🧾 Lote**: pega **un título por línea** y **Procesar y guardar todo**. Construye y
guarda cada uno automáticamente (series y películas se reconocen solas). Yoru va narrando.

---

## 7. Editar antes de guardar

- **Ficha del anime:** título, año, títulos alternativos, audio, estudio, portada, fondo, logo.
- **Por episodio:** doble clic en una fila para cambiar su **imagen**.
- **Temporada destino / Ver temporada:** filtra y decide dónde entran los episodios nuevos.
- **Prioridad de servidores:** escribe el orden que quieras (o deja el de por defecto);
  marca «solo estos» para descartar los demás. Máx. 3–4 por idioma.
- **🧹 Limpiar:** deja todo en blanco para el siguiente (también se limpia solo al guardar).

---

## 8. Yoru — asistente de voz

Marca **🔊 Yoru (voz)**. Te avisa cuando **inicia** una búsqueda, cuántas **temporadas**
encontró y qué va a scrapear, y cuando **termina** o **guarda**. Usa la voz del sistema
(Windows); si tienes una voz en español instalada, hablará en español.

> *Nota:* Yoru hoy es el asistente de **voz + estado**. Para hacerlo "más inteligente" de
> verdad (que interprete pedidos libres) se puede conectar un modelo (API de Claude/OpenAI
> o un modelo local) — pídemelo y lo integro con tu clave.

---

## 9. Problemas frecuentes

- **No trae Latino de un anime que sí lo tiene:** revisa el log por episodio
  (`embed69=.. av1=.. jk=.. Latino=..`); a veces el slug de esa temporada difiere. Usa
  «Slug(s) de la fuente» manual (varios por coma para franquicias con nombres raros:
  `beyblade-burst, beyblade-burst-god`).
- **Error al guardar tras varios/muy largo:** ya se renueva la sesión sola y reintenta.
- **La barra no coincide:** corregido; el total sale de AniList/TMDB.
- **Regenerar el .exe:** con la app cerrada, en la carpeta `desktop`:
  `pyinstaller --onefile --noconsole --icon icon.ico --add-data "icon.ico;." --name AllAnimeImporter allanime_importer.py`

Ver **README.md** para el historial de novedades por versión.
