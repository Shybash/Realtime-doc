import admin from './firebase/admin.js';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

const db = getFirestore();
const docsSnap = await db.collection('documents').get();
docsSnap.forEach(doc => {
  console.log(`Doc ID: ${doc.id}`);
  const data = doc.data();
  console.log({
    title: data.title,
    contentLength: data.content?.length || 0,
    hasYjsState: !!data.yjsState,
    yjsLength: data.yjsState?.length || 0,
    updatedAt: data.updatedAt
  });
  console.log('-------------------');
});
process.exit(0);
