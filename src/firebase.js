import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDVc9nfKRnzf9mvTFDT0X6EAAf0bpmm-W8",
  authDomain: "tas-paratha-crm.firebaseapp.com",
  databaseURL: "https://tas-paratha-crm-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tas-paratha-crm",
  storageBucket: "tas-paratha-crm.firebasestorage.app",
  messagingSenderId: "1049582815053",
  appId: "1:1049582815053:web:d9be420b0da063369d9904",
  measurementId: "G-MCSQBR4048"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
