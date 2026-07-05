// ============================================================================
//  AUTENTICACIÓN  —  All-Anime
//  Registro, inicio de sesión, cierre de sesión y estado del usuario.
// ============================================================================

import { auth, db, isAdmin, ADMIN_EMAIL } from "./firebase-config.js";
import { defaultAvatar } from "./avatars.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export { isAdmin, ADMIN_EMAIL, auth };

// Traduce los códigos de error de Firebase a mensajes en español.
export function authErrorMessage(code) {
  const map = {
    "auth/invalid-email": "El correo no es válido.",
    "auth/email-already-in-use": "Ese correo ya está registrado.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
    "auth/network-request-failed": "Error de red. Revisa tu conexión.",
    "auth/missing-password": "Escribe tu contraseña.",
  };
  return map[code] || "Ocurrió un error. Inténtalo de nuevo.";
}

// Crea o actualiza el documento de perfil del usuario en Firestore.
async function ensureUserDoc(user, displayName) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const base = {
    email: user.email,
    displayName: displayName || user.displayName || user.email.split("@")[0],
    photoURL: user.photoURL || "",
    role: isAdmin(user) ? "admin" : "user",
    updatedAt: serverTimestamp(),
  };
  if (!snap.exists()) {
    await setDoc(ref, { ...base, createdAt: serverTimestamp() });
  } else {
    await setDoc(ref, base, { merge: true });
  }
}

// Registra un nuevo usuario.
export async function registerUser({ email, password, displayName }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = (displayName || email.split("@")[0]).trim();
  const photoURL = defaultAvatar(name);
  await updateProfile(cred.user, { displayName: name, photoURL });
  await ensureUserDoc(cred.user, name);
  // Envía el correo de verificación (no bloquea el registro si falla).
  try { await sendEmailVerification(cred.user); } catch (e) { console.warn("verify email", e); }
  return cred.user;
}

// Reenvía el correo de verificación al usuario actual.
export async function resendVerification() {
  if (!auth.currentUser) throw new Error("No hay sesión.");
  await sendEmailVerification(auth.currentUser);
}

// Recarga el usuario desde el servidor (para detectar si ya verificó su correo).
export async function reloadUser() {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}

// Envía un correo para restablecer la contraseña.
export async function sendReset(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

// Cambia la contraseña del usuario actual (re-autentica con la actual).
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay sesión.");
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred); // valida la contraseña actual
  await updatePassword(user, newPassword);
}

// Actualiza el perfil (nombre y/o avatar) en Auth y en Firestore.
export async function updateUserProfile({ displayName, photoURL }) {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay sesión.");
  const patch = {};
  if (typeof displayName === "string") patch.displayName = displayName.trim();
  if (typeof photoURL === "string") patch.photoURL = photoURL;
  await updateProfile(user, patch);
  await setDoc(doc(db, "users", user.uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  return user;
}

// Inicia sesión.
export async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserDoc(cred.user);
  return cred.user;
}

// Cierra sesión.
export async function logoutUser() {
  await signOut(auth);
}

// Observa el estado de autenticación. Llama a cb(user|null) en cada cambio.
export function observeAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// Devuelve una promesa que resuelve con el usuario actual (o null) una vez.
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// Lee el perfil (documento users/{uid}) de Firestore.
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}
