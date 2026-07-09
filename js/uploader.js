// ============================================================================
//  SUBIDA A SERVIDORES DE VIDEO  —  All-Anime (panel admin)
//  Sube archivos de episodios a Filemoon / Vidara / Streamwish por API, crea
//  carpetas para mantener el orden (Anime/Temporada) y devuelve el "filecode"
//  para adjuntar el embed al episodio. Las claves se leen de Firestore
//  (config/uploaders, solo admin) para no exponerlas en el JS público.
// ============================================================================

import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Adaptadores por host (clones de XFileSharing con pequeñas diferencias).
export const HOSTS = {
  filemoon: {
    label: "Filemoon", api: "https://api.byse.sx", keyParam: "key",
    infoPath: "/account/info", embed: (c) => `https://filemoon.sx/e/${c}`,
    clientSide: true, // CORS OK: sube desde el navegador
  },
  vidara: {
    label: "Vidara", api: "https://api.vidara.so/v1", keyParam: "api_key",
    infoPath: "/user/info", embed: (c) => `https://vidara.to/e/${c}`,
    clientSide: false, // CORS bloqueado: requiere backend (pendiente)
    note: "Requiere backend (CORS). Pendiente.",
  },
  streamwish: {
    label: "Streamwish", api: "https://streamhgapi.com/api", keyParam: "key",
    infoPath: "/account/info", embed: (c) => `https://streamhg.com/e/${c}`,
    clientSide: true,
    note: "Falta la API key real.",
  },
};

// ---- Claves (Firestore, solo admin) ----------------------------------------
export async function loadKeys() {
  try { const s = await getDoc(doc(db, "admin_secrets", "uploaders")); return s.exists() ? (s.data().keys || {}) : {}; }
  catch (e) { return {}; }
}
export async function saveKeys(keys) {
  await setDoc(doc(db, "admin_secrets", "uploaders"), { keys, updatedAt: serverTimestamp() }, { merge: true });
}

// ---- Llamadas genéricas ----------------------------------------------------
async function apiGet(host, path, params) {
  const h = HOSTS[host];
  const u = new URL(h.api + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString());
  return r.json();
}

export async function accountInfo(host, key) {
  const h = HOSTS[host];
  return apiGet(host, h.infoPath, { [h.keyParam]: key });
}

// ---- Carpetas --------------------------------------------------------------
export async function listFolders(host, key, fldId = 0) {
  const h = HOSTS[host];
  const j = await apiGet(host, "/folder/list", { [h.keyParam]: key, fld_id: fldId });
  return (j.result && j.result.folders) || [];
}
export async function createFolder(host, key, name, parentId = 0) {
  const h = HOSTS[host];
  const j = await apiGet(host, "/folder/create", { [h.keyParam]: key, name, parent_id: parentId });
  const r = j.result;
  return r && (r.fld_id || r.id || r);
}
// Busca por nombre (bajo parentId) o la crea. Devuelve fld_id.
export async function ensureFolder(host, key, name, parentId = 0) {
  const folders = await listFolders(host, key, parentId);
  const found = folders.find((f) => String(f.name).trim().toLowerCase() === String(name).trim().toLowerCase());
  if (found) return found.fld_id;
  return createFolder(host, key, name, parentId);
}
// Crea/obtiene la ruta Anime/Temporada. Devuelve el fld_id de la temporada.
export async function ensureAnimeSeasonFolder(host, key, anime, season) {
  const animeId = await ensureFolder(host, key, anime, 0);
  return ensureFolder(host, key, season, animeId);
}

// ---- Subida ----------------------------------------------------------------
export async function getUploadServer(host, key) {
  const h = HOSTS[host];
  const j = await apiGet(host, "/upload/server", { [h.keyParam]: key });
  return j.result;
}

// Sube un archivo con progreso (XHR). Resuelve al filecode.
export function uploadFile(host, key, serverUrl, file, fldId, onProgress) {
  return new Promise((resolve, reject) => {
    const h = HOSTS[host];
    const fd = new FormData();
    fd.append(h.keyParam, key);
    if (fldId) fd.append("fld_id", fldId);
    fd.append("file", file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", serverUrl, true);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        const f = j.files && j.files[0];
        if (f && f.filecode) resolve(f.filecode);
        else reject(new Error((f && f.status) || j.msg || "No se recibió filecode"));
      } catch (e) { reject(new Error("Respuesta no válida del servidor")); }
    };
    xhr.onerror = () => reject(new Error("Error de red o CORS"));
    xhr.send(fd);
  });
}

export const embedUrl = (host, code) => HOSTS[host].embed(code);

// Extrae el número de episodio del nombre de archivo ("08.mp4", "cap 8.mkv"…).
export function episodeNumberFromName(name) {
  const base = String(name).replace(/\.[a-z0-9]+$/i, "");
  const m = base.match(/(\d{1,4})\s*$/) || base.match(/(\d{1,4})/);
  return m ? parseInt(m[1], 10) : null;
}
