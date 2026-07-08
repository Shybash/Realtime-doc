import admin from "../firebase/admin.js";
import sanitizeHtml from "sanitize-html";
import eventBus from "../utils/eventBus.js";
const db = admin.firestore();

export const addComment = async (req, res) => {
  try {
    const { docId } = req.params;
    const { anchor, content, parentId } = req.body;
    const userId = req.user.uid;

    const comment = {
      userId,
      anchor: anchor ? sanitizeHtml(JSON.stringify(anchor)) : null,
      content: sanitizeHtml(content),
      parentId: parentId ? sanitizeHtml(parentId) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("documents").doc(docId).collection("comments").add(comment);
    eventBus.publish("comment.created", { docId, commentId: ref.id, userId, content: comment.content });
    const newComment = await ref.get();
    
    // Broadcast event to WebSocket room
    const io = req.app.get("io");
    if (io) {
      io.to(`document-${docId}`).emit("comment-added", { id: ref.id, ...newComment.data() });
    }

    res.status(201).json({ id: ref.id, ...newComment.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getComments = async (req, res) => {
  try {
    const { docId } = req.params;
    const snapshot = await db.collection("documents").doc(docId).collection("comments").orderBy("createdAt").get();
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateComment = async (req, res) => {
  try {
    const { docId, commentId } = req.params;
    const { content } = req.body;
    const ref = db.collection("documents").doc(docId).collection("comments").doc(commentId);
    await ref.update({
      content: sanitizeHtml(content),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { docId, commentId } = req.params;
    await db.collection("documents").doc(docId).collection("comments").doc(commentId).delete();
    eventBus.publish("comment.deleted", { docId, commentId });
    
    // Broadcast delete event to WebSocket room
    const io = req.app.get("io");
    if (io) {
      io.to(`document-${docId}`).emit("comment-deleted", commentId);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
