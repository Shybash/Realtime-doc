import { getFirestore } from "firebase-admin/firestore";
import { hasDocumentRole } from "../utils/permissions.js";

export function requireDocumentRole(allowedRoles) {
  return async (req, res, next) => {
    const userId = req.user?.uid; 
    const docId = req.params.id || req.body.documentId;
    if (!userId || !docId) return res.status(400).json({ error: "Missing user or document ID" });

    const db = getFirestore();
    const docSnap = await db.collection("documents").doc(docId).get();
    if (!docSnap.exists) return res.status(404).json({ error: "Document not found" });

    const doc = docSnap.data();
    if (!hasDocumentRole(doc, userId, allowedRoles)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" });
    }
    req.document = doc; 
    next();
  };
}
