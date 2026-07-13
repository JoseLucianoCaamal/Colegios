// Importa las funciones necesarias desde la CDN de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- TUS DATOS DE FIREBASE ---
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

// Inicializar los servicios
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Exportar todo en una sola línea al final (sin duplicados)
export { auth, db, storage };