import eventBus from "../utils/eventBus.js";

// Register all subscribers
export function initEventSubscribers() {
  console.log("[Subscribers] Initializing Event-Driven subscribers...");

  // 1. Audit Log Subscriber (Tracks document modifications)
  eventBus.subscribe("document.created", (data) => {
    console.log(`[Audit Trail] 🆕 Document "${data.title}" (ID: ${data.id}) was created by user: ${data.userId}`);
    // In production, write this audit log entry to a Firestore "/auditLogs" collection
  });

  eventBus.subscribe("document.updated", (data) => {
    console.log(`[Audit Trail] ✏️ Document "${data.title}" (ID: ${data.id}) was updated. Fields changed:`, Object.keys(data.changes || {}));
  });

  eventBus.subscribe("document.deleted", (data) => {
    console.log(`[Audit Trail] ❌ Document ID: ${data.id} was deleted by Admin.`);
  });

  // 2. Notification/Activity Stream Subscriber (Tracks comment notifications)
  eventBus.subscribe("comment.created", (data) => {
    console.log(`[Notification Engine] 💬 User "${data.userId}" commented on document ID: ${data.docId}. Content: "${data.content}"`);
    // In production, notify other editors of the document via email, WebSockets, or Push notifications.
  });

  eventBus.subscribe("comment.deleted", (data) => {
    console.log(`[Notification Engine] 🗑️ Comment ID: ${data.commentId} in document ID: ${data.docId} was deleted.`);
  });

  eventBus.subscribe("document.restored", (data) => {
    console.log(`[Audit Trail] 🔄 Document ID: ${data.id} was restored to snapshot: ${data.versionName} by user: ${data.userEmail}`);
  });
}
