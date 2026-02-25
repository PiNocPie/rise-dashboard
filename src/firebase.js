import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAZV4wUlTGelue7TC7_1EbxyjWuv2wfkX4",
  authDomain: "rise-dashboard-bdf88.firebaseapp.com",
  projectId: "rise-dashboard-bdf88",
  storageBucket: "rise-dashboard-bdf88.firebasestorage.app",
  messagingSenderId: "28108311334",
  appId: "1:28108311334:web:4622949fc0a103093c8fe7",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
