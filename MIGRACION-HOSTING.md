# Migrar de GitHub Pages a Firebase Hosting (sin afectar el SEO)

> **La clave del SEO:** el dominio y las URLs **no cambian**
> (`www.all-anime.net`, `/explorar`, `/anime-details.html?id=...`). Google indexa
> URLs, no servidores. Si el dominio y las rutas se mantienen y el sitio sigue
> disponible por HTTPS, **la indexación no se ve afectada**. Solo cambiamos a
> qué servidor apunta el DNS.
>
> `firebase.json` usa `"cleanUrls": true`, que replica exactamente el
> comportamiento actual de GitHub Pages (`/explorar` → `explorar.html`).

## Requisitos previos
- Node.js instalado (ya lo tienes).
- Acceso al panel donde administras el **DNS** de `all-anime.net`
  (tu registrador: GoDaddy, Namecheap, Cloudflare, etc.).

---

## Paso 1 — Instalar Firebase CLI e iniciar sesión
```bash
npm install -g firebase-tools
firebase login
```
Se abre el navegador; inicia sesión con **all.anime.lat01@gmail.com**.

## Paso 2 — Desplegar a la URL de prueba de Firebase
Desde la carpeta del proyecto:
```bash
firebase deploy --only hosting
```
Esto publica el sitio en `https://all-anime-eae5b.web.app`.
**Ábrelo y verifica que todo funciona igual** (inicio, /explorar, fichas,
reproductor, login, admin). Aún NO se toca el dominio ni el DNS: el sitio en
producción sigue en GitHub Pages, intacto.

> Bonus: también puedes publicar las reglas de Firestore por CLI en vez de
> pegarlas a mano: `firebase deploy --only firestore:rules`

## Paso 3 — Añadir el dominio en Firebase
En la consola: **Hosting → Agregar dominio personalizado** → escribe
`www.all-anime.net` → Continuar.
Firebase te mostrará **registros DNS** (normalmente un `TXT` de verificación y
luego **dos registros `A`**).

## Paso 4 — El cambio (cutover) en el DNS
En tu registrador, reemplaza el registro actual de `www` (que hoy apunta a
GitHub Pages) por **los registros exactos que te da Firebase**.
- Deja el `TTL` bajo (300 s) para propagar rápido.
- Firebase provisiona el certificado **HTTPS automáticamente** (puede tardar
  de minutos a ~24 h).

> Mientras el DNS propaga, quien ya tenga el DNS viejo verá GitHub Pages y quien
> tenga el nuevo verá Firebase. Como el contenido es el mismo, **no hay caída ni
> páginas rotas** para Google.

## Paso 5 — Dominio raíz (apex) → redirección a www
Si `all-anime.net` (sin www) también resuelve, agrégalo en Firebase Hosting y
configúralo para **redirigir 301 a `www.all-anime.net`** (evita contenido
duplicado y mantiene el canónico como hasta ahora).

## Paso 6 — Limpiar GitHub Pages
Cuando confirmes que `www.all-anime.net` sirve desde Firebase (con HTTPS):
1. GitHub → repo → **Settings → Pages** → quita el dominio personalizado.
2. El archivo `CNAME` del repo ya no hace nada en Firebase (es inofensivo;
   puedes borrarlo en un commit posterior).

## Paso 7 — Verificación SEO (Search Console)
1. En **Google Search Console** (propiedad `www.all-anime.net`):
   - Usa **Inspección de URL** en 2-3 páginas → “Probar URL publicada” →
     debe cargar bien con HTTPS.
   - Revisa **Cobertura/Páginas** los días siguientes (no debe haber picos de
     errores).
2. No necesitas re-enviar el sitemap ni pedir reindexación: las URLs son las
   mismas.

---

## Checklist de que NO se rompe el SEO
- [x] Mismo dominio `www.all-anime.net`.
- [x] Mismas rutas (`cleanUrls: true` en `firebase.json`).
- [x] HTTPS válido (cert automático de Firebase).
- [x] Sitio disponible durante la propagación (contenido idéntico en ambos).
- [x] Apex `all-anime.net` → 301 a `www` (igual que el canónico actual).

## (Opcional) Evitar que `*.web.app` compita en Google
Firebase también sirve el sitio en `all-anime-eae5b.web.app`. Para que Google no
lo trate como duplicado, lo más simple es añadir en el `<head>` de las páginas:
```html
<link rel="canonical" href="https://www.all-anime.net/RUTA-DE-ESTA-PAGINA">
```
Dímelo y lo agrego a todas las páginas automáticamente.
