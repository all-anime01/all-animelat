package net.allanime.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Message;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.graphics.Color;
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
    private FrameLayout popupContainer;             // ventana de anuncio (manual)
    private WebView popupView;
    private boolean adFree = false;                 // "sin publicidad" del usuario

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
        webView.loadUrl(SITE_URL);
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
                if (view == popupView) { closePopup(); return true; }
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

    // Abre el anuncio del servidor. Si autoClose (adFree) → se cierra a los 2 s;
    // siempre hay además un botón "✕ Cerrar anuncio" por si se quiere cerrar antes.
    private void openPopup(Message resultMsg, boolean autoClose) {
        closePopup();
        popupContainer = new FrameLayout(this);
        popupContainer.setBackgroundColor(0xCC000000);

        popupView = new WebView(this);
        WebSettings ps = popupView.getSettings();
        ps.setJavaScriptEnabled(true);
        ps.setDomStorageEnabled(true);
        ps.setSupportMultipleWindows(true);
        ps.setJavaScriptCanOpenWindowsAutomatically(true);
        popupView.setWebViewClient(new AppClient(false));   // bloquea market/Play + recupera crashes
        popupView.setWebChromeClient(new WebChromeClient() {
            @Override public void onCloseWindow(WebView w) { closePopup(); }
            // Un anuncio dentro del popup intenta abrir OTRA ventana (anuncio sobre
            // anuncio): se ignora, así nunca se apila algo imposible de cerrar.
            @Override public boolean onCreateWindow(WebView v, boolean d, boolean g, Message m) { return false; }
        });
        popupContainer.addView(popupView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Botón de cierre GRANDE y siempre visible (barra superior). Funciona en
        // móvil (toque) y en Fire TV (además el botón ATRÁS del control cierra).
        int pad = dp(14), mar = dp(16);
        Button close = new Button(this);
        close.setText(autoClose ? "✕  CERRAR ANUNCIO  (cerrando…)" : "✕  CERRAR ANUNCIO");
        close.setAllCaps(false);
        close.setTextColor(Color.WHITE);
        close.setBackgroundColor(0xFFE0231F);
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        close.setPadding(dp(22), pad, dp(22), pad);
        close.setElevation(dp(8));
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        clp.gravity = Gravity.TOP | Gravity.END;
        clp.setMargins(mar, mar, mar, mar);
        close.setOnClickListener(v -> closePopup());
        close.setFocusable(true);
        close.setFocusableInTouchMode(false);

        rootLayout.addView(popupContainer, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // El botón se añade al final para quedar SIEMPRE por encima del anuncio.
        popupContainer.addView(close, clp);
        close.bringToFront();
        close.requestFocus();   // en Fire TV queda resaltado para cerrarlo con OK

        WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
        t.setWebView(popupView);
        resultMsg.sendToTarget();

        // adFree: cierre automático a los 2 segundos → vuelve al episodio.
        if (autoClose) {
            rootLayout.postDelayed(this::closePopup, 2000);
        }
    }

    private void closePopup() {
        // A prueba de crashes: se anulan las referencias PRIMERO (por si se llama dos
        // veces: cierre manual + autocierre a 2 s), se saca la vista, y el WebView se
        // destruye en el SIGUIENTE ciclo (destruirlo dentro de un callback del propio
        // WebView cerraba la app "a la segunda vez").
        try {
            final FrameLayout pc = popupContainer;
            final WebView pv = popupView;
            popupContainer = null;
            popupView = null;
            if (pv != null) {
                try { pv.stopLoading(); } catch (Exception ignored) {}
                try { pv.setWebChromeClient(null); } catch (Exception ignored) {}
            }
            if (pc != null) rootLayout.removeView(pc);
            if (pv != null) rootLayout.post(() -> { try { pv.destroy(); } catch (Exception ignored) {} });
        } catch (Exception ignored) {}
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
        // BACK: cierra el anuncio, luego el video fullscreen, luego retrocede.
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (popupContainer != null) { closePopup(); return true; }
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
    @Override protected void onDestroy() { closePopup(); if (webView != null) { webView.destroy(); webView = null; } super.onDestroy(); }
}
