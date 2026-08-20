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

import java.io.ByteArrayInputStream;

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
        // "AllAnimeApp" en AMBOS flavors → el sitio oculta el botón de descargar app
        // (ya estás dentro de la app). "AllAnimeTV" SOLO en el flavor TV → el sitio
        // activa la barra lateral de Fire TV. El flavor MÓVIL NO la activa.
        String ua = s.getUserAgentString() + " AllAnimeApp/1.0";
        if (BuildConfig.IS_TV) ua += " AllAnimeTV/1.0";
        s.setUserAgentString(ua);

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

    // Cierra popups/fullscreen/cursor y carga el inicio del sitio.
    private void goHome() {
        if (popupOpen) closePopup();
        if (customView != null) hideCustomVideo();
        if (cursorMode) toggleCursor();
        if (webView != null) webView.loadUrl(SITE_URL);
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

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            String url = req.getUrl() != null ? req.getUrl().toString() : null;
            // En la app SIEMPRE se bloquean a nivel de red las redes de anuncios
            // intrusivas (popunders/redirecciones tipo Adsterra). Motivo: en Fire TV
            // esos anuncios impedían abrir el login/registro (y provocaban crashes al
            // redirigir), y no se puede activar adFree sin antes iniciar sesión. Los
            // servidores de video NO están en esta lista, así que la reproducción
            // sigue funcionando; los popups de anuncios del server los maneja
            // onCreateWindow (cierre manual o automático según adFree).
            if (isAdHost(url)) {
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

        // El sitio/servidor intenta abrir una ventana nueva (anuncio popup).
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            // adFree (pago o activado por admin): el anuncio se abre normal y se
            // cierra SOLO a los 2 s, volviendo al episodio. Sin adFree: cierre manual.
            openPopup(resultMsg, adFree);
            return true;
        }
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_LONG).show(); }

    // ===== Cursor virtual =====================================================
    private void ensureCursor() {
        if (cursorView != null) return;
        cursorView = new View(this);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(0x55FFFFFF);
        g.setStroke(dp(3), 0xFFFF5A3C);
        cursorView.setBackground(g);
        cursorView.setElevation(dp(12));
        int sz = dp(CURSOR_DP);
        cursorView.setVisibility(View.GONE);
        rootLayout.addView(cursorView, new FrameLayout.LayoutParams(sz, sz));
    }

    private void toggleCursor() {
        ensureCursor();
        cursorMode = !cursorMode;
        if (cursorMode) {
            curX = rootLayout.getWidth() / 2f;
            curY = rootLayout.getHeight() / 2f;
            positionCursor();
            cursorView.setVisibility(View.VISIBLE);
            cursorView.bringToFront();
            toast("Cursor activado · mueve con las flechas, OK para pulsar, ATRÁS para salir");
        } else {
            cursorView.setVisibility(View.GONE);
        }
    }

    private void positionCursor() {
        if (cursorView == null) return;
        curX = Math.max(0, Math.min(rootLayout.getWidth() - 1, curX));
        curY = Math.max(0, Math.min(rootLayout.getHeight() - 1, curY));
        int sz = dp(CURSOR_DP);
        cursorView.setX(curX - sz / 2f);
        cursorView.setY(curY - sz / 2f);
        cursorView.bringToFront();
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

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Tecla MENÚ (☰ del control Fire TV) → activa/desactiva el cursor virtual.
        if (keyCode == KeyEvent.KEYCODE_MENU) { toggleCursor(); return true; }

        // Con el cursor activo, el D-pad lo MUEVE y OK inyecta un toque; ATRÁS sale.
        if (cursorMode) {
            int step = dp(40);
            // Acelera si se mantiene pulsada la flecha (auto-repeat).
            if (event.getRepeatCount() > 2) step = dp(80);
            switch (keyCode) {
                case KeyEvent.KEYCODE_DPAD_LEFT:  moveCursor(-step, 0); return true;
                case KeyEvent.KEYCODE_DPAD_RIGHT: moveCursor(step, 0);  return true;
                case KeyEvent.KEYCODE_DPAD_UP:    moveCursor(0, -step); return true;
                case KeyEvent.KEYCODE_DPAD_DOWN:  moveCursor(0, step);  return true;
                case KeyEvent.KEYCODE_DPAD_CENTER:
                case KeyEvent.KEYCODE_ENTER:
                case KeyEvent.KEYCODE_BUTTON_A:   cursorTap(); return true;
                case KeyEvent.KEYCODE_BACK:       toggleCursor(); return true; // salir del cursor
            }
        }

        // BACK: cierra el anuncio, luego el video fullscreen, luego retrocede.
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (popupOpen) { closePopup(); return true; }
            if (customView != null) { hideCustomVideo(); return true; }
            if (webView.canGoBack()) { webView.goBack(); return true; }
        }
        // Botón PLAY/PAUSA del control → activa lo enfocado en la web (elegir server,
        // dar play). Por si el WebView no entrega la tecla al JS de la página.
        if (keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || keyCode == KeyEvent.KEYCODE_MEDIA_PLAY
                || keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE) {
            WebView tgt = (popupView != null) ? popupView : webView;
            if (tgt != null) try { tgt.evaluateJavascript("window.__aaActivate&&window.__aaActivate()", null); } catch (Exception ignored) {}
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override protected void onPause() { super.onPause(); if (webView != null) webView.onPause(); }
    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override protected void onDestroy() {
        try { if (popupView != null) { popupView.destroy(); popupView = null; } } catch (Exception ignored) {}
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
