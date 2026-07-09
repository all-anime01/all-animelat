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
// Obtiene la ruta Anime/Temporada REUTILIZANDO las carpetas que ya existen en
// el servidor (match flexible: "Blue lock", "T2"…). Solo crea si no existen, y
// la temporada la crea con la convención corta "T{n}".
export async function ensureAnimeSeasonFolder(host, key, anime, season) {
  let animeId = await findFolder(host, key, anime, 0);
  if (!animeId) animeId = await createFolder(host, key, anime, 0);
  let seasonId = await findSeasonFolder(host, key, season, animeId);
  if (!seasonId) {
    const n = (String(season).match(/\d+/) || [""])[0];
    seasonId = await createFolder(host, key, n ? "T" + n : season, animeId);
  }
  return seasonId;
}

// Busca una carpeta por nombre bajo parentId (sin crearla). Devuelve fld_id o null.
export async function findFolder(host, key, name, parentId = 0) {
  const folders = await listFolders(host, key, parentId);
  const f = folders.find((x) => String(x.name).trim().toLowerCase() === String(name).trim().toLowerCase());
  return f ? f.fld_id : null;
}
// Lista TODOS los archivos de una carpeta (con paginación).
export async function listFiles(host, key, fldId) {
  const h = HOSTS[host];
  let page = 1, all = [];
  for (let guard = 0; guard < 60; guard++) {
    const j = await apiGet(host, "/file/list", { [h.keyParam]: key, fld_id: fldId, per_page: 100, page });
    const files = (j.result && j.result.files) || [];
    all.push(...files);
    const pages = (j.result && j.result.pages) || 1;
    if (page >= pages || !files.length) break;
    page++;
  }
  return all;
}
export const fileCode = (f) => f.file_code || f.filecode || f.code || "";
export const fileTitle = (f) => f.title || f.name || (f.link ? String(f.link).split("/").pop() : "");

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

// Extrae el número de episodio de un nombre de archivo, tolerando nombres
// sucios ("[locuranime]1080p BlLo-38", "... U-20 Japan - 14 [1080p][A1B2]").
export function episodeNumberFromName(name) {
  let s = String(name).replace(/\.[a-z0-9]{2,4}$/i, "");   // extensión
  s = s.replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " "); // [tags] (…)
  s = s.replace(/\b\d{3,4}p\b/gi, " ");                     // 1080p / 720p
  s = s.replace(/\b(x?26[45]|hevc|hdrip|web[- ]?dl|bluray|dual|latino|sub|cast)\b/gi, " ");
  // Preferimos la ÚLTIMA marca de episodio ("- 14", "cap 14", "ep 14", "e14").
  const marks = [...s.matchAll(/(?:-|–|cap(?:[ií]tulo)?|ep(?:isodio)?|\be)\s*0*(\d{1,4})(?!\s*\d)/ig)];
  if (marks.length) return parseInt(marks[marks.length - 1][1], 10);
  // Si no, el último número suelto del nombre.
  const nums = [...s.matchAll(/\b0*(\d{1,4})\b/g)];
  return nums.length ? parseInt(nums[nums.length - 1][1], 10) : null;
}

// Encuentra la carpeta de temporada tolerando distintos nombres:
// "Temporada 2" ↔ "T2" ↔ "Season 2" ↔ "S2" ↔ "2".
export async function findSeasonFolder(host, key, seasonName, parentId = 0) {
  const folders = await listFolders(host, key, parentId);
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = (String(seasonName).match(/\d+/) || [])[0];
  const cands = new Set([norm(seasonName)]);
  if (n) ["t" + n, "temporada" + n, "season" + n, "s" + n, n].forEach((c) => cands.add(c));
  const f = folders.find((x) => cands.has(norm(x.name)));
  return f ? f.fld_id : null;
}
