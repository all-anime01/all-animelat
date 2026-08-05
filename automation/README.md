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

jkanime y tioanime suelen entregar **720p**. Para **1080p real** la mejor fuente es
**AnimeAV1**, pero su web se arma por JavaScript (Nuxt) y NO se puede leer con un
simple `fetch`: hace falta un navegador headless (Playwright) en el workflow. Es el
siguiente paso para cumplir el requisito de 1080p — está anotado como pendiente.

## Pendiente (siguientes iteraciones)

- Fuente **1080p (AnimeAV1)** con navegador headless.
- **Descubrir animes populares nuevos** automáticamente (TMDB trending + estrenos de
  temporada) y crearlos como borrador para tu aprobación.
- **Importador en el panel admin** (bajo demanda): pegar un anime y traerlo al instante.
