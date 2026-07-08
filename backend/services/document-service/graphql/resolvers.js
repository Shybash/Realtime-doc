import admin from "../firebase/admin.js";
import { getFirestore } from "firebase-admin/firestore";
import { hasDocumentRole } from "../utils/permissions.js";
import sanitizeHtml from "sanitize-html";
import eventBus from "../utils/eventBus.js";
import { GraphQLError } from "graphql";

const db = getFirestore();

function checkAuth(context) {
  if (!context.user) {
    throw new GraphQLError("Unauthorized: You must be logged in.", {
      extensions: { code: "UNAUTHENTICATED" }
    });
  }
}

async function verifyDocumentAccess(docId, userId, allowedRoles) {
  const docSnap = await db.collection("documents").doc(docId).get();
  if (!docSnap.exists) {
    throw new GraphQLError("Document not found", {
      extensions: { code: "NOT_FOUND" }
    });
  }
  const docData = docSnap.data();
  if (!hasDocumentRole(docData, userId, allowedRoles)) {
    throw new GraphQLError("Forbidden: Insufficient permissions for this operation.", {
      extensions: { code: "FORBIDDEN" }
    });
  }
  return docData;
}

export const resolvers = {
  Query: {
    documents: async (_, { q, all, parentId }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        let query = db.collection("documents").where("allowedUsers", "array-contains", userId);
        
        if (!all) {
          if (parentId) {
            query = query.where("parentId", "==", sanitizeHtml(parentId));
          } else {
            query = query.where("parentId", "==", null);
          }
        }

        const snapshot = await query.get();
        let list = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            ...data,
            title: data.title || "Untitled"
          });
        });

        if (q) {
          const queryLower = q.toLowerCase();
          list = list.filter((doc) =>
            (doc.title && doc.title.toLowerCase().includes(queryLower)) ||
            (doc.content && doc.content.toLowerCase().includes(queryLower))
          );
        }

        return list;
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    },

    document: async (_, { id }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        const docData = await verifyDocumentAccess(id, userId, ["admin", "editor", "viewer"]);
        return {
          id,
          ...docData,
          title: docData.title || "Untitled"
        };
      } catch (error) {
        throw error;
      }
    },

    comments: async (_, { docId }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        await verifyDocumentAccess(docId, userId, ["admin", "editor", "commenter", "viewer"]);

        const snapshot = await db
          .collection("documents")
          .doc(docId)
          .collection("comments")
          .orderBy("createdAt")
          .get();

        return snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
            updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt) : null,
          };
        });
      } catch (error) {
        throw error;
      }
    }
  },

  Mutation: {
    createDocument: async (_, { title, content, parentId, coverImage, icon }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        const sanitizedTitle = sanitizeHtml(title);
        const sanitizedContent = sanitizeHtml(content || "");
        const sanitizedParentId = parentId ? sanitizeHtml(parentId) : null;
        const sanitizedCoverImage = coverImage ? sanitizeHtml(coverImage) : null;
        const sanitizedIcon = icon ? sanitizeHtml(icon) : null;

        const permissions = [{ userId, role: "admin" }];
        const allowedUsers = [userId];

        const docRef = await db.collection("documents").add({
          title: sanitizedTitle,
          content: sanitizedContent,
          parentId: sanitizedParentId,
          coverImage: sanitizedCoverImage,
          icon: sanitizedIcon,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions,
          allowedUsers
        });

        eventBus.publish("document.created", { id: docRef.id, title: sanitizedTitle, userId });

        return {
          id: docRef.id,
          title: sanitizedTitle,
          content: sanitizedContent,
          parentId: sanitizedParentId,
          coverImage: sanitizedCoverImage,
          icon: sanitizedIcon,
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          permissions,
          allowedUsers
        };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    },

    updateDocumentTitle: async (_, { id, title }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        await verifyDocumentAccess(id, userId, ["admin", "editor"]);

        const sanitizedTitle = sanitizeHtml(title);
        const docRef = db.collection("documents").doc(id);

        const updateData = {
          title: sanitizedTitle,
          updatedAt: new Date()
        };

        await docRef.update(updateData);

        eventBus.publish("document.updated", { id, title: sanitizedTitle, changes: updateData });

        const updatedDoc = await docRef.get();
        return {
          id,
          ...updatedDoc.data(),
          title: sanitizedTitle
        };
      } catch (error) {
        throw error;
      }
    },

    addComment: async (_, { docId, content, anchor, parentId }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        await verifyDocumentAccess(docId, userId, ["admin", "editor", "commenter", "viewer"]);

        const sanitizedContent = sanitizeHtml(content);
        const comment = {
          userId,
          anchor: anchor ? sanitizeHtml(JSON.stringify(anchor)) : null,
          content: sanitizedContent,
          parentId: parentId ? sanitizeHtml(parentId) : null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const commentRef = await db
          .collection("documents")
          .doc(docId)
          .collection("comments")
          .add(comment);

        eventBus.publish("comment.created", { docId, commentId: commentRef.id, userId, content: sanitizedContent });

        return {
          id: commentRef.id,
          userId,
          content: sanitizedContent,
          anchor: comment.anchor,
          parentId: comment.parentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } catch (error) {
        throw error;
      }
    },

    deleteComment: async (_, { docId, commentId }, context) => {
      checkAuth(context);
      const userId = context.user.uid;

      try {
        await verifyDocumentAccess(docId, userId, ["admin", "editor"]);

        await db
          .collection("documents")
          .doc(docId)
          .collection("comments")
          .doc(commentId)
          .delete();

        eventBus.publish("comment.deleted", { docId, commentId });

        return true;
      } catch (error) {
        throw error;
      }
    }
  }
};
