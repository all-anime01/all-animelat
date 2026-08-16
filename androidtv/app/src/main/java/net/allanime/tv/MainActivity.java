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
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;

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

        webView = new WebView(this);
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
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
        s.setUserAgentString(s.getUserAgentString() + " AllAnimeTV/1.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);   // navegación normal dentro del WebView
                return true;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                refreshAdFree();     // relee el estado "sin publicidad" del sitio
            }
        });

        webView.setWebChromeClient(new AppChrome());
        webView.loadUrl(SITE_URL);
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
        popupView.setWebViewClient(new WebViewClient());
        popupView.setWebChromeClient(new WebChromeClient() {
            @Override public void onCloseWindow(WebView w) { closePopup(); }
        });
        popupContainer.addView(popupView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        Button close = new Button(this);
        close.setText(autoClose ? "✕ Cerrar anuncio (cerrando…)" : "✕ Cerrar anuncio");
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        clp.gravity = Gravity.TOP | Gravity.END;
        clp.setMargins(28, 28, 28, 28);
        close.setOnClickListener(v -> closePopup());
        popupContainer.addView(close, clp);

        rootLayout.addView(popupContainer, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
        t.setWebView(popupView);
        resultMsg.sendToTarget();

        // adFree: cierre automático a los 2 segundos → vuelve al episodio.
        if (autoClose) {
            rootLayout.postDelayed(this::closePopup, 2000);
        }
    }

    private void closePopup() {
        if (popupContainer != null) {
            rootLayout.removeView(popupContainer);
            if (popupView != null) { popupView.destroy(); popupView = null; }
            popupContainer = null;
        }
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
        return super.onKeyDown(keyCode, event);
    }

    @Override protected void onPause() { super.onPause(); if (webView != null) webView.onPause(); }
    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override protected void onDestroy() { closePopup(); if (webView != null) { webView.destroy(); webView = null; } super.onDestroy(); }
}
