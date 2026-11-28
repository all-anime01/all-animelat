// ============================================================================
//  PERFILES  —  All-Anime  («¿Quién está viendo ahora?»)
//  Varios perfiles dentro de una misma cuenta, como Netflix o Crunchyroll.
//
//  · Cada perfil: users/{uid}/profiles/{id} → { name, avatar, pinHash, order }.
//  · Cada perfil tiene SU historial, Mi lista, vistos, reacciones, avisos…:
//      - el perfil PRINCIPAL ("main") usa las colecciones de siempre
//        (users/{uid}/history…), así nadie pierde lo que ya tenía;
//      - los demás usan las suyas: users/{uid}/history__{id}…
//    profCol() es quien decide el nombre; lo usan user-data.js y engagement.js.
//    Las reglas de Firestore ya permiten cualquier subcolección del usuario.
//  · Al abrir la página o la app (una vez por sesión) se pregunta quién está
//    viendo. Si el perfil tiene PIN, se pide. ¿PIN olvidado? Con la contraseña
//    de la cuenta se quita.
//  · El perfil elegido se recuerda en este dispositivo (localStorage) y cambiar
//    a otro recarga la página para que todo se lea del perfil nuevo.
// ============================================================================

import { db, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { observeAuth, verifyPassword } from "./auth.js";
import { AVATARS, defaultAvatar } from "./avatars.js";
import {
  doc, getDocs, setDoc, deleteDoc, collection, serverTimestamp, query, limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const MAIN_PROFILE = "main";
const MAX_PROFILES = 5;
// Colecciones que son de cada perfil (se borran al eliminar un perfil).
const PER_PROFILE = ["favAnimes", "favEpisodes", "history", "ratings", "reactions", "follows", "watched"];
const LOGO = new URL("../logo-all-anime.svg", import.meta.url).href;

const kActive = (uid) => "aa_prof_" + uid;
const kOk = (uid) => "aa_prof_ok_" + uid;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Id del perfil activo de ese usuario en este dispositivo. */
export function activeProfileId(uid) {
  const v = uid ? lsGet(kActive(uid)) : null;
  return v || MAIN_PROFILE;
}
/** Nombre de la subcolección de `base` para el perfil activo. */
export function profCol(base, uid) {
  const pid = activeProfileId(uid);
  return pid === MAIN_PROFILE ? base : `${base}__${pid}`;
}

let user = null, profiles = [], current = null, ui = null;

export function getActiveProfile() { return current; }
function announce() {
  window.__aaProfile = current;
  document.dispatchEvent(new CustomEvent("aa-profile", { detail: current }));
}

/** Al cerrar sesión: que la próxima vez vuelva a preguntar. */
export function forgetProfileSession() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith("aa_prof_ok_")).forEach((k) => sessionStorage.removeItem(k));
    localStorage.removeItem("aa_last_uid");
  } catch {}
}

// ---------------------------------------------------------------- PIN
async function hashPin(uid, pid, pin) {
  const data = new TextEncoder().encode(`aa-pin:${uid}:${pid}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- Firestore
const profRef = (pid) => doc(db, "users", user.uid, "profiles", pid);
async function loadProfiles() {
  const snap = await getDocs(collection(db, "users", user.uid, "profiles"));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!list.some((p) => p.id === MAIN_PROFILE)) {
    // Primera vez: el perfil principal nace con el nombre y la foto de la cuenta.
    const main = {
      name: (user.displayName || (user.email || "").split("@")[0] || "Yo").slice(0, 20),
      avatar: user.photoURL || defaultAvatar(user.email || user.uid),
      pinHash: "", order: 0,
    };
    try { await setDoc(profRef(MAIN_PROFILE), { ...main, createdAt: serverTimestamp() }); } catch {}
    list.push({ id: MAIN_PROFILE, ...main });
  }
  list.sort((a, b) => (a.id === MAIN_PROFILE ? -1 : b.id === MAIN_PROFILE ? 1 : (a.order || 0) - (b.order || 0)));
  return list;
}
async function saveProfile(p) {
  const { id, ...data } = p;
  await setDoc(profRef(id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
async function removeProfile(p) {
  // Primero lo suyo (historial, Mi lista…), luego el perfil.
  for (const base of PER_PROFILE) {
    const name = `${base}__${p.id}`;
    for (let round = 0; round < 20; round++) {
      const snap = await getDocs(query(collection(db, "users", user.uid, name), limit(200)));
      if (snap.empty) break;
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    }
  }
  await deleteDoc(profRef(p.id));
}

// ---------------------------------------------------------------- Interfaz
function ensureStyles() {
  if (document.getElementById("aa-prof-css")) return;
  const l = document.createElement("link");
  l.id = "aa-prof-css"; l.rel = "stylesheet";
  l.href = new URL("../css/profiles.css", import.meta.url).href;
  document.head.appendChild(l);
}
function overlay() {
  if (ui) return ui;
  ensureStyles();
  const el = document.createElement("div");
  el.id = "aa-prof";
  el.className = "pf";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Perfiles");
  el.innerHTML = `
    <div class="pf-bg"></div>
    <header class="pf-top"><img class="pf-logo" src="${LOGO}" alt="all-anime"></header>
    <main class="pf-stage"><div class="pf-loading"><span></span></div></main>`;
  document.body.appendChild(el);
  document.documentElement.classList.add("pf-lock");
  requestAnimationFrame(() => el.classList.add("show"));
  ui = el;
  return el;
}
function closeOverlay(zoom) {
  if (!ui) return;
  const el = ui; ui = null;
  el.classList.add(zoom ? "leave-zoom" : "leave");
  document.documentElement.classList.remove("pf-lock");
  setTimeout(() => el.remove(), 520);
}
// Cambia la «pantalla» del panel con un fundido.
function view(html, onMount) {
  const stage = ui.querySelector(".pf-stage");
  const old = stage.firstElementChild;
  const nu = document.createElement("div");
  nu.className = "pf-view";
  nu.innerHTML = html;
  if (old) { old.classList.add("out"); setTimeout(() => old.remove(), 260); }
  stage.appendChild(nu);
  requestAnimationFrame(() => requestAnimationFrame(() => nu.classList.add("in")));
  onMount && onMount(nu);
  const first = nu.querySelector("[data-autofocus]") || nu.querySelector("button, input");
  setTimeout(() => { try { first && first.focus({ preventScroll: true }); } catch {} }, 280);
  return nu;
}

// 4 casillas de PIN con salto automático. Devuelve {get(), clear(), shake()}.
function pinBoxes(host, onFull) {
  host.innerHTML = [0, 1, 2, 3].map((i) =>
    `<input class="pf-digit" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" aria-label="Dígito ${i + 1}" ${i === 0 ? "data-autofocus" : ""}>`).join("");
  const ins = [...host.querySelectorAll("input")];
  ins.forEach((inp, i) => {
    inp.addEventListener("input", () => {
      inp.value = inp.value.replace(/\D/g, "").slice(-1);
      inp.classList.toggle("filled", !!inp.value);
      if (inp.value && i < 3) ins[i + 1].focus();
      const v = ins.map((x) => x.value).join("");
      if (v.length === 4 && onFull) onFull(v);
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !inp.value && i > 0) { ins[i - 1].value = ""; ins[i - 1].classList.remove("filled"); ins[i - 1].focus(); }
      if (e.key === "ArrowLeft" && i > 0) ins[i - 1].focus();
      if (e.key === "ArrowRight" && i < 3) ins[i + 1].focus();
    });
    inp.addEventListener("paste", (e) => {
      const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 4);
      if (!t) return;
      e.preventDefault();
      ins.forEach((x, j) => { x.value = t[j] || ""; x.classList.toggle("filled", !!x.value); });
      if (t.length === 4 && onFull) onFull(t); else ins[Math.min(t.length, 3)].focus();
    });
  });
  return {
    get: () => ins.map((x) => x.value).join(""),
    clear: () => { ins.forEach((x) => { x.value = ""; x.classList.remove("filled"); }); ins[0].focus(); },
    shake: () => { host.classList.remove("bad"); void host.offsetWidth; host.classList.add("bad"); },
  };
}

// ---------- Pantalla 1: ¿Quién está viendo ahora? / Administrar perfiles
function renderPick(manage = false) {
  const tiles = profiles.map((p, i) => `
    <button type="button" class="pf-tile" data-id="${esc(p.id)}" style="--i:${i}">
      <span class="pf-av"><img src="${esc(p.avatar)}" alt="" draggable="false">
        ${manage ? '<span class="pf-edit"><i class="fas fa-pen"></i></span>' : ""}</span>
      <span class="pf-name">${esc(p.name)}</span>
      ${p.pinHash ? '<i class="fas fa-lock pf-lock" aria-label="Con PIN"></i>' : '<i class="pf-lock pf-lock-empty"></i>'}
    </button>`).join("");
  const add = profiles.length < MAX_PROFILES ? `
    <button type="button" class="pf-tile pf-add" style="--i:${profiles.length}">
      <span class="pf-av"><i class="fas fa-plus"></i></span>
      <span class="pf-name">Agregar perfil</span><i class="pf-lock pf-lock-empty"></i>
    </button>` : "";
  view(`
    <h1 class="pf-h1">${manage ? "Administrar perfiles" : "¿Quién está viendo ahora?"}</h1>
    <div class="pf-grid ${manage ? "managing" : ""}">${tiles}${add}</div>
    ${manage
      ? '<button type="button" class="pf-btn pf-primary pf-done">Listo</button>'
      : '<button type="button" class="pf-btn pf-outline pf-manage"><i class="fas fa-pen"></i> Administrar perfiles</button>'}
  `, (v) => {
    v.querySelectorAll(".pf-tile[data-id]").forEach((t) => t.addEventListener("click", () => {
      const p = profiles.find((x) => x.id === t.dataset.id);
      if (!p) return;
      if (manage) {
        if (p.pinHash) askPin(p, "Para editar este perfil, introduce su PIN.").then((ok) => ok ? renderEdit(p) : renderPick(true));
        else renderEdit(p);
      } else choose(p, t);
    }));
    v.querySelector(".pf-add")?.addEventListener("click", () => renderEdit(null));
    v.querySelector(".pf-manage")?.addEventListener("click", () => renderPick(true));
    v.querySelector(".pf-done")?.addEventListener("click", () => renderPick(false));
  });
}

async function choose(p, tile) {
  if (p.pinHash) {
    const ok = await askPin(p);
    if (!ok) { renderPick(false); return; }
  }
  const prev = activeProfileId(user.uid);
  lsSet(kActive(user.uid), p.id);
  ssSet(kOk(user.uid), "1");
  current = p;
  if (tile) tile.classList.add("chosen");
  ui?.classList.add("choosing");
  if (prev !== p.id) {
    // Lo que ya se pintó es del perfil anterior: se recarga con el nuevo.
    setTimeout(() => location.reload(), 420);
    return;
  }
  announce();
  setTimeout(() => closeOverlay(true), 260);
}

// ---------- Pantalla 2: PIN. Devuelve una promesa con true si es correcto.
function askPin(p, msg) {
  return new Promise((resolve) => {
    view(`
      <div class="pf-pin">
        <img class="pf-pin-av" src="${esc(p.avatar)}" alt="">
        <p class="pf-kicker">Bloqueo de perfil activado</p>
        <h2 class="pf-h2">${esc(msg || `Introduce el PIN de ${p.name}`)}</h2>
        <div class="pf-digits"></div>
        <p class="pf-err" aria-live="polite"></p>
        <button type="button" class="pf-link pf-forgot">¿Olvidaste tu PIN?</button>
        <button type="button" class="pf-btn pf-ghost pf-cancel">Cancelar</button>
      </div>`, (v) => {
      const err = v.querySelector(".pf-err");
      const box = pinBoxes(v.querySelector(".pf-digits"), async (pin) => {
        if ((await hashPin(user.uid, p.id, pin)) === p.pinHash) { v.querySelector(".pf-digits").classList.add("ok"); setTimeout(() => resolve(true), 220); }
        else { err.textContent = "PIN incorrecto. Inténtalo de nuevo."; box.shake(); setTimeout(box.clear, 380); }
      });
      v.querySelector(".pf-cancel").addEventListener("click", () => resolve(false));
      v.querySelector(".pf-forgot").addEventListener("click", () => forgotPin(p).then(resolve));
    });
  });
}

// ¿PIN olvidado? → contraseña de la cuenta → se quita el PIN de ese perfil.
function forgotPin(p) {
  return new Promise((resolve) => {
    view(`
      <form class="pf-pin pf-forgot-form">
        <img class="pf-pin-av" src="${esc(p.avatar)}" alt="">
        <h2 class="pf-h2">Quitar el PIN de ${esc(p.name)}</h2>
        <p class="pf-sub">Escribe la contraseña de la cuenta <b>${esc(user.email || "")}</b>.</p>
        <input class="pf-in" type="password" autocomplete="current-password" placeholder="Contraseña" data-autofocus required>
        <p class="pf-err" aria-live="polite"></p>
        <div class="pf-row">
          <button type="submit" class="pf-btn pf-primary">Quitar PIN y entrar</button>
          <button type="button" class="pf-btn pf-ghost pf-cancel">Cancelar</button>
        </div>
      </form>`, (v) => {
      const f = v.querySelector("form"), err = v.querySelector(".pf-err");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = f.querySelector("[type=submit]"); btn.disabled = true; err.textContent = "";
        try {
          await verifyPassword(f.querySelector("input").value);
          p.pinHash = "";
          await saveProfile({ id: p.id, pinHash: "" });
          resolve(true);
        } catch (ex) {
          err.textContent = /wrong-password|invalid-credential/.test(ex.code || "") ? "Contraseña incorrecta." : "No se pudo comprobar. Inténtalo de nuevo.";
          btn.disabled = false;
        }
      });
      v.querySelector(".pf-cancel").addEventListener("click", () => resolve(false));
    });
  });
}

// ---------- Pantalla 3: crear / editar perfil
function renderEdit(p) {
  const isNew = !p;
  const draft = p ? { ...p } : {
    id: "p" + Math.random().toString(36).slice(2, 8),
    name: "", avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], pinHash: "",
    order: Math.max(0, ...profiles.map((x) => x.order || 0)) + 1,
  };
  let newPin = "";
  const draw = () => view(`
    <div class="pf-editor">
      <h1 class="pf-h1 small">${isNew ? "Agregar perfil" : "Editar perfil"}</h1>
      ${isNew ? '<p class="pf-sub">Crea un perfil para otra persona que vea all-anime.</p>' : ""}
      <div class="pf-ed-grid">
        <button type="button" class="pf-ed-av" aria-label="Cambiar avatar">
          <img src="${esc(draft.avatar)}" alt=""><span class="pf-ed-pen"><i class="fas fa-pen"></i></span>
        </button>
        <div class="pf-ed-form">
          <label class="pf-label" for="pf-name">Nombre del perfil</label>
          <input id="pf-name" class="pf-in" maxlength="20" value="${esc(draft.name)}" placeholder="Nombre" autocomplete="off" data-autofocus>
          <div class="pf-sec">
            <div><b><i class="fas fa-lock"></i> Bloqueo de perfil</b>
              <small>Pide un PIN de 4 dígitos para entrar a este perfil.</small></div>
            <label class="pf-switch"><input type="checkbox" class="pf-lock-on" ${draft.pinHash ? "checked" : ""}><span></span></label>
          </div>
          <div class="pf-pinset" hidden>
            <p class="pf-label">${draft.pinHash ? "Nuevo PIN" : "Elige un PIN"}</p>
            <div class="pf-digits small"></div>
          </div>
          ${draft.pinHash ? '<button type="button" class="pf-link pf-change-pin"><i class="fas fa-key"></i> Cambiar PIN</button>' : ""}
          <p class="pf-err" aria-live="polite"></p>
        </div>
      </div>
      <div class="pf-row pf-ed-actions">
        <button type="button" class="pf-btn pf-primary pf-save">Guardar</button>
        <button type="button" class="pf-btn pf-ghost pf-cancel">Cancelar</button>
        ${!isNew && draft.id !== MAIN_PROFILE ? '<button type="button" class="pf-btn pf-danger pf-del"><i class="fas fa-trash"></i> Eliminar perfil</button>' : ""}
      </div>
    </div>`, (v) => {
    const name = v.querySelector("#pf-name"), err = v.querySelector(".pf-err");
    const lockOn = v.querySelector(".pf-lock-on"), pinset = v.querySelector(".pf-pinset");
    const boxes = pinBoxes(v.querySelector(".pf-pinset .pf-digits"), (pin) => { newPin = pin; err.textContent = ""; });
    v.querySelector(".pf-pinset .pf-digit")?.removeAttribute("data-autofocus");
    name.addEventListener("input", () => { draft.name = name.value; });
    lockOn.addEventListener("change", () => {
      pinset.hidden = !lockOn.checked || (!!draft.pinHash && !v._changing);
      if (lockOn.checked && !draft.pinHash) setTimeout(() => boxes.clear(), 50);
    });
    v.querySelector(".pf-change-pin")?.addEventListener("click", () => { v._changing = true; pinset.hidden = false; boxes.clear(); });
    v.querySelector(".pf-ed-av").addEventListener("click", () => { draft.name = name.value; renderAvatars(draft.avatar, (src) => { draft.avatar = src; draw(); }); });
    v.querySelector(".pf-cancel").addEventListener("click", () => renderPick(true));
    v.querySelector(".pf-save").addEventListener("click", async () => {
      const nm = name.value.trim();
      if (!nm) { err.textContent = "Escribe un nombre para el perfil."; name.focus(); return; }
      if (profiles.some((x) => x.id !== draft.id && x.name.toLowerCase() === nm.toLowerCase())) { err.textContent = "Ya hay un perfil con ese nombre."; return; }
      let pinHash = draft.pinHash || "";
      if (!lockOn.checked) pinHash = "";
      else if (newPin.length === 4) pinHash = await hashPin(user.uid, draft.id, newPin);
      else if (!pinHash || v._changing) { err.textContent = "Escribe los 4 dígitos del PIN."; return; }
      const btn = v.querySelector(".pf-save"); btn.disabled = true;
      const saved = { id: draft.id, name: nm, avatar: draft.avatar, pinHash, order: draft.order || 0 };
      try {
        await saveProfile(isNew ? { ...saved, createdAt: serverTimestamp() } : saved);
        const i = profiles.findIndex((x) => x.id === saved.id);
        if (i >= 0) profiles[i] = saved; else profiles.push(saved);
        if (current && current.id === saved.id) { current = saved; announce(); }
        renderPick(true);
      } catch (ex) { console.error(ex); err.textContent = "No se pudo guardar. Revisa tu conexión."; btn.disabled = false; }
    });
    v.querySelector(".pf-del")?.addEventListener("click", () => confirmDelete(draft));
  });
  draw();
}

function confirmDelete(p) {
  view(`
    <div class="pf-pin">
      <img class="pf-pin-av" src="${esc(p.avatar)}" alt="">
      <h2 class="pf-h2">¿Eliminar el perfil «${esc(p.name)}»?</h2>
      <p class="pf-sub">Se borrarán su historial, Mi lista y lo que haya marcado como visto. No se puede deshacer.</p>
      <p class="pf-err" aria-live="polite"></p>
      <div class="pf-row">
        <button type="button" class="pf-btn pf-danger pf-yes" data-autofocus><i class="fas fa-trash"></i> Eliminar perfil</button>
        <button type="button" class="pf-btn pf-ghost pf-no">Conservar</button>
      </div>
    </div>`, (v) => {
    v.querySelector(".pf-no").addEventListener("click", () => renderEdit(p));
    const yes = v.querySelector(".pf-yes");
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      try {
        await removeProfile(p);
        profiles = profiles.filter((x) => x.id !== p.id);
        if (activeProfileId(user.uid) === p.id) { lsSet(kActive(user.uid), MAIN_PROFILE); location.reload(); return; }
        renderPick(true);
      } catch (ex) { console.error(ex); v.querySelector(".pf-err").textContent = "No se pudo eliminar. Inténtalo de nuevo."; yes.disabled = false; }
    });
  });
}

// ---------- Pantalla 4: elegir avatar
function renderAvatars(selected, done) {
  view(`
    <div class="pf-avatars">
      <h1 class="pf-h1 small">Elige un ícono de perfil</h1>
      <div class="pf-av-grid">
        ${AVATARS.map((src, i) => `<button type="button" class="pf-av-opt ${src === selected ? "sel" : ""}" data-src="${esc(src)}" style="--i:${i}" ${src === selected ? "data-autofocus" : ""}>
          <img src="${esc(src)}" alt="" loading="lazy" draggable="false"></button>`).join("")}
      </div>
      <button type="button" class="pf-btn pf-ghost pf-back">Volver</button>
    </div>`, (v) => {
    v.querySelectorAll(".pf-av-opt").forEach((b) => b.addEventListener("click", () => done(b.dataset.src)));
    v.querySelector(".pf-back").addEventListener("click", () => done(selected));
  });
}

/** Abre el selector a mano (menú de la cuenta): «Cambiar perfil» o «Administrar». */
export async function openProfilePicker({ manage = false } = {}) {
  if (!user) return;
  overlay();
  ui.classList.add("dismissable");
  if (!profiles.length) profiles = await loadProfiles();
  renderPick(manage);
}

// Esc cierra el selector si se abrió a mano y ya hay un perfil elegido.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui && ui.classList.contains("dismissable") && user && ssGet(kOk(user.uid))) closeOverlay(false);
});

export function initProfiles() {
  if (!FIREBASE_CONFIGURED || window.self !== window.top) return;
  // Si en este dispositivo había una sesión y aún no se eligió perfil, se tapa
  // la página YA (antes de saber quién es) para que no se vea un parpadeo.
  const last = lsGet("aa_last_uid");
  if (last && !ssGet(kOk(last))) overlay();
  let seen = null;
  observeAuth(async (u) => {
    if ((u && u.uid) === seen) return;
    seen = u ? u.uid : null;
    user = u;
    if (!u) {
      current = null; profiles = [];
      try { localStorage.removeItem("aa_last_uid"); } catch {}
      if (ui) closeOverlay(false);
      announce();
      return;
    }
    lsSet("aa_last_uid", u.uid);
    try { profiles = await loadProfiles(); }
    catch (e) { console.error("perfiles:", e); if (ui) closeOverlay(false); return; }
    const pid = activeProfileId(u.uid);
    current = profiles.find((p) => p.id === pid) || profiles[0];
    if (current.id !== pid) lsSet(kActive(u.uid), current.id);
    if (ssGet(kOk(u.uid))) { announce(); if (ui) closeOverlay(false); return; }
    // Nueva sesión (página o app recién abierta): ¿quién está viendo?
    announce();
    overlay();
    renderPick(false);
  });
}
