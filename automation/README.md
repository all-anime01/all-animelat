# Automatización de all-anime

Sistema para que los animes **En emisión** sumen sus **episodios nuevos solos**,
en el mismo formato de la página, para que tú solo revises/ajustes el video y la
calidad.

## Cómo funciona

- `update-airing.mjs` lee `sources.json`, y por cada anime **habilitado** busca en
  su fuente (jkanime / tioanime) episodios más allá del último que ya tienes en
  Firestore. Los agrega con **servidores + imagen + descripción + fecha** (TMDB).
- Los episodios nuevos quedan marcados con `autoAdded: true` para que los ubiques
  fácil en el admin y les ajustes lo que quieras.
- Corre solo cada día vía **GitHub Actions** (`.github/workflows/auto-update.yml`),
  o a mano desde la pestaña **Actions → Auto-actualizar episodios → Run workflow**.

## Configuración (una sola vez)

1. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   Crea estos 3 secretos (NUNCA van en el código):
   - `FB_API_KEY` — la Web API Key de Firebase.
   - `FB_ADMIN_EMAIL` — el correo admin con permiso de escritura en Firestore.
   - `FB_ADMIN_PASSWORD` — su contraseña.
2. Agrega tus animes En emisión a `automation/sources.json`:
   ```json
   { "fsId": "one-piece", "source": "jkanime", "slug": "one-piece",
     "tvId": 37854, "season": "Temporada 22", "enabled": true }
   ```
   - `source`: `jkanime` o `tioanime`.
   - `slug`: el identificador del anime en esa fuente (ej. en `jkanime.net/one-piece/` el slug es `one-piece`).
   - `tvId`: id del show en TMDB (para imagen/sinopsis/fecha).
   - `season`: nombre EXACTO de la temporada en Firestore donde se agregan los nuevos.

## Probar sin escribir

```bash
FB_API_KEY=... FB_ADMIN_EMAIL=... FB_ADMIN_PASSWORD=... DRY_RUN=1 node automation/update-airing.mjs
```

## Sobre la calidad 1080p / HD

**animeav1 = HD/1080p y SÍ es scrapeable** (sus páginas `/media/{slug}/{N}` traen los
embeds Mega/mp4upload en el HTML). Es la **fuente preferida** en `SOURCES`. Úsala en
`sources.json`/`watchlist.json` con `"source": "animeav1"` y el slug de animeav1
(ej. `digimon-ghost-game`). jkanime/tioanime (~720p) quedan como respaldo.

## Ampliar el catálogo con animes clásicos/populares

`expand-catalog.mjs` lee `watchlist.json` y crea los animes que aún no existan, con
**servidores verificados** (un episodio solo se agrega si su video realmente carga →
nunca se sube contenido roto). Corre igual que el actualizador (workflow o a mano).

Agrega entradas a `watchlist.json` con `enabled: true`:
```json
{ "fsId": "cowboy-bebop", "title": "Cowboy Bebop", "source": "tioanime",
  "slug": "cowboy-bebop", "tvId": 30991, "maxEp": 26, "year": 1998,
  "audio": "Sub", "genres": ["Acción"], "enabled": true }
```

## Garantía de calidad

Tanto el actualizador como el expansor usan `verifiedServers()`: comprueban por HTTP
que cada embed **carga y no está borrado** antes de guardarlo. Si ningún servidor de
un episodio funciona, ese episodio **no se agrega**.

## Pendiente (siguientes iteraciones)

- Fuente **1080p (AnimeAV1)** con navegador headless (Playwright) — es lo único que
  garantiza 1080p real; jkanime/tioanime son 720p.
- **Descubrir automáticamente** los estrenos de temporada (TMDB) para llenar la
  watchlist solo.
- **Importador en el panel admin** (bajo demanda).
