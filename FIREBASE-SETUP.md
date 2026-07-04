# Guía de conexión con Firebase — All-Anime

Sigue estos pasos **una sola vez** para dejar el sitio conectado a Firebase
(autenticación + base de datos Firestore).

---

## 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con la cuenta **all.anime.lat01@gmail.com**.
2. **Agregar proyecto** → ponle un nombre (ej. `all-anime`) → crear.

## 2. Registrar la app web

1. En el proyecto, ícono **`</>`** (Web) → registra la app (ej. `all-anime-web`).
2. Copia el objeto `firebaseConfig` que te muestra.
3. Pégalo en **[`js/firebase-config.js`](js/firebase-config.js)** reemplazando los valores `TU_...`.

## 3. Activar Authentication

1. Menú **Authentication** → **Comenzar**.
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña** → Guardar.

## 4. Crear la cuenta de administrador

Tienes dos opciones:

- **Opción A (recomendada):** abre el sitio en `cuenta.html`, ve a **Registrarse**
  y crea la cuenta con:
  - Correo: `all.anime.lat01@gmail.com`
  - Contraseña: `allanime2026`
- **Opción B:** Authentication → pestaña **Users** → **Agregar usuario** con ese
  mismo correo y contraseña.

> El sitio reconoce como administrador **solo** a ese correo (definido en
> `ADMIN_EMAIL` dentro de `js/firebase-config.js` y en `firestore.rules`).

## 5. Crear la base de datos Firestore

1. Menú **Firestore Database** → **Crear base de datos**.
2. Elige **modo producción** → selecciona la región (ej. `us-central`) → habilitar.

## 6. Publicar las reglas de seguridad

1. Firestore Database → pestaña **Reglas**.
2. Copia TODO el contenido de **[`firestore.rules`](firestore.rules)** y pégalo.
3. **Publicar**.

## 7. Importar el catálogo (los 118 animes)

1. Abre el sitio e inicia sesión con el correo admin.
2. Ve a **`admin/importar.html`**.
3. Pulsa **Iniciar importación** y espera a que llegue al 100 %.

Esto sube todos los animes y episodios de `js/database.js` a Firestore
(colección `animes` + índice `catalog/index`).

---

## Cómo servir el sitio

Firebase usa **módulos ES**, que **no funcionan abriendo el HTML con doble clic**
(`file://`). Debes servirlo por HTTP:

- **Local (rápido):** en la carpeta del proyecto ejecuta
  `npx serve` o `python -m http.server 8000` y abre `http://localhost:8000`.
- **Producción:** ya usas **GitHub Pages** (`www.all-anime.net`), que sirve por
  HTTPS, así que funciona directamente al hacer push.

> ⚠️ En la consola de Firebase, ve a **Authentication → Settings → Dominios
> autorizados** y asegúrate de que estén `localhost` y `www.all-anime.net`.

---

## Estructura de datos en Firestore

| Colección / Documento              | Contenido                                                        |
| ---------------------------------- | ---------------------------------------------------------------- |
| `animes/{animeId}`                 | Anime completo **con** su arreglo `episodes` (fuente de verdad). |
| `catalog/index`                    | Tarjetas ligeras (sin episodios) para listados y búsqueda.       |
| `meta/catalog`                     | Versión del catálogo (para invalidar caché del navegador).       |
| `users/{uid}`                      | Perfil del usuario (`email`, `displayName`, `role`).             |
| `users/{uid}/watched/{epId}`       | Episodios marcados como vistos.                                  |
| `users/{uid}/likes/{epId}`         | Likes que el usuario ha dado.                                    |
| `episodeStats/{epId}`              | Contador público de likes por episodio.                          |
| `comments/{commentId}`             | Comentarios (uno por documento).                                 |

`epId` = `animeId__t{temporada}__e{numero}` (ver `js/catalog-utils.js`).

---

## Archivos añadidos

- `js/firebase-config.js` — inicializa Firebase (**pon aquí tus claves**).
- `js/auth.js` — registro / login / logout / estado de sesión.
- `js/catalog-utils.js` — utilidades (slugs, IDs de episodio, tarjetas).
- `js/data-provider.js` — lee el catálogo desde Firestore (caché en IndexedDB + fallback a `database.js`).
- `js/engagement.js` — likes, comentarios, "visto" y siguiente/autoplay en el reproductor.
- `cuenta.html` — página de inicio de sesión y registro.
- `firestore.rules` — reglas de seguridad.
- `admin/importar.html` — importador del catálogo (una vez).
- `admin/index.html` — panel de administración.

Archivos modificados: `js/main-2025.js` (lee de Firestore, monta engagement, link de cuenta
en el header) y `anime-details.html` (contenedor de comentarios propios en el reproductor).

## Sobre el "autoplay al siguiente episodio"

Los episodios se reproducen en servidores externos (plustream, streamwish, filemoon…)
incrustados en un iframe **cross-origin**, por lo que técnicamente **no es posible
detectar el momento exacto en que termina el video**. Por eso el autoplay:

- Muestra siempre un botón **“Siguiente”** y marca el episodio como visto.
- Con la casilla **“Autoplay siguiente”** activada, tras la duración nominal del
  episodio aparece una **cuenta regresiva cancelable** que carga el siguiente.

Es lo máximo que permiten los reproductores de terceros sin control del `<video>`.

## Comportamiento sin configurar

Mientras `js/firebase-config.js` tenga los placeholders `TU_...`, el sitio sigue
funcionando **igual que antes** leyendo desde `js/database.js` (fallback automático).
Al pegar tus claves e importar el catálogo, empieza a leer desde Firestore.
