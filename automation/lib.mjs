// Librería de automatización: Firestore REST + Auth + helpers TMDB.
// Las credenciales se leen de VARIABLES DE ENTORNO (GitHub Secrets), nunca se
// escriben en el repo. Requiere: FB_API_KEY, FB_ADMIN_EMAIL, FB_ADMIN_PASSWORD.
const P = process.env.FB_PROJECT || "all-anime-eae5b";
const API_KEY = process.env.FB_API_KEY;
const ADMIN = { email: process.env.FB_ADMIN_EMAIL, password: process.env.FB_ADMIN_PASSWORD };
const BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
export const UA = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36", "Accept-Language": "es-ES,es;q=0.9" } };

export function requireEnv() {
  const miss = ["FB_API_KEY", "FB_ADMIN_EMAIL", "FB_ADMIN_PASSWORD"].filter((k) => !process.env[k]);
  if (miss.length) throw new Error("Faltan variables de entorno (GitHub Secrets): " + miss.join(", "));
}
export async function signIn() {
  requireEnv();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...ADMIN, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error("signIn falló: " + JSON.stringify(j).slice(0, 150));
  return j.idToken;
}
export function fv(v) {
  if (v == null) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(fv);
  if (v.mapValue !== undefined) { const o = {}, f = v.mapValue.fields || {}; for (const k in f) o[k] = fv(f[k]); return o; }
  return undefined;
}
export function toFS(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFS) } };
  if (typeof val === "object") { const f = {}; for (const k in val) if (val[k] !== undefined) f[k] = toFS(val[k]); return { mapValue: { fields: f } }; }
  return { nullValue: null };
}
export async function getDocRaw(path) { const r = await fetch(`${BASE}/${path}`); if (!r.ok) return null; const j = await r.json(); return j.fields ? j : null; }
export async function getAnime(id) { const j = await getDocRaw(`animes/${id}`); if (!j) return null; const o = {}; for (const k in j.fields) o[k] = fv(j.fields[k]); return o; }
export async function getCatalog() { const j = await getDocRaw("catalog/index"); return j ? (fv(j.fields.items) || []) : []; }
export async function patchFields(path, fieldsObj, token) {
  const mask = Object.keys(fieldsObj).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const body = { fields: {} };
  for (const k in fieldsObj) body.fields[k] = toFS(fieldsObj[k]);
  const r = await fetch(`${BASE}/${path}?${mask}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PATCH ${path} -> ${r.status} ${(await r.text()).slice(0, 160)}`);
  return true;
}
export async function bumpCatalogVersion(token) { await patchFields("meta/catalog", { version: Date.now() }, token); }
export async function get(u) { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, UA); if (r.ok) return await r.text(); } catch {} await new Promise((r) => setTimeout(r, 600)); } return ""; }
