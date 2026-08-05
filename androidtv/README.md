# All-Anime TV (Fire TV / Android TV)

App **instalable** para televisores: un contenedor WebView optimizado para TV que
carga `https://www.all-anime.net` a pantalla completa, con reproducción de video,
video a pantalla completa y botón ATRÁS del control.

Aparece en la pantalla de inicio de **Fire TV** y **Android TV** (usa
`LEANBACK_LAUNCHER`) y también corre en teléfonos.

## Cómo compilar el APK

1. Instala **Android Studio** (incluye el SDK y Gradle).
2. Abre esta carpeta `androidtv/` como proyecto (Android Studio genera el Gradle
   Wrapper la primera vez).
3. **Build → Build Bundle(s)/APK(s) → Build APK(s)**. El APK queda en
   `app/build/outputs/apk/`.
   - Alternativa por consola (con el wrapper ya generado): `./gradlew assembleRelease`.

## Instalar en Fire TV / Android TV

- **Fire TV:** activa *Aplicaciones de fuentes desconocidas* y usa *Downloader* o
  `adb install app-release.apk` (conectando por IP: `adb connect IP_DEL_FIRE_TV`).
- **Android TV:** `adb install app-release.apk` o cópialo con un gestor de archivos.

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
