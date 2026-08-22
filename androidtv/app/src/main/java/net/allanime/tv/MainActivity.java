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
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;
import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.widget.ImageButton;

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
        // El sitio avisa el server elegido → la app lo carga en una WebView OCULTA que
        // ejecuta el JS del host (reto anti-bot) y, al pedir el .m3u8/.mp4, capturamos
        // ese enlace y lo reproducimos en ExoPlayer nativo (la WebView normal deja
        // estos hosts en NEGRO). Igual que hace embed69, pero con nuestros servers.
        @JavascriptInterface public void playNative(String url) {
            if (url == null || url.isEmpty()) return;
            String h; try { h = new java.net.URL(url).getHost(); } catch (Exception e) { h = url; }
            final String host = h;
            runOnUiThread(() -> { toast("All-Anime TV: cargando " + host + "…"); startExtraction(url); });
        }
        // La web (main-2025) avisa, al abrir un episodio, la posición para REANUDAR y si
        // hay episodio SIGUIENTE (para el autoplay con conteo). Se aplica al reproducir.
        @JavascriptInterface public void nativeContext(String episodeId, int startSec, boolean hasNext) {
            runOnUiThread(() -> { aaEpisodeId = episodeId; aaStartSec = Math.max(0, startSec); aaHasNext = hasNext; aaCountdownActive = false; });
        }
    }

    private static final String CHROME_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static String originOf(String u) {
        try { java.net.URL x = new java.net.URL(u); return x.getProtocol() + "://" + x.getHost() + "/"; } catch (Exception e) { return u; }
    }

    // ===== Extracción asistida por WebView oculta =============================
    private WebView extractWv;
    private boolean extracting = false;
    private String currentEmbed = null;
    private Runnable extractTimeout;

    private void ensureExtractWv() {
        if (extractWv != null) return;
        extractWv = new WebView(this);
        WebSettings s = extractWv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // autoplay → dispara la petición del stream
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(CHROME_UA);
        extractWv.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView v, boolean d, boolean g, Message m) { return false; }
        });
        extractWv.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                try {
                    String u = req.getUrl() != null ? req.getUrl().toString() : "";
                    if (extracting && isStreamUrl(u)) {
                        extracting = false;
                        final String su = u;
                        final Map<String, String> hh = req.getRequestHeaders();
                        runOnUiThread(() -> onStreamFound(su, hh));
                    }
                } catch (Exception ignored) {}
                return super.shouldInterceptRequest(v, req);
            }
            @Override public void onPageFinished(WebView v, String u) {
                if (!extracting) return;
                // Silencia (para que no suene la WebView oculta) e intenta iniciar la
                // reproducción → así el host pide el .m3u8 y lo capturamos. Muchos
                // players (Streamwish/VOE) sólo piden el stream tras un "clic" real, así
                // que además del .play() y .click() sobre los botones típicos, se dispara
                // una secuencia de eventos de puntero en el centro del reproductor. Se
                // reintenta varias veces porque el player suele cargar tarde.
                String js = "(function(){try{" +
                        "var vs=document.getElementsByTagName('video');" +
                        "for(var i=0;i<vs.length;i++){try{vs[i].muted=true;vs[i].play();}catch(e){}}" +
                        "var sel=['.jw-icon-display','.vjs-big-play-button','.plyr__control--overlaid','#player','.play-button','.play','.vjs-play-control','button[aria-label*=\"lay\"]','button'];" +
                        "for(var j=0;j<sel.length;j++){var b=document.querySelector(sel[j]);if(b){try{b.click();}catch(e){}}}" +
                        "var t=(vs[0]||document.querySelector('#player,.jwplayer,.plyr,.video-js')||document.body);" +
                        "if(t){var r=t.getBoundingClientRect();var cx=r.left+r.width/2,cy=r.top+r.height/2;" +
                        "['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(ev){try{t.dispatchEvent(new MouseEvent(ev,{bubbles:true,cancelable:true,clientX:cx,clientY:cy}));}catch(e){}});}" +
                        "if(document.body)document.body.click();}catch(e){}})();";
                v.evaluateJavascript(js, null);
                for (int ms : new int[]{800, 2000, 3500, 5500, 8000}) {
                    v.postDelayed(() -> { if (extracting) v.evaluateJavascript(js, null); }, ms);
                }
            }
        });
        // Tamaño completo pero INVISIBLE (alpha 0) y DETRÁS de todo (índice 0): así el
        // reproductor del host se inicializa bien y pide el stream, sin verse. (2x2 era
        // muy chico y algunos players no arrancaban.)
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        rootLayout.addView(extractWv, 0, lp);
        extractWv.setAlpha(0f);
    }

    private boolean isStreamUrl(String u) {
        if (u == null) return false;
        String x = u.toLowerCase();
        if (x.contains(".m3u8") || x.contains("m3u8")) return true;
        if (x.contains("/hls/") || x.contains("/hls2/") || x.contains("master.txt") || x.contains("index.m3u8")
                || x.contains("playlist") || x.contains("manifest") || x.contains(".mpd")) return true;
        // (NO capturar googlevideo.com/videoplayback: son los streams de YouTube,
        //  con throttle/nsig, que no se reproducen fuera de su player. YouTube va por
        //  su iframe, no por ExoPlayer.)
        if ((x.contains(".mp4") || x.contains("/get_video"))
                && !x.contains("thumb") && !x.contains("preview") && !x.contains("sprite") && !x.contains("poster")) return true;
        return false;
    }

    @UnstableApi
    private void startExtraction(String embedUrl) {
        ensureExo();
        ensureExtractWv();
        currentEmbed = embedUrl;
        extracting = true;
        if (extractTimeout != null) rootLayout.removeCallbacks(extractTimeout);
        extractTimeout = () -> {
            if (extracting) { extracting = false; stopExtractWv();
                toast("No se pudo cargar este servidor — prueba otro"); }
        };
        rootLayout.postDelayed(extractTimeout, 22000);
        Map<String, String> h = new HashMap<>();
        h.put("Referer", originOf(embedUrl));
        try { extractWv.loadUrl(embedUrl, h); } catch (Exception e) { extractWv.loadUrl(embedUrl); }
    }

    private void stopExtractWv() {
        try { if (extractWv != null) { extractWv.stopLoading(); extractWv.loadUrl("about:blank"); } } catch (Exception ignored) {}
    }

    @UnstableApi
    private void onStreamFound(String streamUrl, Map<String, String> reqHeaders) {
        if (extractTimeout != null) rootLayout.removeCallbacks(extractTimeout);
        String ref = (reqHeaders != null && reqHeaders.get("Referer") != null) ? reqHeaders.get("Referer") : originOf(currentEmbed);
        Map<String, String> headers = new HashMap<>();
        headers.put("Referer", ref);
        if (reqHeaders != null && reqHeaders.get("Cookie") != null) headers.put("Cookie", reqHeaders.get("Cookie"));
        if (reqHeaders != null && reqHeaders.get("Origin") != null) headers.put("Origin", reqHeaders.get("Origin"));
        toast("▶ Reproduciendo en All-Anime TV");
        playNativeStream(streamUrl, headers);
        stopExtractWv();
    }

    // ===== Reproductor NATIVO (ExoPlayer) =====================================
    private ExoPlayer exo;
    private DefaultTrackSelector trackSelector;
    private PlayerView playerView;
    private FrameLayout exoContainer;
    private boolean exoOpen = false;
    // Contexto para REANUDAR y AUTOPLAY (lo fija la web vía nativeContext).
    private String aaEpisodeId = null;
    private int aaStartSec = 0;
    private boolean aaHasNext = false;
    private boolean aaCountdownActive = false;
    private boolean aaAdvancing = false;
    private Runnable aaPoll;
    private android.widget.TextView aaCountdownView;
    private int aaCountdownLeft = 0;
    private Runnable aaCountdownTick;

    @UnstableApi
    private void ensureExo() {
        if (exo != null) return;
        // Selector de pistas: PREFIERE subtítulos en español y activa subs de idioma
        // indeterminado → arregla que el CC no cargara. El engranaje de ajustes deja
        // cambiar audio/subtítulos/velocidad.
        trackSelector = new DefaultTrackSelector(this);
        trackSelector.setParameters(trackSelector.buildUponParameters()
                .setPreferredTextLanguages("es", "spa", "lat", "es-419")
                .setPreferredAudioLanguages("es", "spa", "lat")
                .setSelectUndeterminedTextLanguage(true));
        exo = new ExoPlayer.Builder(this).setTrackSelector(trackSelector).build();
        // Si el stream falla (host caído, cabeceras, formato), avisa y cierra en vez de
        // quedarse cargando para siempre.
        exo.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) {
                toast("No se pudo reproducir este servidor — prueba otro");
                closeExo();
            }
        });

        // Inflar el reproductor propio (rojo, estilo Prime Video) con su controlador.
        playerView = (PlayerView) LayoutInflater.from(this).inflate(R.layout.aa_player_view, null);
        playerView.setPlayer(exo);
        playerView.setControllerShowTimeoutMs(4000);
        playerView.setControllerAutoShow(true);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setFocusable(true);
        playerView.setFocusableInTouchMode(true);

        // Subtítulos estilo Disney+: texto blanco, SIN fondo de caja (transparente),
        // borde sutil para legibilidad, tamaño cómodo. Se ignoran estilos embebidos
        // para que se vean uniformes.
        SubtitleView sub = playerView.getSubtitleView();
        if (sub != null) {
            sub.setApplyEmbeddedStyles(false);
            sub.setApplyEmbeddedFontSizes(false);
            sub.setStyle(new CaptionStyleCompat(
                    Color.WHITE, Color.TRANSPARENT, Color.TRANSPARENT,
                    CaptionStyleCompat.EDGE_TYPE_OUTLINE, 0xFF000000,
                    Typeface.create("sans-serif", Typeface.NORMAL)));
            sub.setFractionalTextSize(0.055f);
        }

        // Botón de volumen propio: OK = silenciar/activar; izquierda/derecha baja/sube.
        setupVolumeButton();

        exoContainer = new FrameLayout(this);
        exoContainer.setBackgroundColor(0xFF000000);
        exoContainer.setFocusable(true);
        exoContainer.setVisibility(View.GONE);
        exoContainer.addView(playerView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        rootLayout.addView(exoContainer, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private float aaVolume = 1f;
    private void setupVolumeButton() {
        ImageButton vb = playerView.findViewById(R.id.aa_volume);
        if (vb == null) return;
        vb.setOnClickListener(v -> {
            aaVolume = (aaVolume > 0f) ? 0f : 1f;   // OK alterna silencio
            if (exo != null) exo.setVolume(aaVolume);
            updateVolumeIcon(vb);
            toast(aaVolume == 0f ? "Silencio" : "Sonido activado");
        });
        vb.setOnKeyListener((v, keyCode, ev) -> {
            if (ev.getAction() != KeyEvent.ACTION_DOWN) return false;
            if (keyCode == KeyEvent.KEYCODE_DPAD_LEFT)  { aaVolume = Math.max(0f, aaVolume - 0.1f); if (exo != null) exo.setVolume(aaVolume); updateVolumeIcon(vb); return true; }
            if (keyCode == KeyEvent.KEYCODE_DPAD_RIGHT) { aaVolume = Math.min(1f, aaVolume + 0.1f); if (exo != null) exo.setVolume(aaVolume); updateVolumeIcon(vb); return true; }
            return false;
        });
        updateVolumeIcon(vb);
    }
    private void updateVolumeIcon(ImageButton vb) {
        vb.setImageResource(aaVolume == 0f ? android.R.drawable.ic_lock_silent_mode
                : android.R.drawable.ic_lock_silent_mode_off);
    }

    @UnstableApi
    private void playNativeStream(String streamUrl, Map<String, String> headers) {
        try {
            ensureExo();
            DefaultHttpDataSource.Factory dsf = new DefaultHttpDataSource.Factory()
                    .setUserAgent(CHROME_UA)
                    .setAllowCrossProtocolRedirects(true)
                    .setKeepPostFor302Redirects(true)
                    .setConnectTimeoutMs(15000)
                    .setReadTimeoutMs(15000)
                    .setDefaultRequestProperties(headers);
            // Muchos m3u8 (StreamWish, VOE…) llevan parámetros en la URL, así que
            // ExoPlayer NO detecta que es HLS por la extensión y lo trataba como MP4
            // progresivo → se quedaba en 00:00. Forzamos HlsMediaSource cuando la URL
            // es HLS, con preparación SIN fragmentos (arranca mucho más rápido).
            String lu = streamUrl.toLowerCase();
            boolean isHls = lu.contains("m3u8") || lu.contains("/hls");
            MediaSource ms;
            if (isHls) {
                MediaItem mi = new MediaItem.Builder().setUri(streamUrl).setMimeType(MimeTypes.APPLICATION_M3U8).build();
                ms = new HlsMediaSource.Factory(dsf).setAllowChunklessPreparation(true).createMediaSource(mi);
            } else {
                ms = new DefaultMediaSourceFactory(dsf).createMediaSource(MediaItem.fromUri(streamUrl));
            }
            exo.setMediaSource(ms);
            exoContainer.setVisibility(View.VISIBLE);
            exoContainer.bringToFront();
            exoOpen = true;
            // CONGELA la WebView detrás: no enfocable → el D-pad NO mueve el home/lista
            // de servers por detrás; todo va a los controles del reproductor.
            if (webView != null) { webView.setFocusable(false); webView.setFocusableInTouchMode(false); }
            playerView.setUseController(true);
            playerView.requestFocus();
            playerView.showController();
            exo.prepare();
            if (aaStartSec > 3) { try { exo.seekTo(aaStartSec * 1000L); } catch (Exception ignored) {} }  // REANUDAR
            exo.setVolume(aaVolume);
            exo.setPlayWhenReady(true);
            hideCountdown();
            aaCountdownActive = false;
            aaAdvancing = false;
            startPoll();
        } catch (Exception ignored) {}
    }

    // Sondeo de posición: informa el progreso REAL a la web ("seguir viendo" preciso) y
    // dispara el conteo de autoplay cerca del final.
    @UnstableApi
    private void startPoll() {
        stopPoll();
        aaPoll = new Runnable() {
            @Override public void run() {
                if (!exoOpen || exo == null) return;
                try {
                    long posMs = exo.getCurrentPosition(), durMs = exo.getDuration();
                    int pos = (int) (posMs / 1000), dur = durMs > 0 ? (int) (durMs / 1000) : 0;
                    if (aaEpisodeId != null && dur > 0) {
                        String js = "window.aaOnNativeProgress&&aaOnNativeProgress('" + aaEpisodeId.replace("'", "") + "'," + pos + "," + dur + ")";
                        if (webView != null) webView.evaluateJavascript(js, null);
                    }
                    // Conteo de autoplay: en los últimos ~15s, si hay siguiente episodio.
                    if (dur > 0 && aaHasNext && !aaCountdownActive && !aaAdvancing && pos >= dur - 15 && pos < dur) {
                        showCountdown();
                    }
                } catch (Exception ignored) {}
                rootLayout.postDelayed(this, 3000);
            }
        };
        rootLayout.postDelayed(aaPoll, 3000);
    }
    private void stopPoll() { if (aaPoll != null) { rootLayout.removeCallbacks(aaPoll); aaPoll = null; } }

    // Conteo de "Siguiente episodio" DIBUJADO por el nativo (el DOM web queda tapado).
    private void showCountdown() {
        if (aaCountdownActive) return;
        aaCountdownActive = true;
        aaCountdownLeft = 10;
        if (aaCountdownView == null) {
            aaCountdownView = new android.widget.TextView(this);
            aaCountdownView.setTextColor(Color.WHITE);
            aaCountdownView.setTextSize(16);
            aaCountdownView.setPadding(dp(20), dp(12), dp(20), dp(12));
            aaCountdownView.setBackgroundColor(0xCCE0231F);   // rojo semitransparente de marca
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.END;
            lp.setMargins(0, 0, dp(28), dp(90));
            exoContainer.addView(aaCountdownView, lp);
        }
        aaCountdownView.setVisibility(View.VISIBLE);
        aaCountdownView.setText("Siguiente episodio en " + aaCountdownLeft + "s  (OK)");
        aaCountdownView.setOnClickListener(v -> goNextEpisode());
        aaCountdownTick = new Runnable() {
            @Override public void run() {
                aaCountdownLeft--;
                if (aaCountdownLeft <= 0) { goNextEpisode(); return; }
                if (aaCountdownView != null) aaCountdownView.setText("Siguiente episodio en " + aaCountdownLeft + "s  (OK)");
                rootLayout.postDelayed(this, 1000);
            }
        };
        rootLayout.postDelayed(aaCountdownTick, 1000);
    }
    private void hideCountdown() {
        if (aaCountdownTick != null) { rootLayout.removeCallbacks(aaCountdownTick); aaCountdownTick = null; }
        if (aaCountdownView != null) aaCountdownView.setVisibility(View.GONE);
    }
    private void goNextEpisode() {
        hideCountdown();
        aaAdvancing = true;   // evita re-disparar el conteo mientras carga el siguiente
        // La web abre el siguiente episodio y auto-reproduce su primer server → playNative.
        if (webView != null) webView.evaluateJavascript("window.aaPlayNext&&aaPlayNext()", null);
    }

    @UnstableApi
    private void closeExo() {
        if (!exoOpen) return;
        // Reporta la posición final a la web (para "seguir viendo" preciso) antes de cerrar.
        try {
            if (exo != null && aaEpisodeId != null) {
                long posMs = exo.getCurrentPosition(), durMs = exo.getDuration();
                if (durMs > 0 && webView != null)
                    webView.evaluateJavascript("window.aaOnNativeProgress&&aaOnNativeProgress('" + aaEpisodeId.replace("'", "") + "'," + (posMs / 1000) + "," + (durMs / 1000) + ")", null);
            }
        } catch (Exception ignored) {}
        exoOpen = false;
        extracting = false;
        stopPoll();
        hideCountdown();
        aaCountdownActive = false;
        stopExtractWv();
        try { if (exo != null) { exo.setPlayWhenReady(false); exo.stop(); exo.clearMediaItems(); } } catch (Exception ignored) {}
        if (exoContainer != null) exoContainer.setVisibility(View.GONE);
        // Devuelve el foco a la WebView (vuelve a la lista de servers).
        if (webView != null) { webView.setFocusable(true); webView.setFocusableInTouchMode(true); webView.requestFocus(); }
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

        // Con el reproductor nativo abierto, TODAS las teclas van a SUS controles
        // (play/pausa/seek/subtítulos con el D-pad). BACK lo maneja onKeyDown (cierra).
        if (exoOpen) {
            // Si la barra de controles está OCULTA, la PRIMERA tecla (que no sea BACK)
            // solo la vuelve a mostrar y se consume — así SIEMPRE reaparecen los
            // controles tras dar OK/pausa o tras el auto-ocultado.
            if (action == KeyEvent.ACTION_DOWN
                    && keyCode != KeyEvent.KEYCODE_BACK
                    && playerView != null && !playerView.isControllerFullyVisible()) {
                playerView.showController();
                playerView.requestFocus();
                return true;
            }
            return super.dispatchKeyEvent(event);
        }

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
