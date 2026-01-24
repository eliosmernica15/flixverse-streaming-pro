import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDeTRgxgxfrL6eOVrWdvsJ-7K7PNUN_kGM",
  authDomain: "streaming-web-2272d.firebaseapp.com",
  projectId: "streaming-web-2272d",
  storageBucket: "streaming-web-2272d.firebasestorage.app",
  messagingSenderId: "1029083315701",
  appId: "1:1029083315701:web:9b04a22ee685eabe07b4bc"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
