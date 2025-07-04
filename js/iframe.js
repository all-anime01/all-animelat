function go_to_player(url) {
  document.querySelector(".BotHumano").classList.add("BotHumanoA");
  document
    .querySelector(".BotHumano")
    .insertAdjacentHTML(
      "afterbegin",
      '<div class="BoxHumano"><span><b>Procesando video</b> <p>Por favor espere unos segundos</p></span></div>'
    );
  var displayVideo = document.querySelector(".DisplayVideo");
  displayVideo.classList.add("DisplayVideoA");
  displayVideo.style.zIndex = "9999";
  displayVideo.innerHTML =
    `
  <span id="backToPlayers" onclick="listPlayer();">
      <img src="data:image/svg+xml;base64,PHN2ZyBjbGFzcz0ibmF2LWl0ZW0taWNvbiBiYXNlLXN2Zy0taXMtZmxpcC0tUXZDUUMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDI0IDI0IiBkYXRhLXQ9InNpZ24tb3V0LXN2ZyIgYXJpYS1sYWJlbGxlZGJ5PSJzaWduLW91dC1zdmciIGFyaWEtaGlkZGVuPSJ0cnVlIiByb2xlPSJpbWciPjx0aXRsZSBpZD0ic2lnbi1vdXQtc3ZnIj5EZXNjb25lY3RhcjwvdGl0bGU+PHBhdGggZD0iTTE1IDE1YTEgMSAwIDAgMSAxIDF2NWExIDEgMCAwIDEtMSAxSDVhMSAxIDAgMCAxLTEtMVYzYTEgMSAwIDAgMSAxLTFoMTBhMSAxIDAgMCAxIDEgMXY1YTEgMSAwIDEgMS0yIDBWNEg2djE2aDh2LTRhMSAxIDAgMCAxIDEtMXptOC45MjMtMi42MThhMSAxIDAgMCAxLS4yMTcuMzI2bC00IDMuOTk5QS45OTMuOTkzIDAgMCAxIDE5IDE3YS45OTkuOTk5IDAgMCAxLS43MDctMS43MDdMMjAuNTg2IDEzSDE1YTEgMSAwIDAgMSAwLTJoNS41ODZsLTIuMjkzLTIuMjkzYS45OTkuOTk5IDAgMSAxIDEuNDE0LTEuNDE0bDMuOTk5IDRhLjk5Mi45OTIgMCAwIDEgLjIxNyAxLjA4OXoiLz48L3N2Zz4=">
  </span>
  <iframe onload='document.querySelector(".BotHumano").classList.remove("BotHumanoA")' id="IFR" src="` +
    url +
    `" frameborder="0" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe>`;

  let idleTimer = null;
  let idleState = false;

  const isMobile = navigator.userAgentData.mobile; //resolves true/false
  let timeShow = isMobile ? 10000 : 5000;

  function showFoo(time, mobile) {
    elem = document.getElementById("backToPlayers");
    ifr = document.getElementById("IFR");

    if (idleState == true) {
      elem.className = "";
      ifr.className = "";
    }
    clearTimeout(idleTimer);
    idleState = false;
    idleTimer = setTimeout(function () {
      console.log("Timeout");
      elem.className = "inactive";
      ifr.className = "nopoints";
      idleState = true;
      idleTimer = null;
    }, time);
  }

  showFoo(timeShow);

  if (isMobile) {
    document.addEventListener("click", (e) => {
      clearTimeout(idleTimer);
      showFoo(timeShow);
    });
  } else {
    document.addEventListener("mousemove", (e) => {
      showFoo(timeShow);
    });
  }
}

function listPlayer() {
  document.querySelector(".BotHumano").classList.remove("BotHumanoA");
  var displayVideo = document.querySelector(".DisplayVideo");
  displayVideo.classList.remove("DisplayVideoA");
  displayVideo.style.zIndex = "1";
  displayVideo.innerHTML = "";
}

function CrearSuperCookie(key, value, ttl) {
  const now = new Date();

  // `item` is an object which contains the original value
  // as well as the time when it's supposed to expire
  const item = {
    value: value,
    expiry: now.getTime() + ttl * 60000,
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function obtenerSuperCookie(key) {
  const itemStr = localStorage.getItem(key);
  console.log(itemStr);
  // if the item doesn't exist, return null
  if (!itemStr) {
    return null;
  }
  const item = JSON.parse(itemStr);
  const now = new Date();
  console.log(now.getTime());
  console.log(item.expiry);
  // compare the expiry time of the item with the current time
  if (now.getTime() > item.expiry) {
    // If the item is expired, delete the item from storage
    // and return null
    localStorage.removeItem(key);
    return null;
  }
  return item.value;
}

var msj = document.getElementById("msjad");

if (obtenerSuperCookie("msjad") == null) {
  msj.style.display = "flex";
}

function hideMsj(time = 0) {
  CrearSuperCookie("msjad", true, time * 60);
  msj.style.display = "none";
}

function SelLang(who, id) {
  document.querySelector(".FirstLoad").classList.add("FirstLoadA");
  if (document.querySelector(".SLD_A") != null) {
    document.querySelector(".SLD_A").classList.remove("SLD_A");
  }
  who.classList.add("SLD_A");
  setTimeout(function () {
    document.querySelector(".FirstLoad").classList.remove("FirstLoadA");
    if (document.querySelector(".REactiv") != null) {
      document.querySelector(".REactiv").classList.remove("REactiv");
    }
    document.querySelector(".OD_" + id).classList.add("REactiv");
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
