# All-Anime — Motor de scraping (Cloudflare Worker)

Backend mínimo que hace lo que el navegador NO puede por **CORS**: resolver IMDB/TMDB,
sacar metadata + imágenes por episodio y extraer servidores de **embed69, jkanime,
tioanime, animeav1** y **URLs manuales** (animeonlineninja / porygonsubs vía extractor
genérico). El admin (`/admin/scraper.html`) lo llama, arma la vista previa y guarda en
Firestore.

## Desplegar (una sola vez, gratis)

1. Crea una cuenta gratis en https://dash.cloudflare.com (no pide tarjeta).
2. Instala Node y luego: `npm i -g wrangler`
3. En esta carpeta (`worker/`): `wrangler login` (autoriza en el navegador).
4. Pon el token de acceso (el mismo que usarás en el admin):
   `wrangler secret put API_KEY` → escribe una contraseña larga.
5. Publica: `wrangler deploy`
   Te dará una URL tipo `https://allanime-scraper.TU-USUARIO.workers.dev`.
6. En el admin → **Importar (scraper)**: pega esa URL y el API_KEY, pulsa **Probar conexión**.

## Endpoints (GET, requieren `?key=API_KEY`)

- `/resolve?title=&year=` → `{ imdb, tmdbId }`
- `/meta?tmdb=ID` → `{ poster, backdrop, description, genres, year }`
- `/stills?tmdb=ID&maxS=8` → `{ flat: {"1x1":{still,title,...}}, seasons }`
- `/embed69?imdb=tt..&s=1&e=1` → `{ langs, servers:[{lang,name,url}], wrapper }`
- `/jkanime?slug=&n=` · `/tioanime?slug=&n=` · `/animeav1?slug=&n=` → `{ servers }`
- `/extract?url=` → `{ embeds, m3u8, e69, imdb }` (URL manual / otros sitios)
- `/fetch?url=&ref=` → `{ status, html }` (crudo, para casos especiales)

## Actualizar

Edita `src/index.js` y vuelve a `wrangler deploy`. Para añadir una fuente nueva, agrega
una función y una ruta en el `switch` de `fetch()`.
