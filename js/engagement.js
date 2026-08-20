// ============================================================================
//  ENGAGEMENT POR EPISODIO  —  All-Anime
//  Like/dislike, comentarios (con foto), favorito, visto automático por
//  duración y autoplay estilo Netflix. Se monta en el modal del reproductor.
// ============================================================================

import { db, isAdmin, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { observeAuth } from "./auth.js";
import { episodeId as makeEpId } from "./catalog-utils.js";
import { defaultAvatar } from "./avatars.js";
import { toggleFavEpisode, isFavEpisode } from "./user-data.js";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, collection, query, where,
  onSnapshot, serverTimestamp, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Estado de sesión (compartido) -----------------------------------------
let currentUser = null;
const userReady = new Promise((resolve) => {
  if (!FIREBASE_CONFIGURED) { resolve(null); return; }
  let first = true;
  try {
    observeAuth((u) => {
      currentUser = u;
      if (first) { first = false; resolve(u); }
      else if (activeCtx) initPlayerEngagement(activeCtx);
    });
  } catch (e) { console.warn("[engagement] auth no disponible", e); resolve(null); }
});

let activeCtx = null;
let commentsUnsub = null;
let autoWatchedListener = null;
let endTimer = null;       // temporizador de fin de episodio (auto-visto + autoplay)
let countdownTimer = null;

// ---- Estilos (una sola vez) ------------------------------------------------
function injectStyles() {
  if (document.getElementById("engagement-styles")) return;
  const css = `
  /* Título del anime y episodio en el modal */
  #player-anime-link,#player-anime-title{color:#ff3b3b!important;text-decoration:none}
  #player-anime-title{font-size:22px;font-weight:800;letter-spacing:.3px;text-shadow:0 0 14px rgba(255,59,59,.3)}
  #player-anime-link:hover #player-anime-title{filter:brightness(1.15)}
  #player-episode-title{font-size:18px;font-weight:700;color:#f0f0f0;margin-top:2px}

  .eng-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0}
  .eng-btn{display:inline-flex;align-items:center;gap:8px;background:#242424;color:#f0f0f0;border:1px solid #383838;padding:10px 16px;border-radius:10px;cursor:pointer;font-size:14px;font-family:inherit;font-weight:600;transition:transform .12s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease}
  .eng-btn:hover{border-color:#ca3030;transform:translateY(-1px)}
  .eng-btn:active{transform:scale(.94)}
  .eng-btn i{transition:transform .18s ease}
  .eng-btn.active{background:linear-gradient(135deg,#ca3030,#e23b3b);border-color:#ca3030;color:#fff;box-shadow:0 4px 16px rgba(202,48,48,.35)}
  .eng-like.active i{animation:eng-pop .35s ease}
  .eng-dislike.active{background:#3a3f47;border-color:#3a3f47;box-shadow:none}
  .eng-fav.active i{color:#ffd24a}
  .eng-btn:disabled{opacity:.5;cursor:not-allowed}
  @keyframes eng-pop{0%{transform:scale(1)}45%{transform:scale(1.45)}100%{transform:scale(1)}}
  .eng-next{background:linear-gradient(135deg,#ca3030,#e23b3b);border-color:#ca3030;color:#fff;margin-left:auto}
  .eng-autoplay{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#b8b8b8;cursor:pointer;user-select:none}
  .eng-autoplay input{accent-color:#ca3030;width:16px;height:16px}
  .eng-login-note{font-size:13px;color:#a0a0a0;margin:8px 0}
  .eng-login-note a{color:#ff6b6b}

  .eng-comments{margin-top:24px;border-top:1px solid #2c2c2c;padding-top:18px}
  .eng-comments h4{font-size:17px;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .eng-comments h4 i{color:#ca3030}
  .eng-cform{display:flex;gap:12px;margin-bottom:20px;align-items:flex-start}
  .eng-cform .eng-avatar{width:40px;height:40px}
  .eng-cform textarea{flex:1;min-height:46px;max-height:160px;background:#161616;border:1px solid #303030;border-radius:12px;color:#f0f0f0;padding:12px 14px;font-family:inherit;font-size:14px;resize:vertical;transition:border-color .15s}
  .eng-cform textarea:focus{outline:none;border-color:#ca3030}
  .eng-csend{align-self:stretch;background:linear-gradient(135deg,#ca3030,#e23b3b);color:#fff;border:none;border-radius:12px;padding:0 20px;font-weight:700;cursor:pointer;transition:transform .12s}
  .eng-csend:hover{transform:translateY(-1px)} .eng-csend:active{transform:scale(.96)}
  .eng-comment{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #232323;animation:eng-fade .3s ease}
  @keyframes eng-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1}}
  .eng-avatar{flex:none;width:40px;height:40px;border-radius:50%;object-fit:cover;background:#ca3030;display:flex;align-items:center;justify-content:center;font-weight:700;text-transform:uppercase;color:#fff;border:2px solid #333}
  img.eng-avatar{border-color:#ca3030}
  .eng-cbody{flex:1;min-width:0}
  .eng-cmeta{font-size:12px;color:#888;margin-bottom:4px;display:flex;align-items:center;gap:8px}
  .eng-cmeta b{color:#f0f0f0;font-size:13.5px}
  .eng-ctext{font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  .eng-cdel{background:none;border:none;color:#777;cursor:pointer;font-size:12px;margin-left:auto;transition:color .15s}
  .eng-cdel:hover{color:#ff5c5c}
  .eng-empty{color:#888;font-size:14px;padding:8px 0}

  /* Cuenta regresiva estilo Netflix — tarjeta COMPACTA dentro de la info del
     modal (columna de navegación), ya NO flotando sobre el video (en Fire TV
     el overlay sobre el iframe dejaba el video en negro). */
  .eng-countdown{position:relative;width:100%;background:rgba(20,20,24,.96);border:1px solid #3a3a3a;border-radius:14px;padding:12px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 28px rgba(0,0,0,.45);animation:eng-slide .3s ease;margin-bottom:14px}
  @keyframes eng-slide{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
  .eng-countdown img{width:104px;height:60px;object-fit:cover;border-radius:9px;flex:none;background:#222}
  .eng-cd-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
  .eng-cd-label{font-size:11px;letter-spacing:1px;color:#ff8a4c;text-transform:uppercase;font-weight:800}
  .eng-cd-title{font-size:14px;color:#fff;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .eng-cd-info{display:flex;align-items:center;gap:11px;margin-top:4px}
  .eng-cd-ring{position:relative;width:48px;height:48px;flex:none}
  .eng-cd-ring svg{width:48px;height:48px;transform:rotate(-90deg)}
  .eng-cd-track{fill:none;stroke:#333;stroke-width:4}
  .eng-cd-prog{fill:none;stroke:#ff5a3c;stroke-width:4;stroke-linecap:round;stroke-dasharray:125.6;stroke-dashoffset:0}
  .eng-cd-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
  .eng-cd-actions{display:flex;flex-direction:column;gap:6px;flex:1}
  .eng-cd-actions button{padding:8px 10px;border-radius:9px;border:none;cursor:pointer;font-weight:700;font-size:12.5px;transition:transform .1s;white-space:nowrap}
  .eng-cd-actions button:active{transform:scale(.95)}
  .eng-cd-go{background:linear-gradient(135deg,#ca3030,#e23b3b);color:#fff}
  .eng-cd-cancel{background:#333;color:#fff}
  @media (max-width:560px){.eng-countdown img{width:88px;height:52px}}

  `;
  const s = document.createElement("style");
  s.id = "engagement-styles";
  s.textContent = css;
  document.head.appendChild(s);
}

const initial = (name) => (name || "?").trim().charAt(0) || "?";
const durationToMs = (d) => (parseInt(String(d).match(/\d+/)?.[0] || "24", 10)) * 60000;

// ---- Autoplay / fin de episodio --------------------------------------------
export function autoplayEnabled() { return localStorage.getItem("autoplayNext") !== "0"; } // por defecto ON
function setAutoplay(on) { localStorage.setItem("autoplayNext", on ? "1" : "0"); }

export function clearAutoplay() {
  clearTimeout(endTimer); endTimer = null;
  clearInterval(countdownTimer); countdownTimer = null;
  document.querySelector(".eng-countdown")?.remove();
}

// Notifica a la UI (tarjetas de la lista y botón del modal) que un episodio
// cambió su estado de "visto", para reflejarlo al instante.
function dispatchWatched(epId, animeId, on) {
  document.dispatchEvent(new CustomEvent("episode-watched", { detail: { epId, animeId, watched: on } }));
}

// Marca un episodio como visto (Firestore) y avisa a la UI. La invoca el
// tracker de reproducción cuando detecta el fin del vídeo (misma heurística
// que "seguir viendo").
export async function markEpisodeWatched(anime, episode) {
  await userReady;
  if (!currentUser) return false;
  const epId = makeEpId(anime.id, episode);
  try {
    await markWatched(epId, anime, episode, currentUser);
    dispatchWatched(epId, anime.id, true);
    return true;
  } catch (e) { return false; }
}

// Cuenta regresiva de autoplay hacia el siguiente episodio (estilo Netflix, 5s).
export function startAutoplayCountdown(nextEpisode, onPlayNext) {
  if (nextEpisode && onPlayNext) startCountdown(8, nextEpisode, onPlayNext);
}

function startCountdown(seconds, nextEpisode, onPlayNext) {
  // El contador vive en la INFO del modal (columna de navegación), NO sobre el
  // video: así no tapa/ennegrece el iframe del server en Fire TV. Se coloca
  // arriba de la columna, junto a "Siguiente episodio".
  const container = document.querySelector(".player-nav-col")
    || document.querySelector(".player-details-content")
    || document.querySelector(".player-details-container");
  if (!container || !onPlayNext) return;
  clearInterval(countdownTimer);
  document.querySelector(".eng-countdown")?.remove();

  const C = 125.6;   // circunferencia del anillo (2π·20)
  let n = seconds;
  const box = document.createElement("div");
  box.className = "eng-countdown";
  box.innerHTML = `
    <img src="${nextEpisode.img || ""}" alt="">
    <div class="eng-cd-body">
      <span class="eng-cd-label">Siguiente episodio en <span class="eng-cd-n">${n}</span>s</span>
      <span class="eng-cd-title">E${nextEpisode.number} · ${nextEpisode.title || ""}</span>
      <div class="eng-cd-info">
        <div class="eng-cd-ring" aria-label="Cuenta regresiva">
          <svg viewBox="0 0 48 48"><circle class="eng-cd-track" cx="24" cy="24" r="20"/><circle class="eng-cd-prog" cx="24" cy="24" r="20"/></svg>
          <span class="eng-cd-num">${n}</span>
        </div>
        <div class="eng-cd-actions">
          <button class="eng-cd-go"><i class="fas fa-play"></i> Reproducir ahora</button>
          <button class="eng-cd-cancel">Cancelar</button>
        </div>
      </div>
    </div>`;
  container.prepend(box);   // arriba de la columna de info
  // El anillo se vacía en `seconds` segundos (feedback visual del conteo).
  const prog = box.querySelector(".eng-cd-prog");
  requestAnimationFrame(() => { prog.style.transition = `stroke-dashoffset ${seconds}s linear`; prog.style.strokeDashoffset = String(C); });
  const setNum = (v) => box.querySelectorAll(".eng-cd-num, .eng-cd-n").forEach((el) => el.textContent = Math.max(0, v));
  const go = () => { clearAutoplay(); onPlayNext(); };
  box.querySelector(".eng-cd-go").onclick = go;
  box.querySelector(".eng-cd-cancel").onclick = () => clearAutoplay();
  countdownTimer = setInterval(() => {
    n -= 1;
    setNum(n);
    if (n <= 0) go();
  }, 1000);
}

// ---- Reacciones: like / dislike --------------------------------------------
async function readReactionState(epId, user) {
  const statSnap = await getDoc(doc(db, "episodeStats", epId));
  const d = statSnap.exists() ? statSnap.data() : {};
  let mine = null;
  if (user) {
    const rSnap = await getDoc(doc(db, "users", user.uid, "reactions", epId));
    if (rSnap.exists()) mine = rSnap.data().type;
  }
  return { likeCount: d.likeCount || 0, dislikeCount: d.dislikeCount || 0, mine };
}
async function setReaction(epId, anime, user, type) {
  const statRef = doc(db, "episodeStats", epId);
  const rRef = doc(db, "users", user.uid, "reactions", epId);
  let result = null;
  await runTransaction(db, async (tx) => {
    const [sSnap, rSnap] = [await tx.get(statRef), await tx.get(rRef)];
    const s = sSnap.exists() ? sSnap.data() : {};
    let like = s.likeCount || 0, dis = s.dislikeCount || 0;
    const cur = rSnap.exists() ? rSnap.data().type : null;
    if (cur === type) {
      if (type === "like") like--; else dis--;
      tx.delete(rRef); result = null;
    } else {
      if (cur === "like") like--; else if (cur === "dislike") dis--;
      if (type === "like") like++; else dis++;
      tx.set(rRef, { type, animeId: anime.id, at: serverTimestamp() });
      result = type;
    }
    tx.set(statRef, { likeCount: Math.max(0, like), dislikeCount: Math.max(0, dis) }, { merge: true });
  });
  return result;
}

// ---- Vistos -----------------------------------------------------------------
function watchedRef(user, epId) { return doc(db, "users", user.uid, "watched", epId); }
async function markWatched(epId, anime, episode, user) {
  await setDoc(watchedRef(user, epId), {
    animeId: anime.id, animeTitle: anime.title, img: episode.img || anime.img || "",
    season: episode.season, number: episode.number, title: episode.title || "",
    videoUrl: episode.videoUrl || "", at: serverTimestamp(),
  }, { merge: true });
}
async function isWatched(epId, user) {
  return (await getDoc(watchedRef(user, epId))).exists();
}

export async function getWatchedSet(animeId) {
  await userReady;
  if (!currentUser) return new Set();
  try {
    const q = query(collection(db, "users", currentUser.uid, "watched"), where("animeId", "==", animeId));
    const snap = await getDocs(q);
    return new Set(snap.docs.map((d) => d.id));
  } catch (e) { return new Set(); }
}
export { makeEpId };

// ---- Comentarios ------------------------------------------------------------
function renderComments(items, listEl, user) {
  if (!items.length) { listEl.innerHTML = '<p class="eng-empty">Sé el primero en comentar.</p>'; return; }
  const admin = isAdmin(user);
  listEl.innerHTML = items.map((c) => {
    const name = c.userName || "Usuario";
    const canDel = user && (c.uid === user.uid || admin);
    const when = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString("es", { day: "numeric", month: "short" }) : "";
    const photo = c.userPhoto || defaultAvatar(name);
    return `<div class="eng-comment">
      <img class="eng-avatar" src="${photo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'eng-avatar',textContent:'${initial(name)}'}))">
      <div class="eng-cbody">
        <div class="eng-cmeta"><b>${escapeHtml(name)}</b> · ${when}
          ${canDel ? `<button class="eng-cdel" data-id="${c.id}" title="Eliminar"><i class="fas fa-trash"></i></button>` : ""}</div>
        <div class="eng-ctext">${escapeHtml(c.text)}</div>
      </div></div>`;
  }).join("");
  listEl.querySelectorAll(".eng-cdel").forEach((b) =>
    b.addEventListener("click", () => deleteDoc(doc(db, "comments", b.dataset.id)).catch(console.error)));
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ============================================================================
//  MONTAJE PRINCIPAL EN EL REPRODUCTOR
// ============================================================================
export async function initPlayerEngagement(ctx) {
  activeCtx = ctx;
  injectStyles();
  const { anime, episode, nextEpisode, onPlayNext } = ctx;
  const actionsEl = document.getElementById("player-episode-actions");
  const commentsHost = document.getElementById("episode-comments");
  const epId = makeEpId(anime.id, episode);

  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }

  await userReady;
  const user = currentUser;

  // ---- Barra de acciones ----
  if (actionsEl) {
    const { likeCount, dislikeCount, mine } = await readReactionState(epId, user).catch(() => ({ likeCount: 0, dislikeCount: 0, mine: null }));
    const watched = user ? await isWatched(epId, user).catch(() => false) : false;
    const fav = user ? await isFavEpisode(anime, episode).catch(() => false) : false;
    actionsEl.innerHTML = `
      <button class="eng-btn eng-like ${mine === "like" ? "active" : ""}" ${user ? "" : "disabled"} title="Me gusta">
        <i class="fas fa-thumbs-up"></i> <span class="eng-like-count">${likeCount}</span>
      </button>
      <button class="eng-btn eng-dislike ${mine === "dislike" ? "active" : ""}" ${user ? "" : "disabled"} title="No me gusta">
        <i class="fas fa-thumbs-down"></i> <span class="eng-dislike-count">${dislikeCount}</span>
      </button>
      <button class="eng-btn eng-fav ${fav ? "active" : ""}" ${user ? "" : "disabled"} title="Agregar episodio favorito">
        <i class="${fav ? "fas" : "far"} fa-bookmark"></i> <span class="eng-fav-txt">${fav ? "Episodio favorito" : "Agregar episodio favorito"}</span>
      </button>
      <button class="eng-btn eng-watched ${watched ? "active" : ""}" ${user ? "" : "disabled"} title="Marcar como visto">
        <i class="fas fa-check"></i> <span class="eng-w-txt">${watched ? "Visto" : "Marcar visto"}</span>
      </button>
      <label class="eng-autoplay" title="Reproducir el siguiente automáticamente"><input type="checkbox" class="eng-ap" ${autoplayEnabled() ? "checked" : ""}> Autoplay</label>
    `;

    const likeBtn = actionsEl.querySelector(".eng-like");
    const disBtn = actionsEl.querySelector(".eng-dislike");
    const watchedBtn = actionsEl.querySelector(".eng-watched");
    async function react(type) {
      if (!user) return;
      likeBtn.disabled = disBtn.disabled = true;
      try {
        const res = await setReaction(epId, anime, user, type);
        likeBtn.classList.toggle("active", res === "like");
        disBtn.classList.toggle("active", res === "dislike");
        const st = await readReactionState(epId, user);
        likeBtn.querySelector(".eng-like-count").textContent = st.likeCount;
        disBtn.querySelector(".eng-dislike-count").textContent = st.dislikeCount;
      } catch (err) { console.error(err); } finally { likeBtn.disabled = disBtn.disabled = false; }
    }
    likeBtn.addEventListener("click", () => react("like"));
    disBtn.addEventListener("click", () => react("dislike"));

    // Favorito de episodio
    actionsEl.querySelector(".eng-fav").addEventListener("click", async (e) => {
      if (!user) return;
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const on = await toggleFavEpisode(anime, episode);
        btn.classList.toggle("active", on);
        btn.querySelector("i").className = (on ? "fas" : "far") + " fa-bookmark";
        btn.querySelector(".eng-fav-txt").textContent = on ? "Episodio favorito" : "Agregar episodio favorito";
      } catch (err) { console.error(err); } finally { btn.disabled = false; }
    });

    const setWatchedUI = (on) => {
      watchedBtn.classList.toggle("active", on);
      watchedBtn.querySelector(".eng-w-txt").textContent = on ? "Visto" : "Marcar visto";
    };
    watchedBtn.addEventListener("click", async () => {
      if (!user) return;
      try {
        if (watchedBtn.classList.contains("active")) { await deleteDoc(watchedRef(user, epId)); setWatchedUI(false); dispatchWatched(epId, anime.id, false); }
        else { await markWatched(epId, anime, episode, user); setWatchedUI(true); dispatchWatched(epId, anime.id, true); }
      } catch (err) { console.error(err); }
    });

    // Refleja al instante el "visto" automático (disparado por el tracker) en
    // el botón del modal de este mismo episodio. Se reemplaza el anterior para
    // no acumular listeners entre aperturas.
    if (autoWatchedListener) document.removeEventListener("episode-watched", autoWatchedListener);
    autoWatchedListener = (e) => { if (e.detail && e.detail.epId === epId && e.detail.watched) setWatchedUI(true); };
    document.addEventListener("episode-watched", autoWatchedListener);

    actionsEl.querySelector(".eng-ap").addEventListener("change", (e) => setAutoplay(e.target.checked));
  }

  // ---- Comentarios ----
  if (commentsHost) {
    const myPhoto = user ? (user.photoURL || defaultAvatar(user.displayName || user.email)) : "";
    commentsHost.innerHTML = `
      <div class="eng-comments">
        <h4><i class="fas fa-comments"></i> Comentarios</h4>
        ${user ? `<div class="eng-cform">
            <img class="eng-avatar" src="${myPhoto}" alt="">
            <textarea class="eng-ctext-input" maxlength="1000" placeholder="Escribe un comentario…"></textarea>
            <button class="eng-csend">Publicar</button>
          </div>` : `<p class="eng-login-note">
            <a href="cuenta.html?redirect=${encodeURIComponent(location.pathname + location.search)}">Inicia sesión</a> para comentar, dar like y guardar favoritos.</p>`}
        <div class="eng-clist"><p class="eng-empty">Cargando…</p></div>
      </div>`;

    const listEl = commentsHost.querySelector(".eng-clist");
    if (user) {
      const input = commentsHost.querySelector(".eng-ctext-input");
      const send = commentsHost.querySelector(".eng-csend");
      const publish = async () => {
        const text = input.value.trim();
        if (!text) return;
        send.disabled = true;
        try {
          await addDoc(collection(db, "comments"), {
            episodeId: epId, animeId: anime.id,
            uid: user.uid, userName: user.displayName || user.email.split("@")[0],
            userPhoto: user.photoURL || "",
            text, createdAt: serverTimestamp(),
          });
          input.value = "";
        } catch (err) { console.error(err); alert("No se pudo publicar el comentario."); }
        finally { send.disabled = false; }
      };
      send.addEventListener("click", publish);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) publish(); });
    }

    try {
      const q = query(collection(db, "comments"), where("episodeId", "==", epId));
      commentsUnsub = onSnapshot(q, (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderComments(items, listEl, user);
      }, (err) => { console.warn("comments", err); listEl.innerHTML = '<p class="eng-empty">No se pudieron cargar los comentarios.</p>'; });
    } catch (e) { console.error(e); }
  }
}
