import admin from './firebase/admin.js';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

const db = getFirestore();

async function runTest() {
  const docRef = await db.collection('documents').add({
    title: 'Test Document Title',
    content: 'Initial Content',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docId = docRef.id;
  console.log(`Created document with ID: ${docId}`);

  // Simulate PUT /docs/:id with only content
  const updateData = {
    content: '<p>Updated Content from editor</p>',
    updatedAt: new Date()
  };

  await docRef.update(updateData);
  console.log('Updated document with content...');

  const finalDoc = await docRef.get();
  console.log('Result in database:');
  console.log(finalDoc.data());

  // Clean up
  await docRef.delete();
  console.log('Cleaned up test document.');
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
