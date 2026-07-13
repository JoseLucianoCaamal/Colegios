// Importa las funciones necesarias desde la CDN de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- AQUÍ PEGA TUS DATOS DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAMR28OTi03GHAHfWwfFLbFyINws8g2w4o",
  authDomain: "colegio-628e8.firebaseapp.com",
  projectId: "colegio-628e8",
  storageBucket: "colegio-628e8.firebasestorage.app",
  messagingSenderId: "1096134242158",
  appId: "1:1096134242158:web:96926de177dabba24c1b7f"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios para usarlos en login.html o fotos.html
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { auth, db, storage };