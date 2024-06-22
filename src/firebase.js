// firebase.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA8KxZlAYOUDf2wT8sIsUjCUmYbaNR0tyQ",
  authDomain: "chatroom-6b928.firebaseapp.com",
  projectId: "chatroom-6b928",
  storageBucket: "chatroom-6b928.appspot.com",
  messagingSenderId: "709627572679",
  appId: "1:709627572679:web:348575b839909fc80f29e2",
  measurementId: "G-QP66H024GT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
