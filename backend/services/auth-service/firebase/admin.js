import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || "";
const formattedPrivateKey = rawPrivateKey
  .replace(/^["']|["']$/g, "") // Remove surrounding quotes
  .replace(/\\n/g, "\n");     // Replace escaped newlines

console.log("[DEBUG] Raw private key length:", rawPrivateKey.length);
console.log("[DEBUG] Raw private key starts with:", JSON.stringify(rawPrivateKey.substring(0, 40)));
console.log("[DEBUG] Raw private key ends with:", JSON.stringify(rawPrivateKey.substring(rawPrivateKey.length - 40)));
console.log("[DEBUG] Formatted private key length:", formattedPrivateKey.length);
console.log("[DEBUG] Formatted private key starts with:", JSON.stringify(formattedPrivateKey.substring(0, 40)));
console.log("[DEBUG] Formatted private key ends with:", JSON.stringify(formattedPrivateKey.substring(formattedPrivateKey.length - 40)));

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: formattedPrivateKey,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
