import express from "express";
import { getFirestore } from "firebase-admin/firestore";
import { requireDocumentRole } from "../middlewares/documentRole.js";
import verifyJWT from "../middlewares/auth.js";
import sanitizeHtml from "sanitize-html";
import { nanoid } from "nanoid";
import * as Y from "yjs";
import { docs } from "../utils/documentStore.js";
import eventBus from "../utils/eventBus.js";

const router = express.Router();
const db = getFirestore();

router.use(verifyJWT);

router.get("/", async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.toLowerCase() : null;
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    let query = db.collection("documents").where("allowedUsers", "array-contains", userId);
    if (!req.query.all) {
      if (req.query.parentId) {
        query = query.where("parentId", "==", sanitizeHtml(req.query.parentId));
      } else {
        query = query.where("parentId", "==", null); 
      }
    }
    const docsSnapshot = await query.get();
    let documents = [];
    docsSnapshot.forEach(doc => {
      const data = doc.data();
      documents.push({
        id: doc.id,
        ...data,
        title: data.title || "Untitled"
      });
    });
    if (q) {
      documents = documents.filter(doc =>
        (doc.title && doc.title.toLowerCase().includes(q)) ||
        (doc.content && doc.content.toLowerCase().includes(q))
      );
    }
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", requireDocumentRole(["admin", "editor", "viewer"]), async (req, res) => {
  try {
    const doc = req.document;
    res.json({
      id: req.params.id,
      ...doc,
      title: doc.title || "Untitled"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const title = sanitizeHtml(req.body.title);
    const content = sanitizeHtml(req.body.content || "");
    const parentId = req.body.parentId ? sanitizeHtml(req.body.parentId) : null;
    const coverImage = req.body.coverImage ? sanitizeHtml(req.body.coverImage) : null;
    const icon = req.body.icon ? sanitizeHtml(req.body.icon) : null;

    const userId = req.user?.uid;
    if (!title || !userId) {
      return res.status(400).json({ error: "Title and userId are required" });
    }
    const permissions = [
      { userId, role: "admin" }
    ];
    const allowedUsers = [userId];
    const docRef = await db.collection("documents").add({
      title,
      content,
      parentId,
      coverImage,
      icon,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions,
      allowedUsers
    });
    eventBus.publish("document.created", { id: docRef.id, title, userId });
    res.status(201).json({
      id: docRef.id,
      title,
      content,
      parentId,
      coverImage,
      icon,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", requireDocumentRole(["admin", "editor"]), async (req, res) => {
  try {
    const { title, userId, content, parentId, coverImage, icon } = req.body;
    const docRef = db.collection("documents").doc(req.params.id);
    const updateData = {
      updatedAt: new Date()
    };
    if (title !== undefined) updateData.title = sanitizeHtml(title);
    if (userId) updateData.userId = userId;
    if (content !== undefined) updateData.content = sanitizeHtml(content);
    if (parentId !== undefined) updateData.parentId = parentId ? sanitizeHtml(parentId) : null;
    if (coverImage !== undefined) updateData.coverImage = sanitizeHtml(coverImage);
    if (icon !== undefined) updateData.icon = sanitizeHtml(icon);

    await docRef.update(updateData);
    eventBus.publish("document.updated", { id: req.params.id, title: updateData.title || (req.document ? req.document.title : "Untitled"), changes: updateData });
    const updatedDoc = await docRef.get();
    const data = updatedDoc.data();
    res.json({
      id: updatedDoc.id,
      ...data,
      title: data.title || "Untitled"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id/permissions", requireDocumentRole(["admin"]), async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: "Permissions must be an array" });
    }
    const docRef = db.collection("documents").doc(req.params.id);
    const allowedUsers = permissions.map(p => p.userId);
    await docRef.update({ permissions, allowedUsers, updatedAt: new Date() });
    const updatedDoc = await docRef.get();
    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", requireDocumentRole(["admin"]), async (req, res) => {
  try {
    const docRef = db.collection("documents").doc(req.params.id);
    await docRef.delete();
    eventBus.publish("document.deleted", { id: req.params.id });
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/share", requireDocumentRole(["admin"]), async (req, res) => {
  try {
    const { permission } = req.body; 
    if (!["viewer", "commenter", "editor"].includes(permission)) {
      return res.status(400).json({ error: "Invalid permission" });
    }
    const docRef = db.collection("documents").doc(req.params.id);
    const shareToken = nanoid(16);
    await docRef.update({ shareToken, sharePermission: permission, updatedAt: new Date() });
    res.json({ shareToken, sharePermission: permission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/shared/:token", async (req, res) => {
  try {
    const snapshot = await db.collection("documents").where("shareToken", "==", req.params.token).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "Invalid or expired share link" });
    const doc = snapshot.docs[0];
    const data = doc.data();

    // Auto-join current user if they aren't already in the permissions list
    const userId = req.user?.uid;
    if (userId) {
      const permissions = data.permissions || [];
      const isMember = permissions.some((p) => p.userId === userId);
      if (!isMember) {
        const newPermission = { userId, role: data.sharePermission || "viewer" };
        const updatedPermissions = [...permissions, newPermission];
        const allowedUsers = data.allowedUsers || [];
        const updatedAllowedUsers = [...allowedUsers, userId];

        await doc.ref.update({
          permissions: updatedPermissions,
          allowedUsers: updatedAllowedUsers,
          updatedAt: new Date(),
        });

        console.log(`[Document Service] User ${userId} joined document ${doc.id} via shared token with role ${data.sharePermission || "viewer"}`);

        return res.json({
          id: doc.id,
          ...data,
          permissions: updatedPermissions,
          allowedUsers: updatedAllowedUsers,
          title: data.title || "Untitled",
          sharePermission: data.sharePermission || "viewer",
        });
      }
    }

    res.json({
      id: doc.id,
      ...data,
      title: data.title || "Untitled",
      sharePermission: data.sharePermission || "viewer",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- VERSION HISTORY ENDPOINTS ---
router.get("/:id/versions", requireDocumentRole(["admin", "editor", "viewer"]), async (req, res) => {
  try {
    const versionsSnapshot = await db
      .collection("documents")
      .doc(req.params.id)
      .collection("versions")
      .orderBy("createdAt", "desc")
      .get();
    
    const versions = [];
    versionsSnapshot.forEach(doc => {
      versions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/versions", requireDocumentRole(["admin", "editor"]), async (req, res) => {
  try {
    const { name } = req.body;
    const docId = req.params.id;
    const userEmail = req.user?.email || "Anonymous";
    
    const roomName = `document-${docId}`;
    const activeRoom = docs.get(roomName);
    
    let yjsStateBase64 = null;
    let htmlContent = "";
    
    if (activeRoom && activeRoom.doc) {
      const update = Y.encodeStateAsUpdate(activeRoom.doc);
      yjsStateBase64 = Buffer.from(update).toString("base64");
      const docSnap = await db.collection("documents").doc(docId).get();
      if (docSnap.exists) {
        htmlContent = docSnap.data().content || "";
      }
    } else {
      const docSnap = await db.collection("documents").doc(docId).get();
      if (!docSnap.exists) return res.status(404).json({ error: "Document not found" });
      const data = docSnap.data();
      yjsStateBase64 = data.yjsState || Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())).toString("base64");
      htmlContent = data.content || "";
    }

    if (!yjsStateBase64) {
      return res.status(400).json({ error: "No content to create version from" });
    }

    const versionRef = await db
      .collection("documents")
      .doc(docId)
      .collection("versions")
      .add({
        name: name || `Snapshot ${new Date().toLocaleString()}`,
        yjsState: yjsStateBase64,
        content: htmlContent,
        createdAt: new Date(),
        createdBy: userEmail
      });

    res.status(201).json({
      id: versionRef.id,
      name: name || `Snapshot ${new Date().toLocaleString()}`,
      createdAt: new Date(),
      createdBy: userEmail
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/versions/:versionId/restore", requireDocumentRole(["admin", "editor"]), async (req, res) => {
  try {
    const docId = req.params.id;
    const versionId = req.params.versionId;
    
    const versionSnap = await db
      .collection("documents")
      .doc(docId)
      .collection("versions")
      .doc(versionId)
      .get();
      
    if (!versionSnap.exists) {
      return res.status(404).json({ error: "Version not found" });
    }
    
    const versionData = versionSnap.data();
    
    await db.collection("documents").doc(docId).update({
      yjsState: versionData.yjsState,
      content: versionData.content,
      updatedAt: new Date()
    });
    
    eventBus.publish("document.restored", { id: docId, versionName: versionData.name, userEmail: req.user?.email || "Anonymous" });

    const roomName = `document-${docId}`;
    if (docs.has(roomName)) {
      docs.delete(roomName);
    }
    
    const io = req.app.get("io");
    if (io) {
      io.to(roomName).emit("document-restored");
    }
    
    res.json({ message: "Document restored successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
