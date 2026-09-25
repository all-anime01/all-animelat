// ============================================================================
//  DESEMPAQUETADOR para el extractor de la app (Fire TV / Android TV)
//
//  StreamWish, VidHide y los hosts que embed69 carga por dentro NO dejan el
//  enlace del vídeo en el HTML: lo esconden en JavaScript empaquetado con el
//  clásico eval(function(p,a,c,k,e,d){…}). El barrido de la app sólo encontraba
//  el enlace si el reproductor del host (jwplayer) llegaba a arrancar solo
//  dentro de una WebView oculta, y eso hoy no ocurre: de ahí los «no se capturó
//  video en 35s».
//
//  Esto lo desempaqueta EN LA PROPIA TELE. Es importante que sea ahí y no en el
//  Worker: el enlace lleva un token atado a la IP que pidió la página, así que
//  uno sacado desde el servidor devuelve 403 en el televisor.
//
//  Este archivo es la FUENTE de verdad y tiene su prueba en
//  androidtv/extract-unpack.test.mjs. La copia que corre en la app va incrustada
//  en MainActivity.java; si tocas una, toca la otra.
// ============================================================================

/** Devuelve el JavaScript ya desempaquetado, o "" si la página no usa ese empaquetado. */
function aaDesempaqueta(html) {
  try {
    var pk = String(html).match(/\}\('(.*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/);
    if (!pk) return "";
    var texto = pk[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    var base = +pk[2], total = +pk[3], palabras = pk[4].split("|");
    var digito = function (n, b) {
      var D = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", o = "";
      while (n > 0) { o = D.charAt(n % b) + o; n = Math.floor(n / b); }
      return o || "0";
    };
    for (var i = total - 1; i >= 0; i--) {
      if (palabras[i]) texto = texto.replace(new RegExp("\\b" + digito(i, base) + "\\b", "g"), palabras[i]);
    }
    return texto;
  } catch (e) { return ""; }
}

/** Saca el enlace del vídeo de una página de host. "" si no lo encuentra. */
function aaEnlaceDeVideo(html) {
  var js = aaDesempaqueta(html) || String(html);
  // Se prefiere el .m3u8 de verdad; el master.txt es el mismo vídeo por otra vía
  // y ExoPlayer lo lleva peor, así que queda de respaldo.
  var m = js.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/);
  if (m) return m[0];
  m = js.match(/https?:\/\/[^"'\s\\]+master\.txt[^"'\s\\]*/);
  if (m) return m[0];
  m = js.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
  return m ? m[0] : "";
}

export { aaDesempaqueta, aaEnlaceDeVideo };
