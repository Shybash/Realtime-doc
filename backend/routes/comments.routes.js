import express from 'express';
import { addComment, getComments, updateComment, deleteComment } from '../controllers/commentController.js';
import auth from '../middlewares/auth.js';
import { getFirestore } from 'firebase-admin/firestore';
import { hasDocumentRole } from '../utils/permissions.js';

const router = express.Router();

// Middleware: check the user has at least a given role on the document (using :docId param)
function requireCommentRole(allowedRoles) {
  return async (req, res, next) => {
    const userId = req.user?.uid;
    const docId = req.params.docId;
    if (!userId || !docId) return res.status(400).json({ error: 'Missing user or document ID' });

    const db = getFirestore();
    const docSnap = await db.collection('documents').doc(docId).get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Document not found' });

    const doc = docSnap.data();
    if (!hasDocumentRole(doc, userId, allowedRoles)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    req.document = doc;
    next();
  };
}

// All roles can read and add comments; only admin/editor can update/delete
router.post('/docs/:docId/comments',  auth, requireCommentRole(['admin', 'editor', 'commenter', 'viewer']), addComment);
router.get('/docs/:docId/comments',   auth, requireCommentRole(['admin', 'editor', 'commenter', 'viewer']), getComments);
router.patch('/docs/:docId/comments/:commentId',  auth, requireCommentRole(['admin', 'editor']), updateComment);
router.delete('/docs/:docId/comments/:commentId', auth, requireCommentRole(['admin', 'editor']), deleteComment);

export default router;