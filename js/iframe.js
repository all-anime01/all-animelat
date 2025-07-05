function go_to_player(url) {
  // 1. Preparamos el overlay de carga
  const playerDisplay = document.getElementById("PlayerDisplay");
  let loadingOverlay = document.getElementById("loadingOverlay");

  // Si el overlay no existe, lo creamos y lo añadimos al DOM una sola vez.
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loadingOverlay";
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = `
        <div class="spinner"></div>
        <p>Cargando servidor...</p>
    `;
    // Usamos 'prepend' para que quede por encima de otros elementos si es necesario
    if (playerDisplay) {
      playerDisplay.prepend(loadingOverlay);
    }
  }

  // 2. Mostramos la animación de carga
  if (playerDisplay) {
    playerDisplay.classList.add("is-loading");
  }

  var displayVideo = document.querySelector(".DisplayVideo");
  displayVideo.classList.add("DisplayVideoA");
  displayVideo.style.zIndex = "9999";

  // 3. Modificamos el 'onload' del iframe para ocultar la animación cuando el video cargue
  displayVideo.innerHTML =
    `
  <span id="backToPlayers" onclick="listPlayer();"></span>
  <iframe 
      onload="const pd = document.getElementById('PlayerDisplay'); if(pd) pd.classList.remove('is-loading');" 
      id="IFR" 
      src="` +
    url +
    `" 
      frameborder="0" 
      allowfullscreen="true" 
      webkitallowfullscreen="true" 
      mozallowfullscreen="true">
  </iframe>`;

  // El código para mostrar/ocultar el botón de volver
  let idleTimer = null;
  let idleState = false;

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  let timeShow = isMobile ? 10000 : 5000;

  function showFoo(time) {
    const elem = document.getElementById("backToPlayers");
    const ifr = document.getElementById("IFR");
    if (!elem || !ifr) return;

    if (idleState == true) {
      elem.className = "";
      ifr.className = "";
    }
    clearTimeout(idleTimer);
    idleState = false;
    idleTimer = setTimeout(function () {
      elem.className = "inactive";
      ifr.className = "nopoints";
      idleState = true;
      idleTimer = null;
    }, time);
  }

  showFoo(timeShow);

  document.addEventListener("click", () => showFoo(timeShow));
  document.addEventListener("mousemove", () => showFoo(timeShow));
}

function listPlayer() {
  const displayVideo = document.querySelector(".DisplayVideo");
  const playerDisplay = document.getElementById("PlayerDisplay");

  if (displayVideo) {
    displayVideo.classList.remove("DisplayVideoA");
    displayVideo.style.zIndex = "1";
    displayVideo.innerHTML = "";
  }
  if (playerDisplay) {
    playerDisplay.classList.remove("is-loading");
  }
}

function CrearSuperCookie(key, value, ttl) {
  const now = new Date();
  const item = {
    value: value,
    expiry: now.getTime() + ttl * 60000,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function obtenerSuperCookie(key) {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) {
    return null;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  if (now.getTime() > item.expiry) {
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}

var msj = document.getElementById("msjad");
if (msj && obtenerSuperCookie("msjad") == null) {
  msj.style.display = "flex";
}

function hideMsj(time = 0) {
  if (msj) {
    CrearSuperCookie("msjad", true, time * 60);
    msj.style.display = "none";
  }
}

function SelLang(who, id) {
  const firstLoad = document.querySelector(".FirstLoad");
  if (firstLoad) firstLoad.classList.add("FirstLoadA");

  const sldA = document.querySelector(".SLD_A");
  if (sldA) {
    sldA.classList.remove("SLD_A");
  }
  who.classList.add("SLD_A");

  setTimeout(function () {
    if (firstLoad) firstLoad.classList.remove("FirstLoadA");

    const reactiv = document.querySelector(".REactiv");
    if (reactiv) {
      reactiv.classList.remove("REactiv");
    }

    const odId = document.querySelector(".OD_" + id);
    if (odId) odId.classList.add("REactiv");
  }, 300);
}

!(function (e, t) {
  "function" == typeof define && define.amd
    ? define(function () {
        return t(e);
      })
    : "object" == typeof exports
    ? (module.exports = t)
    : (e.echo = t(e));
})(this, function (e) {
  "use strict";
  var t,
    i,
    n,
    o,
    r,
    c = {},
    l = function () {},
    s = function (e, t) {
      if (
        (function (e) {
          return null === e.offsetParent;
        })(e)
      )
        return !1;
      var i = e.getBoundingClientRect();
      return i.right >= t.l && i.bottom >= t.t && i.left <= t.r && i.top <= t.b;
    },
    a = function () {
      (!o && i) ||
        (clearTimeout(i),
        (i = setTimeout(function () {
          c.render(), (i = null);
        }, n)));
    };
  return (
    (c.init = function (i) {
      var s = (i = i || {}).offset || 0,
        d = i.offsetVertical || s,
        u = i.offsetHorizontal || s,
        m = function (e, t) {
          return parseInt(e || t, 10);
        };
      (t = {
        t: m(i.offsetTop, d),
        b: m(i.offsetBottom, d),
        l: m(i.offsetLeft, u),
        r: m(i.offsetRight, u),
      }),
        (n = m(i.throttle, 250)),
        (o = !1 !== i.debounce),
        (r = !!i.unload),
        (l = i.callback || l),
        c.render(),
        document.addEventListener
          ? (e.addEventListener("scroll", a, !1),
            e.addEventListener("load", a, !1))
          : (e.attachEvent("onscroll", a), e.attachEvent("onload", a));
    }),
    (c.render = function (i) {
      for (
        var n,
          o,
          a = (i || document).querySelectorAll(
            "[data-echo], [data-echo-background]"
          ),
          d = a.length,
          u = {
            l: 0 - t.l,
            t: 0 - t.t,
            b: (e.innerHeight || document.documentElement.clientHeight) + t.b,
            r: (e.innerWidth || document.documentElement.clientWidth) + t.r,
          },
          m = 0;
        m < d;
        m++
      )
        (o = a[m]),
          s(o, u)
            ? (r && o.setAttribute("data-echo-placeholder", o.src),
              null !== o.getAttribute("data-echo-background")
                ? (o.style.backgroundImage =
                    "url(" + o.getAttribute("data-echo-background") + ")")
                : o.src !== (n = o.getAttribute("data-echo")) && (o.src = n),
              r ||
                (o.removeAttribute("data-echo"),
                o.removeAttribute("data-echo-background")),
              l(o, "load"))
            : r &&
              (n = o.getAttribute("data-echo-placeholder")) &&
              (null !== o.getAttribute("data-echo-background")
                ? (o.style.backgroundImage = "url(" + n + ")")
                : (o.src = n),
              o.removeAttribute("data-echo-placeholder"),
              l(o, "unload"));
      d || c.detach();
    }),
    (c.detach = function () {
      document.removeEventListener
        ? e.removeEventListener("scroll", a)
        : e.detachEvent("onscroll", a),
        clearTimeout(i);
    }),
    c
  );
});
