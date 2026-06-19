import admin from './firebase/admin.js';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

const db = getFirestore();
const docsSnap = await db.collection('documents').get();
docsSnap.forEach(doc => {
  const data = doc.data();
  console.log(`ID: ${doc.id}`);
  console.log(`Title: ${data.title}`);
  console.log(`Content: ${data.content}`);
  console.log(`yjsState exists: ${!!data.yjsState}`);
  console.log('====================================');
});
process.exit(0);
