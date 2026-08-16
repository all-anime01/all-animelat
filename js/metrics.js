// ============================================================================
//  MÉTRICAS Y OBSERVABILIDAD — All-Anime
//  Integra Sentry (errores), Mixpanel (analítica de producto), Hotjar (mapas de
//  calor/grabaciones) y Grafana Faro (observabilidad web). Todo se activa SOLO
//  si el admin configuró la clave correspondiente en Firestore (config/analytics)
//  desde el panel → pestaña "Métricas". Sin claves, no carga nada (cero peso).
// ============================================================================
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let cfg = null;
const queue = [];

function loadScript(src, attrs, cb) {
  const s = document.createElement("script");
  s.src = src; s.async = true;
  if (attrs) for (const k in attrs) s.setAttribute(k, attrs[k]);
  s.onload = () => cb && cb();
  s.onerror = () => console.warn("metrics: no se pudo cargar", src);
  document.head.appendChild(s);
}

function initSentry(dsn) {
  loadScript("https://browser.sentry-cdn.com/7.120.3/bundle.min.js", { crossorigin: "anonymous" }, () => {
    try {
      window.Sentry.init({ dsn, tracesSampleRate: 0.1, replaysSessionSampleRate: 0, environment: location.hostname });
      window.Sentry.setTag("site", "all-anime");
    } catch (e) { console.warn("Sentry init", e); }
  });
}

function initMixpanel(token) {
  // Snippet oficial de Mixpanel (define window.mixpanel y carga la librería).
  (function (f, b) { if (!b.__SV) { var e, g, i, h; window.mixpanel = b; b._i = []; b.init = function (e, f, c) { function g(a, d) { var b = d.split("."); 2 == b.length && ((a = a[b[0]]), (d = b[1])); a[d] = function () { a.push([d].concat(Array.prototype.slice.call(arguments, 0))); }; } var a = b; "undefined" !== typeof c ? (a = b[c] = []) : (c = "mixpanel"); a.people = a.people || []; a.toString = function (a) { var d = "mixpanel"; "mixpanel" !== c && (d += "." + c); a || (d += " (stub)"); return d; }; a.people.toString = function () { return a.toString(1) + ".people (stub)"; }; i = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" "); for (h = 0; h < i.length; h++) g(a, i[h]); var j = "set set_once union unset remove delete".split(" "); a.get_group = function () { function b(c) { d[c] = function () { call2_args = arguments; call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); a.push([e, call2]); }; } for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++) b(j[c]); return d; }; b._i.push([e, f, c]); }; b.__SV = 1.2; e = f.createElement("script"); e.type = "text/javascript"; e.async = !0; e.src = "undefined" !== typeof MIXPANEL_CUSTOM_LIB_URL ? MIXPANEL_CUSTOM_LIB_URL : "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"; g = f.getElementsByTagName("script")[0]; g.parentNode.insertBefore(e, g); } })(document, window.mixpanel || []);
  try { window.mixpanel.init(token, { track_pageview: true, persistence: "localStorage", ignore_dnt: false }); } catch (e) { console.warn("Mixpanel init", e); }
}

function initHotjar(id) {
  (function (h, o, t, j, a, r) {
    h.hj = h.hj || function () { (h.hj.q = h.hj.q || []).push(arguments); };
    h._hjSettings = { hjid: Number(id), hjsv: 6 };
    a = o.getElementsByTagName("head")[0];
    r = o.createElement("script"); r.async = 1;
    r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
    a.appendChild(r);
  })(window, document, "https://static.hotjar.com/c/hotjar-", ".js?sv=");
}

function initFaro(url, appName) {
  loadScript("https://unpkg.com/@grafana/faro-web-sdk@1.13.2/dist/bundle/faro-web-sdk.iife.js", null, () => {
    try {
      window.faro = window.GrafanaFaroWebSdk.initializeFaro({ url, app: { name: appName || "all-anime", version: "1.0" } });
    } catch (e) { console.warn("Faro init", e); }
  });
}

// Inicializa lo que esté configurado. Se llama una vez por página.
export async function initMetrics() {
  try { const s = await getDoc(doc(db, "config", "analytics")); cfg = s.exists() ? (s.data() || {}) : {}; }
  catch { cfg = {}; }
  if (cfg && cfg.enabled !== false) {
    if (cfg.sentryDsn) initSentry(cfg.sentryDsn);
    if (cfg.mixpanelToken) initMixpanel(cfg.mixpanelToken);
    if (cfg.hotjarId) initHotjar(cfg.hotjarId);
    if (cfg.faroUrl) initFaro(cfg.faroUrl, cfg.faroApp);
  }
  // vacía la cola de eventos que llegaron antes de cargar la config
  const q = queue.splice(0);
  q.forEach(([n, p]) => track(n, p));
  track("page_view", { path: location.pathname + location.search });
}

// Registra un evento en las herramientas activas (seguro si no hay ninguna).
export function track(name, props) {
  if (cfg === null) { queue.push([name, props]); return; }
  const p = props || {};
  try { if (window.mixpanel && window.mixpanel.track) window.mixpanel.track(name, p); } catch {}
  try { if (window.faro && window.faro.api) window.faro.api.pushEvent(name, p); } catch {}
  try { if (window.Sentry && window.Sentry.addBreadcrumb) window.Sentry.addBreadcrumb({ category: "event", message: name, data: p, level: "info" }); } catch {}
  try { if (window.hj) window.hj("event", name); } catch {}
}

// Identifica al usuario logueado en las herramientas (para segmentar).
export function identify(user) {
  if (!user) return;
  try { if (window.mixpanel && window.mixpanel.identify) { window.mixpanel.identify(user.uid); window.mixpanel.people && window.mixpanel.people.set({ $email: user.email || "", $name: user.displayName || "" }); } } catch {}
  try { if (window.Sentry && window.Sentry.setUser) window.Sentry.setUser({ id: user.uid, email: user.email || "" }); } catch {}
  try { if (window.faro && window.faro.api) window.faro.api.setUser({ id: user.uid, email: user.email || "" }); } catch {}
}

export function captureError(err, extra) {
  try { if (window.Sentry && window.Sentry.captureException) window.Sentry.captureException(err, extra ? { extra } : undefined); } catch {}
}
