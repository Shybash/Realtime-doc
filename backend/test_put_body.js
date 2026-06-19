import admin from './firebase/admin.js';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

const db = getFirestore();

async function run() {
  const docRef = await db.collection('documents').add({
    title: 'Original Title',
    content: 'Original Content',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('Created doc:', docRef.id);

  // Simulating PUT /docs/:id route logic
  const reqBody = { content: '<p>New Content</p>' };
  const { title, userId, content, parentId, coverImage, icon } = reqBody;

  const updateData = {
    updatedAt: new Date()
  };
  if (title !== undefined) updateData.title = title;
  if (userId) updateData.userId = userId;
  if (content !== undefined) updateData.content = content;

  await docRef.update(updateData);

  const updatedDoc = await docRef.get();
  console.log('Updated data:', updatedDoc.data());

  await docRef.delete();
}

run().then(() => process.exit(0)).catch(console.error);
