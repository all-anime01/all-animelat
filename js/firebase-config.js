// ============================================================================
//  CONFIGURACIÓN DE FIREBASE  —  All-Anime
// ----------------------------------------------------------------------------
//  1. Entra a https://console.firebase.google.com y crea un proyecto.
//  2. Agrega una app Web (</>) y copia el objeto `firebaseConfig`.
//  3. Pega tus valores reales abajo (reemplaza los "TU_...").
//  4. En la consola activa:  Authentication → Sign-in method → Email/Password
//     y  Firestore Database → Crear base de datos (modo producción).
//  5. Publica las reglas del archivo  firestore.rules  (ver FIREBASE-SETUP.md).
//
//  NOTA: estas claves son públicas por diseño (van al navegador). La seguridad
//  real la dan las reglas de Firestore, no el ocultar la apiKey.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔴 REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO FIREBASE 🔴
const firebaseConfig = {
  apiKey: "AIzaSyDJMJcwFvQCAfp9mXcCvxCQpX-6wy-a4FA",
  authDomain: "all-anime-eae5b.firebaseapp.com",
  projectId: "all-anime-eae5b",
  storageBucket: "all-anime-eae5b.firebasestorage.app",
  messagingSenderId: "936531539241",
  appId: "1:936531539241:web:cc8ebe2ebe7e3e928db338",
};

// Correo que tendrá acceso al panel de administración.
export const ADMIN_EMAIL = "all.anime.lat01@gmail.com";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

// Devuelve true si el usuario dado es el administrador.
export function isAdmin(user) {
  return !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Ayuda a detectar si todavía no se han puesto las claves reales.
export const FIREBASE_CONFIGURED = !firebaseConfig.apiKey.startsWith("TU_");
