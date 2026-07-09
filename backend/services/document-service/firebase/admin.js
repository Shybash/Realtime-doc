import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || "";
const formattedPrivateKey = rawPrivateKey
  .replace(/^["']|["']$/g, "") // Remove surrounding quotes
  .replace(/\\n/g, "\n");     // Replace escaped newlines

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: formattedPrivateKey,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
