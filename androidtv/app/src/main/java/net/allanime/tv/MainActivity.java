package net.allanime.tv;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Message;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;

import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.PlayerView;

import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * App WebView para Android (móvil) y Android TV / Fire TV. Carga el sitio
 * all-anime a pantalla completa, con reproducción de video y video fullscreen.
 *
 * Anuncios de los servidores externos (ventanas emergentes / popunders):
 *  - Si el usuario tiene "sin publicidad" (pagó o el admin se lo activó, se lee
 *    de localStorage `aa_adfree` del sitio) → los popups se BLOQUEAN
 *    automáticamente y el video sigue donde estaba.
 *  - Si no → el popup se abre en una ventana con un botón "✕ Cerrar anuncio"
 *    para cerrarlo a mano y volver a lo que estaba.
 */
public class MainActivity extends Activity {

    private static final String SITE_URL = "https://www.all-anime.net";

    private WebView webView;
    private FrameLayout rootLayout;
    private View customView;                        // video a pantalla completa
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout popupContainer;             // ventana de anuncio (se REUTILIZA)
    private WebView popupView;                       // WebView del anuncio (se REUTILIZA, no se destruye)
    private Button popupClose;
    private boolean popupOpen = false;
    private Runnable pendingAutoClose;
    private boolean adFree = false;                 // "sin publicidad" del usuario

    // Cursor virtual (para llegar a los controles del reproductor del server, que
    // es de otro origen y no se puede navegar con el D-pad). Se mueve con las
    // flechas y OK inyecta un TOQUE real en la WebView (sí alcanza el iframe).
    private View cursorView;
    private boolean cursorMode = false;
    private float curX, curY;
    private static final int CURSOR_DP = 42;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        rootLayout = new FrameLayout(this);
        setContentView(rootLayout);
        createMainWebView();
    }

    // Crea (o recrea, tras un crash del render) el WebView principal.
    private void createMainWebView() {
        webView = new WebView(this);
        rootLayout.addView(webView, 0, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // permite autoplay tras click
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(true);              // para interceptar popups de anuncios
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        // UA igual que en las primeras versiones que SÍ reproducían (el "wv" NO era el
        // problema: esa versión lo tenía y funcionaba). Sufijo para que el sitio sepa
        // que es la app; detección también por el puente window.AAApp.
        String ua = s.getUserAgentString() + " AllAnimeApp/1.0";
        if (BuildConfig.IS_TV) ua += " AllAnimeTV/1.0";
        s.setUserAgentString(ua);

        // NOTA: NO forzar setLayerType ni setBackgroundColor(BLACK) — un fondo opaco
        // sobre la WebView puede TAPAR la capa de video (SurfaceView) y dejarla negra.
        // Se deja el comportamiento por defecto (hardware accel del manifest), que es
        // como el video se veía bien antes.
        // (Se probó LAYER_TYPE_SOFTWARE y fue PEOR: no pintaba y muy lento. Revertido:
        //  se deja la aceleración por hardware por defecto.)
        // Borra la caché al abrir → la app siempre carga la ÚLTIMA versión del sitio
        // (JS/CSS), así los arreglos web se aplican SIN tener que reinstalar la APK.
        webView.clearCache(true);
        webView.setWebViewClient(new AppClient(true));
        webView.setWebChromeClient(new AppChrome());
        // Puente JS: la web (botón "Cursor" en el reproductor de TV) puede activar
        // el cursor virtual aunque el control remoto no tenga botón de menú.
        webView.addJavascriptInterface(new AABridge(), "AAApp");
        webView.loadUrl(SITE_URL);
    }

    // Puente accesible desde el sitio como window.AAApp.*
    private class AABridge {
        @JavascriptInterface public void toggleCursor() { runOnUiThread(() -> toggleCursor()); }
        @JavascriptInterface public boolean cursorAvailable() { return true; }
        @JavascriptInterface public boolean isTV() { return BuildConfig.IS_TV; }
        @JavascriptInterface public void videoLoaded() { /* no-op */ }
        // El sitio avisa el server elegido → la app intenta EXTRAER el video directo y
        // reproducirlo en ExoPlayer nativo (la WebView deja estos hosts en negro). Si no
        // puede extraer, no hace nada y queda la WebView (iframe) de respaldo.
        @JavascriptInterface public void playNative(String url) {
            if (url == null || url.isEmpty()) return;
            String h; try { h = new java.net.URL(url).getHost(); } catch (Exception e) { h = url; }
            final String host = h;
            runOnUiThread(() -> toast("All-Anime TV: cargando " + host + "…"));
            new Thread(() -> {
                final Extractor.Result r = Extractor.extract(url);
                runOnUiThread(() -> {
                    if (r != null && r.url != null) { toast("▶ Reproduciendo en All-Anime TV"); playNativeStream(r); }
                    else toast("No se pudo extraer " + host + " — usando reproductor web");
                });
            }).start();
        }
    }

    // ===== Reproductor NATIVO (ExoPlayer) =====================================
    private ExoPlayer exo;
    private PlayerView playerView;
    private FrameLayout exoContainer;
    private boolean exoOpen = false;

    @UnstableApi
    private void ensureExo() {
        if (exo != null) return;
        exo = new ExoPlayer.Builder(this).build();
        playerView = new PlayerView(this);
        playerView.setPlayer(exo);
        playerView.setUseController(true);
        playerView.setControllerShowTimeoutMs(3500);
        playerView.setBackgroundColor(Color.BLACK);
        exoContainer = new FrameLayout(this);
        exoContainer.setBackgroundColor(0xFF000000);
        exoContainer.setVisibility(View.GONE);
        exoContainer.addView(playerView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        rootLayout.addView(exoContainer, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    @UnstableApi
    private void playNativeStream(Extractor.Result r) {
        try {
            ensureExo();
            Map<String, String> headers = new HashMap<>();
            if (r.referer != null) headers.put("Referer", r.referer);
            DefaultHttpDataSource.Factory dsf = new DefaultHttpDataSource.Factory()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .setAllowCrossProtocolRedirects(true)
                    .setDefaultRequestProperties(headers);
            exo.setMediaSource(new DefaultMediaSourceFactory(dsf).createMediaSource(MediaItem.fromUri(r.url)));
            exoContainer.setVisibility(View.VISIBLE);
            exoContainer.bringToFront();
            playerView.requestFocus();
            exoOpen = true;
            exo.prepare();
            exo.setPlayWhenReady(true);
        } catch (Exception ignored) {}
    }

    @UnstableApi
    private void closeExo() {
        if (!exoOpen) return;
        exoOpen = false;
        try { if (exo != null) { exo.setPlayWhenReady(false); exo.stop(); exo.clearMediaItems(); } } catch (Exception ignored) {}
        if (exoContainer != null) exoContainer.setVisibility(View.GONE);
        if (webView != null) webView.requestFocus();
    }

    // Inyecta un gesto de scroll (baja y vuelve) en la WebView del frente → fuerza a
    // Chromium a recomponer y PINTAR el video que estaba en negro.
    private void nudgeScroll() {
        WebView t = (customView != null) ? webView : webView;   // el scroll va a la webView del sitio
        if (t == null) return;
        int w = t.getWidth(), h = t.getHeight();
        if (w <= 0 || h <= 0) return;
        float x = w / 2f, y = h * 0.82f;   // en la zona de detalles (debajo del video)
        swipe(t, x, y, x, y - dp(90));      // baja
        rootLayout.postDelayed(() -> swipe(t, x, y - dp(90), x, y), 140);   // vuelve
    }
    private void swipe(View v, float x1, float y1, float x2, float y2) {
        long t0 = SystemClock.uptimeMillis();
        try {
            MotionEvent d = MotionEvent.obtain(t0, t0, MotionEvent.ACTION_DOWN, x1, y1, 0);
            v.dispatchTouchEvent(d); d.recycle();
            for (int i = 1; i <= 4; i++) {
                float xi = x1 + (x2 - x1) * i / 4f, yi = y1 + (y2 - y1) * i / 4f;
                MotionEvent m = MotionEvent.obtain(t0, t0 + i * 12, MotionEvent.ACTION_MOVE, xi, yi, 0);
                v.dispatchTouchEvent(m); m.recycle();
            }
            MotionEvent u = MotionEvent.obtain(t0, t0 + 60, MotionEvent.ACTION_UP, x2, y2, 0);
            v.dispatchTouchEvent(u); u.recycle();
        } catch (Exception ignored) {}
    }

    // Relanzar la app desde el launcher (Fire TV / teléfono) vuelve al INICIO en
    // vez de reanudar donde se quedó (lo pidió el usuario). singleTask entrega el
    // intent aquí en vez de recrear la actividad.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        boolean launcher = intent != null && Intent.ACTION_MAIN.equals(intent.getAction())
                && (intent.hasCategory(Intent.CATEGORY_LAUNCHER) || intent.hasCategory(Intent.CATEGORY_LEANBACK_LAUNCHER));
        if (launcher) goHome();
    }

    // Cierra popups/fullscreen/cursor, BORRA la caché y carga el inicio del sitio
    // FRESCO (así los cambios web se ven sí o sí al reabrir).
    private void goHome() {
        if (popupOpen) closePopup();
        if (customView != null) hideCustomVideo();
        if (cursorMode) toggleCursor();
        if (webView != null) { webView.clearCache(true); webView.loadUrl(SITE_URL); }
    }

    // Dominios de anuncios/tracking a bloquear cuando el usuario tiene adFree.
    private static final String[] AD_HOSTS = {
        "temptedrecognise.com", "effectivecpmnetwork.com", "acscdn.com", "tercetacker.com",
        "adsterra", "propellerads", "propu.sh", "poweredby.jads", "onclickalgo", "hilltopads",
        "popads", "popcash", "adnxs", "doubleclick.net", "googlesyndication.com", "adservice.google",
        "clickadu", "admaven", "mgid.com", "revcontent", "outbrain", "taboola", "exoclick",
        "juicyads", "trafficjunky", "a-ads", "monetag", "clickadilla",
    };
    private boolean isAdHost(String url) {
        if (url == null) return false;
        String u = url.toLowerCase();
        for (String h : AD_HOSTS) if (u.contains(h)) return true;
        return false;
    }

    // Redes de anuncios INTRUSIVAS a bloquear a nivel de red (estilo Brave), para
    // TODOS. SIN dominios de Google (YouTube/otros players los necesitan).
    private static final String[] INTRUSIVE_ADS = {
        "temptedrecognise.com", "effectivecpmnetwork.com", "acscdn.com", "tercetacker.com",
        "adsterra", "propellerads", "propu.sh", "poweredby.jads", "onclickalgo", "hilltopads",
        "popads", "popcash", "clickadu", "admaven", "mgid.com", "revcontent", "outbrain",
        "taboola", "exoclick", "juicyads", "trafficjunky", "a-ads", "monetag", "clickadilla",
        "adnxs", "hilltopads", "onclickmax", "admixer", "adskeeper", "bidgear",
    };
    private boolean isIntrusiveAd(String u) {
        for (String h : INTRUSIVE_ADS) if (u.contains(h)) return true;
        return false;
    }
    // ¿Debe bloquearse esta navegación? (esquemas que sacan de la app o el market)
    private boolean blocksNavigation(String url) {
        if (url == null) return false;
        String u = url.toLowerCase();
        if (!(u.startsWith("http://") || u.startsWith("https://"))) return true;  // market:, intent:, etc.
        return u.contains("play.google.com") || u.contains("://market.android.com") || u.contains("amazon.com/gp/mas");
    }

    // Cliente WebView compartido (ventana principal y popups).
    private class AppClient extends WebViewClient {
        private final boolean main;
        AppClient(boolean main) { this.main = main; }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            return handle(view, req.getUrl() != null ? req.getUrl().toString() : null);
        }
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) { return handle(view, url); }

        private boolean handle(WebView view, String url) {
            // Impide que un anuncio abra Google Play u otra app y deje atrapado al
            // usuario fuera de All-Anime. Se queda todo dentro del WebView.
            if (blocksNavigation(url)) { return true; }
            // Impide que un anuncio del servidor SECUESTRE la pantalla principal
            // navegándola a un dominio de anuncios (dejaría al usuario sin episodio
            // y sin forma de cerrar). Se bloquea en la ventana principal; los popups
            // legítimos de anuncios pasan por onCreateWindow (con botón de cerrar).
            if (main && isAdHost(url)) { return true; }
            if (url != null) view.loadUrl(url);
            return true;
        }

        // Si el proceso de render del WebView muere (OOM por video + anuncios en
        // Fire TV), NO se deja crashear la app: se descarta ese WebView y se
        // recupera (recargando el sitio o cerrando el popup del anuncio).
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            try {
                if (view == popupView) {
                    // El render del popup murió: reinicia por completo el popup (se
                    // recreará solo en el próximo anuncio).
                    popupOpen = false;
                    if (popupContainer != null) { rootLayout.removeView(popupContainer); popupContainer = null; }
                    try { popupView.destroy(); } catch (Exception ignored) {}
                    popupView = null; popupClose = null;
                    return true;
                }
                if (view == webView) {
                    rootLayout.removeView(webView);
                    webView.destroy();
                    webView = null;
                    createMainWebView();
                    return true;
                }
                rootLayout.removeView(view);
                view.destroy();
            } catch (Exception ignored) {}
            return true; // true = manejado → la app no se cierra
        }

        // BLOQUEO estilo Brave (para TODOS): corta a nivel de red las redes de anuncios
        // INTRUSIVAS (popunders/trackers tipo Adsterra) → mejor experiencia en los
        // servers. IMPORTANTE: NO se bloquean dominios de Google (doubleclick/
        // googlesyndication/adservice) porque YouTube/otros reproductores los necesitan
        // y bloquearlos deja el video en negro. El negro que quedaba NO era esto (es un
        // bug de repintado que se arregla con el micro-scroll del sitio).
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            String url = req.getUrl() != null ? req.getUrl().toString().toLowerCase() : null;
            if (url != null && isIntrusiveAd(url)) {
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
            return super.shouldInterceptRequest(view, req);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (main) refreshAdFree();
        }
    }

    // Lee localStorage.aa_adfree del sitio para saber si bloquear anuncios.
    private void refreshAdFree() {
        try {
            webView.evaluateJavascript(
                "(function(){try{var v=localStorage.getItem('aa_adfree');return (v==='1'||(v&&Date.now()<parseInt(v,10)))?'1':'0';}catch(e){return '0';}})()",
                value -> adFree = value != null && value.contains("1"));
        } catch (Exception ignored) {}
    }

    private class AppChrome extends WebChromeClient {
        // Video a pantalla completa (reproductor de episodios).
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) { callback.onCustomViewHidden(); return; }
            customView = view;
            customViewCallback = callback;
            rootLayout.addView(customView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            webView.setVisibility(View.GONE);
        }

        @Override
        public void onHideCustomView() { hideCustomVideo(); }

        // El sitio/servidor intenta abrir una ventana nueva (anuncio popunder).
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            // BLOQUEO ESTILO BRAVE (return false): confirmado por el usuario que ESTO
            // funciona y NO crashea; el video reproduce bien con el bloqueo activo. NO
            // reabrir el popup (eso reintroducía el crash). El popunder simplemente no
            // se abre; el video sigue. Redes de anuncios ya filtradas en
            // shouldInterceptRequest (solo adFree) y redirects en handle() (main && isAdHost).
            return false;
        }
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_LONG).show(); }

    // ===== Cursor virtual =====================================================
    // Clave: el cursor es un View ENFOCABLE con su propio OnKeyListener. Al activarlo
    // le damos el foco → el D-pad va al cursor y NO a la WebView (que si tiene el
    // foco se come las flechas durante el video, por eso antes "no se movía").
    private boolean isCursorKey(int keyCode) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_LEFT: case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A: case KeyEvent.KEYCODE_BACK:
                return true;
            default: return false;
        }
    }

    private void ensureCursor() {
        if (cursorView != null) return;
        cursorView = new View(this);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(0x55FFFFFF);
        g.setStroke(dp(3), 0xFFFF5A3C);
        cursorView.setBackground(g);
        cursorView.setElevation(dp(12));
        cursorView.setFocusable(true);
        cursorView.setFocusableInTouchMode(true);
        int sz = dp(CURSOR_DP);
        cursorView.setVisibility(View.GONE);
        rootLayout.addView(cursorView, new FrameLayout.LayoutParams(sz, sz));
        cursorView.setOnKeyListener((v, keyCode, ev) -> {
            if (!cursorMode) return false;
            if (!isCursorKey(keyCode)) return false;
            if (ev.getAction() == KeyEvent.ACTION_DOWN) {
                int step = ev.getRepeatCount() > 2 ? dp(85) : dp(42);
                switch (keyCode) {
                    case KeyEvent.KEYCODE_DPAD_LEFT:  moveCursor(-step, 0); break;
                    case KeyEvent.KEYCODE_DPAD_RIGHT: moveCursor(step, 0);  break;
                    case KeyEvent.KEYCODE_DPAD_UP:    moveCursor(0, -step); break;
                    case KeyEvent.KEYCODE_DPAD_DOWN:  moveCursor(0, step);  break;
                    case KeyEvent.KEYCODE_DPAD_CENTER:
                    case KeyEvent.KEYCODE_ENTER:
                    case KeyEvent.KEYCODE_BUTTON_A:   cursorTap(); break;
                    case KeyEvent.KEYCODE_BACK:       toggleCursor(); break;
                }
            }
            return true;   // consume DOWN y UP de estas teclas (la WebView no las ve)
        });
    }

    private void toggleCursor() {
        ensureCursor();
        cursorMode = !cursorMode;
        if (cursorMode) {
            curX = rootLayout.getWidth() / 2f;
            curY = rootLayout.getHeight() / 2f;
            cursorView.setVisibility(View.VISIBLE);
            cursorView.bringToFront();
            positionCursor();
            // La WebView deja de ser enfocable → NO puede quedarse con el D-pad
            // (esa era la causa de que el cursor "no se moviera" con el video).
            if (webView != null) { webView.setFocusable(false); webView.setFocusableInTouchMode(false); }
            if (customView != null) customView.setFocusable(false);
            // El cursor es lo único enfocable y toma el foco → recibe las flechas.
            cursorView.requestFocus();
            toast("Cursor activado · mueve con las flechas, OK para pulsar, ATRÁS para salir");
        } else {
            cursorView.setVisibility(View.GONE);
            if (webView != null) { webView.setFocusable(true); webView.setFocusableInTouchMode(true); }
            if (customView != null) customView.setFocusable(true);
            View t = (customView != null) ? customView : webView;
            if (t != null) t.requestFocus();     // devuelve el foco al contenido
        }
    }

    private void positionCursor() {
        if (cursorView == null) return;
        curX = Math.max(0, Math.min(rootLayout.getWidth() - 1, curX));
        curY = Math.max(0, Math.min(rootLayout.getHeight() - 1, curY));
        int sz = dp(CURSOR_DP);
        cursorView.setX(curX - sz / 2f);
        cursorView.setY(curY - sz / 2f);
    }

    private void moveCursor(int dx, int dy) { curX += dx; curY += dy; positionCursor(); }

    // La vista que está al frente (video fullscreen > popup de anuncio > principal).
    private View cursorTarget() {
        if (customView != null) return customView;
        if (popupOpen && popupView != null) return popupView;
        return webView;
    }

    // Inyecta un toque real en la vista destino en la posición del cursor. Como es
    // un MotionEvent nativo, atraviesa el hit-test del DOM y SÍ pulsa los controles
    // del iframe del server (cross-origin) — imposible desde JS.
    private void cursorTap() {
        View t = cursorTarget();
        if (t == null) return;
        int[] rloc = new int[2]; rootLayout.getLocationOnScreen(rloc);
        int[] tloc = new int[2]; t.getLocationOnScreen(tloc);
        float x = curX + rloc[0] - tloc[0];
        float y = curY + rloc[1] - tloc[1];
        long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, x, y, 0);
        MotionEvent up = MotionEvent.obtain(now, now + 60, MotionEvent.ACTION_UP, x, y, 0);
        try { t.dispatchTouchEvent(down); t.dispatchTouchEvent(up); } catch (Exception ignored) {}
        down.recycle(); up.recycle();
        // El toque puede robar el foco (p. ej. si abre pantalla completa del server);
        // lo recuperamos para seguir moviendo el cursor con el D-pad.
        if (cursorMode && cursorView != null) {
            cursorView.bringToFront();
            cursorView.postDelayed(() -> { if (cursorMode && cursorView != null) cursorView.requestFocus(); }, 120);
        }
    }

    // Crea (UNA sola vez) el contenedor + WebView del anuncio + botón de cierre.
    // Se REUTILIZAN en cada anuncio: NUNCA se destruyen mientras la app vive. Ese
    // era el crash "a la 2ª publicidad": destruir el WebView del popup en cada cierre.
    private void ensurePopup() {
        if (popupContainer != null) return;
        popupContainer = new FrameLayout(this);
        popupContainer.setBackgroundColor(0xCC000000);
        popupContainer.setVisibility(View.GONE);

        popupView = new WebView(this);
        WebSettings ps = popupView.getSettings();
        ps.setJavaScriptEnabled(true);
        ps.setDomStorageEnabled(true);
        ps.setSupportMultipleWindows(true);
        ps.setJavaScriptCanOpenWindowsAutomatically(true);
        popupView.setWebViewClient(new AppClient(false));   // bloquea market/Play + recupera crashes
        popupView.setWebChromeClient(new WebChromeClient() {
            @Override public void onCloseWindow(WebView w) { closePopup(); }
            // Un anuncio dentro del popup intenta abrir OTRA ventana: se ignora.
            @Override public boolean onCreateWindow(WebView v, boolean d, boolean g, Message m) { return false; }
        });
        popupContainer.addView(popupView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        int pad = dp(14), mar = dp(16);
        popupClose = new Button(this);
        popupClose.setAllCaps(false);
        popupClose.setTextColor(Color.WHITE);
        popupClose.setBackgroundColor(0xFFE0231F);
        popupClose.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        popupClose.setPadding(dp(22), pad, dp(22), pad);
        popupClose.setElevation(dp(8));
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        clp.gravity = Gravity.TOP | Gravity.END;
        clp.setMargins(mar, mar, mar, mar);
        popupClose.setOnClickListener(v -> closePopup());
        popupClose.setFocusable(true);
        popupClose.setFocusableInTouchMode(false);
        popupContainer.addView(popupClose, clp);
    }

    // Muestra el anuncio del servidor en el WebView REUTILIZABLE.
    private void openPopup(Message resultMsg, boolean autoClose) {
        ensurePopup();
        if (pendingAutoClose != null) { rootLayout.removeCallbacks(pendingAutoClose); pendingAutoClose = null; }
        popupClose.setText(autoClose ? "✕  CERRAR ANUNCIO  (cerrando…)" : "✕  CERRAR ANUNCIO");
        if (popupContainer.getParent() == null) {
            rootLayout.addView(popupContainer, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        popupContainer.setVisibility(View.VISIBLE);
        popupContainer.bringToFront();
        popupClose.bringToFront();
        popupOpen = true;
        popupClose.requestFocus();   // en Fire TV queda resaltado para cerrarlo con OK

        WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
        t.setWebView(popupView);
        resultMsg.sendToTarget();

        if (autoClose) { pendingAutoClose = this::closePopup; rootLayout.postDelayed(pendingAutoClose, 2000); }
    }

    // Cierra el anuncio: oculta el contenedor y descarga el WebView (about:blank),
    // pero NO lo destruye (se reutiliza) → no puede crashear al cerrar.
    private void closePopup() {
        if (!popupOpen) return;
        popupOpen = false;
        if (pendingAutoClose != null) { rootLayout.removeCallbacks(pendingAutoClose); pendingAutoClose = null; }
        try { if (popupView != null) { popupView.stopLoading(); popupView.loadUrl("about:blank"); } } catch (Exception ignored) {}
        try { if (popupContainer != null) popupContainer.setVisibility(View.GONE); } catch (Exception ignored) {}
    }

    private void hideCustomVideo() {
        if (customView == null) return;
        rootLayout.removeView(customView);
        customView = null;
        webView.setVisibility(View.VISIBLE);
        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
    }

    // dispatchKeyEvent recibe las teclas ANTES que la WebView. Es imprescindible
    // para el cursor: la WebView se come las flechas (scroll/nav web) y nunca
    // llegaban a onKeyDown → el cursor "no se movía". Aquí sí las interceptamos.
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        int action = event.getAction();

        // Tecla MENÚ (☰) → activa/desactiva el cursor virtual (una vez, al soltar).
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            if (action == KeyEvent.ACTION_UP) toggleCursor();
            return true;
        }

        if (cursorMode) {
            boolean handled = false;
            if (action == KeyEvent.ACTION_DOWN) {
                int step = event.getRepeatCount() > 2 ? dp(85) : dp(42);
                switch (keyCode) {
                    case KeyEvent.KEYCODE_DPAD_LEFT:  moveCursor(-step, 0); handled = true; break;
                    case KeyEvent.KEYCODE_DPAD_RIGHT: moveCursor(step, 0);  handled = true; break;
                    case KeyEvent.KEYCODE_DPAD_UP:    moveCursor(0, -step); handled = true; break;
                    case KeyEvent.KEYCODE_DPAD_DOWN:  moveCursor(0, step);  handled = true; break;
                    case KeyEvent.KEYCODE_DPAD_CENTER:
                    case KeyEvent.KEYCODE_ENTER:
                    case KeyEvent.KEYCODE_BUTTON_A:   cursorTap();          handled = true; break;
                    case KeyEvent.KEYCODE_BACK:       toggleCursor();       handled = true; break;
                }
            } else if (action == KeyEvent.ACTION_UP) {
                switch (keyCode) {
                    case KeyEvent.KEYCODE_DPAD_LEFT: case KeyEvent.KEYCODE_DPAD_RIGHT:
                    case KeyEvent.KEYCODE_DPAD_UP:   case KeyEvent.KEYCODE_DPAD_DOWN:
                    case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
                    case KeyEvent.KEYCODE_BUTTON_A:  case KeyEvent.KEYCODE_BACK:
                        handled = true; break;
                }
            }
            if (handled) return true;   // consumida: la WebView no la ve
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // BACK: cierra el anuncio, luego el video fullscreen. Después DELEGA en la
        // página (window.__aaBack): si hay un modal de episodio abierto, ella vuelve
        // de server→lista o cierra el modal y devuelve true; solo si no lo maneja,
        // retrocedemos en el historial (o salimos de la app).
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (exoOpen) { closeExo(); return true; }   // cerrar reproductor nativo → vuelve a la lista
            if (popupOpen) { closePopup(); return true; }
            if (customView != null) { hideCustomVideo(); return true; }
            final WebView wv = webView;
            if (wv != null) {
                wv.evaluateJavascript("(window.__aaBack&&window.__aaBack())?'1':'0'", value -> {
                    boolean handled = value != null && value.contains("1");
                    if (!handled) {
                        if (wv.canGoBack()) wv.goBack();
                        else finish();
                    }
                });
                return true;
            }
        }
        // Teclas MULTIMEDIA (play/pausa/avanzar/retroceder): NO se interceptan → se
        // dejan pasar a la WebView, que las entrega a la MediaSession del video que
        // se está reproduciendo en el server → controlan play/pausa/seek del propio
        // reproductor. (Antes se interceptaban para "activar" y NO controlaban el video.)
        return super.onKeyDown(keyCode, event);
    }

    private boolean wasStopped = false;
    @Override protected void onPause() { super.onPause(); if (webView != null) webView.onPause(); }
    @Override protected void onStop() { super.onStop(); wasStopped = true; }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        // Al VOLVER a la app tras haberla dejado (Home), recarga FRESCO desde el inicio
        // → así los cambios/actualizaciones del sitio se aplican y se ve al instante.
        // (No recarga en cambios de foco breves, solo tras un onStop real.)
        if (wasStopped) {
            wasStopped = false;
            if (webView != null) { webView.clearCache(true); webView.loadUrl(SITE_URL); }
        }
    }
    @Override protected void onDestroy() {
        try { if (exo != null) { exo.release(); exo = null; } } catch (Exception ignored) {}
        try { if (popupView != null) { popupView.destroy(); popupView = null; } } catch (Exception ignored) {}
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
