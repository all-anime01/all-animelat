# All-Anime TV (Fire TV / Android TV)

App **instalable** para televisores: un contenedor WebView optimizado para TV que
carga `https://www.all-anime.net` a pantalla completa, con reproducción de video,
video a pantalla completa y botón ATRÁS del control.

Aparece en la pantalla de inicio de **Fire TV** y **Android TV** (usa
`LEANBACK_LAUNCHER`) y también corre en teléfonos.

## APK ya compilado

Ya hay un APK listo para instalar en la raíz de esta carpeta:
**`androidtv/All-Anime-TV.apk`** (compilado en modo debug, firmado con la clave
de depuración → se puede instalar por *sideload* sin más).

## Cómo recompilar el APK

Requisitos: **Android SDK** (con la plataforma `android-36`) y **Gradle 8.11+**
(o Android Studio). Config actual: AGP 8.9.1, compileSdk/targetSdk 36, minSdk 21.

- **Android Studio:** abre `androidtv/` como proyecto → *Build → Build APK(s)*.
- **Consola:** `gradle assembleDebug` (o `assembleRelease`). El APK queda en
  `app/build/outputs/apk/debug/app-debug.apk`.

## Instalar en Fire TV / Android TV

1. En el Fire TV: *Ajustes → Mi Fire TV → Opciones de desarrollador* → activa
   **Instalar apps desconocidas** (o *Aplicaciones de fuentes desconocidas*).
2. Pasa el APK al televisor con una de estas opciones:
   - **Downloader** (app en la Amazon Appstore): sube `All-Anime-TV.apk` a
     cualquier hosting/Drive y abre el enlace desde Downloader.
   - **adb:** `adb connect IP_DEL_FIRE_TV` y luego
     `adb install "All-Anime-TV.apk"`.
   - Un gestor de archivos (Send Files to TV, X-plore) desde la red local.
3. Abre **All-Anime** desde la fila de apps del Fire TV. Navega con el control
   remoto (flechas + OK); el botón ATRÁS cierra el video o retrocede.

## Firmar para publicar (opcional)

Para distribuir necesitas firmar el APK con tu propio *keystore*:
```
keytool -genkey -v -keystore all-anime.keystore -alias allanime -keyalg RSA -keysize 2048 -validity 10000
```
Luego configura el `signingConfig` en `app/build.gradle` o firma con `apksigner`.

## Notas

- `applicationId`: `net.allanime.tv` — cámbialo si quieres publicarlo en la Amazon
  Appstore / Google Play.
- Ícono y banner son vectores provisionales (rojo con ▶). Reemplázalos por tu logo
  real en `app/src/main/res/drawable/ic_launcher.xml` y `banner.xml` (o pon PNGs).
- La navegación con control remoto la maneja el WebView. En Fire TV el control
  mueve un cursor; para una navegación 100% por D-pad (foco en tarjetas) haría falta
  ajustar el CSS/JS del sitio (estados `:focus` y orden de tabulación) — mejora futura.
- El **minSdk 21** cubre Fire TV Stick antiguos.
