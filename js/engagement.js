// ============================================================================
//  ENGAGEMENT POR EPISODIO  —  All-Anime
//  Likes, comentarios (Firestore), marcar "visto", siguiente episodio + autoplay.
//  Se monta dentro del modal del reproductor de anime-details.html.
// ============================================================================

import { db, isAdmin, FIREBASE_CONFIGURED } from "./firebase-config.js";
import { observeAuth } from "./auth.js";
import { episodeId as makeEpId } from "./catalog-utils.js";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, collection, query, where,
  onSnapshot, serverTimestamp, runTransaction, writeBatch,
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
      // Si cambia la sesión con el modal abierto, re-monta lo actual.
      else if (activeCtx) initPlayerEngagement(activeCtx);
    });
  } catch (e) { console.warn("[engagement] auth no disponible", e); resolve(null); }
});

let activeCtx = null;       // contexto del episodio abierto
let commentsUnsub = null;   // listener de comentarios en vivo
let autoplayTimer = null;
let countdownTimer = null;

// ---- Estilos (se inyectan una sola vez) ------------------------------------
function injectStyles() {
  if (document.getElementById("engagement-styles")) return;
  const css = `
  .eng-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:14px 0}
  .eng-btn{display:inline-flex;align-items:center;gap:7px;background:#2a2a2a;color:#f0f0f0;border:1px solid #3a3a3a;padding:9px 15px;border-radius:9px;cursor:pointer;font-size:14px;font-family:inherit;transition:.15s}
  .eng-btn:hover{border-color:#ca3030}
  .eng-btn.active{background:#ca3030;border-color:#ca3030;color:#fff}
  .eng-dislike.active{background:#3a3f47;border-color:#3a3f47;color:#fff}
  .eng-btn:disabled{opacity:.5;cursor:not-allowed}
  .eng-next{background:#ca3030;border-color:#ca3030;color:#fff;font-weight:700;margin-left:auto}
  .eng-autoplay{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#a0a0a0;cursor:pointer;user-select:none}
  .eng-autoplay input{accent-color:#ca3030;width:16px;height:16px}
  .eng-login-note{font-size:13px;color:#a0a0a0;margin:8px 0}
  .eng-login-note a{color:#ff6b6b}
  .eng-comments{margin-top:22px;border-top:1px solid #303030;padding-top:18px}
  .eng-comments h4{font-size:16px;margin-bottom:14px}
  .eng-cform{display:flex;gap:10px;margin-bottom:18px}
  .eng-cform textarea{flex:1;min-height:44px;max-height:160px;background:#161616;border:1px solid #303030;border-radius:10px;color:#f0f0f0;padding:11px 13px;font-family:inherit;font-size:14px;resize:vertical}
  .eng-cform button{align-self:flex-end;background:#ca3030;color:#fff;border:none;border-radius:10px;padding:11px 18px;font-weight:700;cursor:pointer}
  .eng-comment{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #242424}
  .eng-avatar{flex:none;width:38px;height:38px;border-radius:50%;background:#ca3030;display:flex;align-items:center;justify-content:center;font-weight:700;text-transform:uppercase}
  .eng-cbody{flex:1;min-width:0}
  .eng-cmeta{font-size:12px;color:#888;margin-bottom:3px}
  .eng-cmeta b{color:#f0f0f0;font-size:13px}
  .eng-ctext{font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
  .eng-cdel{background:none;border:none;color:#777;cursor:pointer;font-size:12px;margin-left:8px}
  .eng-cdel:hover{color:#ff5c5c}
  .eng-empty{color:#888;font-size:14px;padding:8px 0}
  .eng-countdown{position:absolute;inset:0;background:rgba(0,0,0,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:50;text-align:center;color:#fff;gap:14px}
  .eng-countdown h3{font-size:20px}.eng-countdown .num{font-size:46px;font-weight:800;color:#ca3030}
  .eng-countdown .cd-actions{display:flex;gap:10px}
  .eng-countdown button{padding:10px 18px;border-radius:9px;border:none;cursor:pointer;font-weight:700}
  .eng-countdown .cd-go{background:#ca3030;color:#fff}.eng-countdown .cd-cancel{background:#333;color:#fff}
  .episode-detail-card.is-watched .episode-img-container::after{content:"\\2713 VISTO";font-weight:700;position:absolute;top:8px;left:8px;background:rgba(0,170,80,.92);color:#fff;font-size:11px;padding:3px 7px;border-radius:6px;z-index:3;letter-spacing:.5px}
  `;
  const s = document.createElement("style");
  s.id = "engagement-styles";
  s.textContent = css;
  document.head.appendChild(s);
}

const initial = (name) => (name || "?").trim().charAt(0) || "?";
const durationToMs = (d) => (parseInt(String(d).match(/\d+/)?.[0] || "24", 10)) * 60000;

// ---- Autoplay ---------------------------------------------------------------
export function autoplayEnabled() {
  return localStorage.getItem("autoplayNext") === "1";
}
function setAutoplay(on) {
  localStorage.setItem("autoplayNext", on ? "1" : "0");
}
export function clearAutoplay() {
  clearTimeout(autoplayTimer); autoplayTimer = null;
  clearInterval(countdownTimer); countdownTimer = null;
  document.querySelector(".eng-countdown")?.remove();
}
function scheduleAutoplay(episode, nextEpisode, onPlayNext) {
  clearAutoplay();
  if (!nextEpisode || !autoplayEnabled()) return;
  // No podemos detectar el fin del video (reproductores externos cross-origin),
  // así que programamos según la duración nominal del episodio.
  autoplayTimer = setTimeout(() => startCountdown(onPlayNext), durationToMs(episode));
}
function startCountdown(onPlayNext) {
  const container = document.querySelector(".player-video-container");
  if (!container || !onPlayNext) return;
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  let n = 12;
  const box = document.createElement("div");
  box.className = "eng-countdown";
  box.innerHTML = `<h3>Siguiente episodio en</h3><div class="num">${n}</div>
    <div class="cd-actions"><button class="cd-go">Ver ahora</button><button class="cd-cancel">Cancelar</button></div>`;
  container.appendChild(box);
  const go = () => { clearAutoplay(); onPlayNext(); };
  box.querySelector(".cd-go").onclick = go;
  box.querySelector(".cd-cancel").onclick = () => clearAutoplay();
  countdownTimer = setInterval(() => {
    n -= 1;
    box.querySelector(".num").textContent = n;
    if (n <= 0) go();
  }, 1000);
}

// ---- Likes ------------------------------------------------------------------
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
// type: 'like' | 'dislike'. Devuelve la reacción resultante (o null).
async function setReaction(epId, anime, user, type) {
  const statRef = doc(db, "episodeStats", epId);
  const rRef = doc(db, "users", user.uid, "reactions", epId);
  let result = null;
  await runTransaction(db, async (tx) => {
    const [sSnap, rSnap] = [await tx.get(statRef), await tx.get(rRef)];
    const s = sSnap.exists() ? sSnap.data() : {};
    let like = s.likeCount || 0, dis = s.dislikeCount || 0;
    const cur = rSnap.exists() ? rSnap.data().type : null;
    if (cur === type) {                       // clic en la misma → quitar
      if (type === "like") like--; else dis--;
      tx.delete(rRef);
      result = null;
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
    animeId: anime.id, animeTitle: anime.title,
    season: episode.season, number: episode.number, at: serverTimestamp(),
  }, { merge: true });
}
async function isWatched(epId, user) {
  return (await getDoc(watchedRef(user, epId))).exists();
}

/** Conjunto de epIds vistos por el usuario para un anime (para badges en la lista). */
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
    return `<div class="eng-comment">
      <div class="eng-avatar">${initial(name)}</div>
      <div class="eng-cbody">
        <div class="eng-cmeta"><b>${escapeHtml(name)}</b> · ${when}
          ${canDel ? `<button class="eng-cdel" data-id="${c.id}"><i class="fas fa-trash"></i></button>` : ""}</div>
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
  scheduleAutoplay(episode, nextEpisode, onPlayNext);

  await userReady;          // espera a que se determine el estado inicial
  const user = currentUser; // valor vivo (puede haber cambiado tras login)

  // ---- Barra de acciones ----
  if (actionsEl) {
    const { likeCount, dislikeCount, mine } = await readReactionState(epId, user).catch(() => ({ likeCount: 0, dislikeCount: 0, mine: null }));
    const watched = user ? await isWatched(epId, user).catch(() => false) : false;
    actionsEl.innerHTML = `
      <button class="eng-btn eng-like ${mine === "like" ? "active" : ""}" ${user ? "" : "disabled"} title="Me gusta">
        <i class="fas fa-thumbs-up"></i> <span class="eng-like-count">${likeCount}</span>
      </button>
      <button class="eng-btn eng-dislike ${mine === "dislike" ? "active" : ""}" ${user ? "" : "disabled"} title="No me gusta">
        <i class="fas fa-thumbs-down"></i> <span class="eng-dislike-count">${dislikeCount}</span>
      </button>
      <button class="eng-btn eng-watched ${watched ? "active" : ""}" ${user ? "" : "disabled"} title="Marcar como visto">
        <i class="fas fa-check"></i> ${watched ? "Visto" : "Marcar visto"}
      </button>
      <label class="eng-autoplay"><input type="checkbox" class="eng-ap" ${autoplayEnabled() ? "checked" : ""}> Autoplay siguiente</label>
      <button class="eng-btn eng-next" ${nextEpisode ? "" : "disabled"}>Siguiente <i class="fas fa-forward"></i></button>
    `;

    // Like / Dislike
    const likeBtn = actionsEl.querySelector(".eng-like");
    const disBtn = actionsEl.querySelector(".eng-dislike");
    const likeC = likeBtn.querySelector(".eng-like-count");
    const disC = disBtn.querySelector(".eng-dislike-count");
    async function react(type) {
      if (!user) return;
      likeBtn.disabled = disBtn.disabled = true;
      try {
        const res = await setReaction(epId, anime, user, type);
        likeBtn.classList.toggle("active", res === "like");
        disBtn.classList.toggle("active", res === "dislike");
        const st = await readReactionState(epId, user);
        likeC.textContent = st.likeCount;
        disC.textContent = st.dislikeCount;
      } catch (err) { console.error(err); } finally { likeBtn.disabled = disBtn.disabled = false; }
    }
    likeBtn.addEventListener("click", () => react("like"));
    disBtn.addEventListener("click", () => react("dislike"));

    // Visto (manual)
    actionsEl.querySelector(".eng-watched").addEventListener("click", async (e) => {
      if (!user) return;
      const btn = e.currentTarget;
      try {
        const already = btn.classList.contains("active");
        if (already) { await deleteDoc(watchedRef(user, epId)); btn.classList.remove("active"); btn.innerHTML = '<i class="fas fa-check"></i> Marcar visto'; }
        else { await markWatched(epId, anime, episode, user); btn.classList.add("active"); btn.innerHTML = '<i class="fas fa-check"></i> Visto'; }
      } catch (err) { console.error(err); }
    });

    // Autoplay toggle
    actionsEl.querySelector(".eng-ap").addEventListener("change", (e) => {
      setAutoplay(e.target.checked);
      if (e.target.checked) scheduleAutoplay(episode, nextEpisode, onPlayNext);
      else clearAutoplay();
    });

    // Siguiente
    actionsEl.querySelector(".eng-next").addEventListener("click", () => {
      if (nextEpisode && onPlayNext) { clearAutoplay(); onPlayNext(); }
    });
  }

  // ---- Marca automática de visto al abrir (si hay sesión) ----
  if (user) markWatched(epId, anime, episode, user).catch(() => {});

  // ---- Comentarios ----
  if (commentsHost) {
    commentsHost.innerHTML = `
      <div class="eng-comments">
        <h4><i class="fas fa-comments"></i> Comentarios</h4>
        ${user ? `<div class="eng-cform">
            <textarea class="eng-ctext-input" maxlength="1000" placeholder="Escribe un comentario…"></textarea>
            <button class="eng-csend">Publicar</button>
          </div>` : `<p class="eng-login-note">
            <a href="cuenta.html?redirect=${encodeURIComponent(location.pathname + location.search)}">Inicia sesión</a> para comentar y dar like.</p>`}
        <div class="eng-clist"><p class="eng-empty">Cargando…</p></div>
      </div>`;

    const listEl = commentsHost.querySelector(".eng-clist");
    if (user) {
      const input = commentsHost.querySelector(".eng-ctext-input");
      const send = commentsHost.querySelector(".eng-csend");
      send.addEventListener("click", async () => {
        const text = input.value.trim();
        if (!text) return;
        send.disabled = true;
        try {
          await addDoc(collection(db, "comments"), {
            episodeId: epId, animeId: anime.id,
            uid: user.uid, userName: user.displayName || user.email.split("@")[0],
            text, createdAt: serverTimestamp(),
          });
          input.value = "";
        } catch (err) { console.error(err); alert("No se pudo publicar el comentario."); }
        finally { send.disabled = false; }
      });
    }

    // Listener en vivo (equality-only → no requiere índice compuesto).
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
