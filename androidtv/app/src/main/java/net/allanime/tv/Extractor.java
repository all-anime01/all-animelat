package net.allanime.tv;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrae el enlace DIRECTO de video (m3u8/mp4) de los hosts embed que usamos, para
 * reproducirlo en ExoPlayer nativo (la WebView de Fire TV los deja en negro).
 * Soporta la familia Streamwish/VidHide/Filemoon (JS empaquetado con m3u8) y
 * Streamtape (mp4). Si no reconoce el host o falla, devuelve null → la app cae a la
 * WebView. Corre en un hilo de fondo (hace red).
 */
public class Extractor {

    public static class Result {
        public final String url;      // m3u8 o mp4 directo
        public final String referer;  // Referer necesario para reproducirlo
        public final boolean hls;
        Result(String url, String referer, boolean hls) { this.url = url; this.referer = referer; this.hls = hls; }
    }

    private static final String UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    public static Result extract(String embedUrl) {
        try {
            if (embedUrl == null) return null;
            String host = new URL(embedUrl).getHost().toLowerCase();
            String origin = originOf(embedUrl);
            String html = httpGet(embedUrl, origin);
            if (html == null || html.isEmpty()) return null;

            // Streamtape → mp4 directo
            if (host.contains("streamtape") || host.contains("strtape") || host.contains("stape")) {
                String u = streamtape(html);
                if (u != null) return new Result(u, origin, false);
            }

            // Familia Streamwish / VidHide / Filemoon / etc.: JS empaquetado con m3u8
            String code = html;
            String packed = findPacked(html);
            if (packed != null) {
                String un = unpack(packed);
                if (un != null) code = un + "\n" + html;
            }
            String m3u8 = firstMatch(code,
                "\"file\"\\s*:\\s*\"(https?://[^\"]+?\\.m3u8[^\"]*)\"",
                "file\\s*:\\s*\"(https?://[^\"]+?\\.m3u8[^\"]*)\"",
                "sources?\\s*:\\s*\\[\\s*\\{\\s*\"?file\"?\\s*:\\s*\"(https?://[^\"]+?\\.m3u8[^\"]*)\"",
                "\"(https?://[^\"]+?\\.m3u8[^\"]*)\"",
                "'(https?://[^']+?\\.m3u8[^']*)'");
            if (m3u8 != null) return new Result(m3u8, origin, true);

            // Fallback: algún mp4 directo en el código
            String mp4 = firstMatch(code,
                "\"file\"\\s*:\\s*\"(https?://[^\"]+?\\.mp4[^\"]*)\"",
                "file\\s*:\\s*\"(https?://[^\"]+?\\.mp4[^\"]*)\"",
                "\"(https?://[^\"]+?\\.mp4[^\"]*)\"");
            if (mp4 != null) return new Result(mp4, origin, false);

            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String streamtape(String html) {
        // Streamtape: arma la url desde el div robotlink + el token del script.
        Matcher m = Pattern.compile("id=\"robotlink\"[^>]*>([^<]+)<").matcher(html);
        Matcher t = Pattern.compile("token=([\\w-]+)").matcher(html);
        if (m.find()) {
            String base = m.group(1).trim();                 // //streamtape.com/get_video?id=...&expires=...
            String tok = t.find() ? t.group(1) : null;
            if (base.startsWith("//")) base = "https:" + base;
            if (tok != null && !base.contains("token=")) base += (base.contains("?") ? "&" : "?") + "token=" + tok;
            base = base.replaceAll("&stream=1", "") + "&stream=1";
            return base;
        }
        return null;
    }

    // --- Desempaquetador Dean Edwards p,a,c,k,e,d -----------------------------
    private static String findPacked(String html) {
        Matcher m = Pattern.compile("(eval\\(function\\(p,a,c,k,e,[dr]\\)\\{[\\s\\S]*?\\}\\([\\s\\S]*?\\)\\))").matcher(html);
        return m.find() ? m.group(1) : null;
    }

    private static String unpack(String packed) {
        try {
            // eval(function(p,a,c,k,e,d){...}('PAYLOAD', A, C, 'K1|K2|...'.split('|'), 0, {}))
            Matcher m = Pattern.compile("\\}\\(\\s*'([\\s\\S]*?)'\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*'([\\s\\S]*?)'\\.split\\('\\|'\\)").matcher(packed);
            if (!m.find()) return null;
            String payload = m.group(1).replace("\\'", "'").replace("\\\\", "\\");
            int a = Integer.parseInt(m.group(2));
            int c = Integer.parseInt(m.group(3));
            String[] k = m.group(4).split("\\|", -1);
            for (int i = c - 1; i >= 0; i--) {
                if (i < k.length && k[i] != null && !k[i].isEmpty()) {
                    payload = payload.replaceAll("\\b" + toBase(i, a) + "\\b", Matcher.quoteReplacement(k[i]));
                }
            }
            return payload;
        } catch (Exception e) { return null; }
    }

    private static String toBase(int n, int base) {
        if (n == 0) return "0";
        String digits = "0123456789abcdefghijklmnopqrstuvwxyz";
        StringBuilder sb = new StringBuilder();
        // p,a,c,k,e,d usa: e = c%a<...; representación tipo base con letras. Aproximación
        // estándar del packer: n en base 'base' con dígitos 0-9a-z (suficiente para a<=36).
        while (n > 0) { sb.insert(0, digits.charAt(n % base)); n /= base; }
        return sb.toString();
    }

    // --- utilidades ----------------------------------------------------------
    private static String firstMatch(String s, String... patterns) {
        for (String p : patterns) {
            Matcher m = Pattern.compile(p).matcher(s);
            if (m.find()) return m.group(1);
        }
        return null;
    }

    private static String originOf(String u) {
        try { URL x = new URL(u); return x.getProtocol() + "://" + x.getHost() + "/"; } catch (Exception e) { return u; }
    }

    private static String httpGet(String urlStr, String referer) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(urlStr).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(12000);
            c.setReadTimeout(12000);
            c.setRequestProperty("User-Agent", UA);
            c.setRequestProperty("Accept", "*/*");
            if (referer != null) c.setRequestProperty("Referer", referer);
            int code = c.getResponseCode();
            if (code >= 400) return null;
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) != -1) bo.write(buf, 0, n);
            in.close();
            return bo.toString("UTF-8");
        } catch (Exception e) {
            return null;
        } finally { if (c != null) c.disconnect(); }
    }
}
