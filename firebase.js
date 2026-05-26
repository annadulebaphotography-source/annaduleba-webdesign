import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAxTjpuMQPHrHViLPSreaeC1tLJUWtksGU",
  authDomain: "annaduleba-webdesign.firebaseapp.com",
  projectId: "annaduleba-webdesign",
  storageBucket: "annaduleba-webdesign.firebasestorage.app",
  messagingSenderId: "892049973375",
  appId: "1:892049973375:web:a009d9cafda6f554ea5f4a"
};

export const app = initializeApp(firebaseConfig);
export const firebaseProjectId = firebaseConfig.projectId;
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});
export const provider = new GoogleAuthProvider();
export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
};

window.loginGoogle = async function () {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.loginEmail = async function (email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.logoutGoogle = async function () {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
