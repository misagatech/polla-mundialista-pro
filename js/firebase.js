import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_MLFy3prhsg3N2T-FTObrFoaQS_K8yuI",
  authDomain: "polla-mundialista-pro.firebaseapp.com",
  projectId: "polla-mundialista-pro",
  storageBucket: "polla-mundialista-pro.firebasestorage.app",
  messagingSenderId: "568974218746",
  appId: "1:568974218746:web:4542ace54c5c7d407c4043"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
