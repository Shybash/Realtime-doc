import eventBus from "../utils/eventBus.js";
import nodemailer from "nodemailer";

let transporter = null;

async function initMailer() {
  console.log("[Notification Service] Initializing SMTP Sandbox Account...");
  try {
    // Generate temporary SMTP test account from ethereal.email (100% free, no config needed)
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log(`[Notification Service] Ethereal SMTP Mailer ready. User: ${testAccount.user}`);
  } catch (err) {
    console.error("[Notification Service] Failed to create Ethereal SMTP account:", err);
  }
}

export function initNotificationSubscribers() {
  console.log("[Notification Service] Active and listening for Redis events...");
  
  // Initialize Ethereal connection asynchronously
  initMailer().catch(err => {
    console.error("[Notification Service] Mailer initialization failed:", err);
  });

  // 1. Send Email Notification
  eventBus.subscribe("comment.created", async (data) => {
    if (!transporter) {
      console.warn("[Notification Service] Mailer not ready. Printing comment to console fallback:", data.content);
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: '"CollabDocs Notifications" <notifications@collabdocs.local>',
        to: `collaborators-of-doc-${data.docId}@collabdocs.local`,
        subject: `💬 New Comment in Document`,
        text: `User "${data.userId}" commented: "${data.content}"`,
        html: `
          <div style="font-family: sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <h2 style="color: #2563eb; margin-top: 0; font-size: 20px;">💬 New Comment Added</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.5;">Hello,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.5;">A new comment has been posted on a document you are collaborating on:</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1e293b;">User ${data.userId}:</p>
              <p style="margin: 5px 0 0 0; font-style: italic; color: #334155; font-size: 15px;">"${data.content}"</p>
            </div>
            
            <p style="margin-top: 30px; margin-bottom: 20px;">
              <a href="http://localhost:5173/documents/${data.docId}" 
                 style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
                View Document
              </a>
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated notification from CollabDocs.</p>
          </div>
        `,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`
======================================================
📧 [REAL SMTP SANDBOX] - EMAIL DISPATCHED SUCCESSFULLY
======================================================
TO: collaborators-of-doc-${data.docId}@collabdocs.local
SUBJECT: 💬 New Comment on CollabDocs Document
PREVIEW URL: ${previewUrl}
======================================================
`);
    } catch (err) {
      console.error("[Notification Service] Failed to send email via Ethereal:", err);
    }
  });

  // 2. Audit Trail Logger
  eventBus.subscribe("document.created", (data) => {
    console.log(`[Notification Service] [Audit Log] Document created: "${data.title}" by user "${data.userId}"`);
  });

  eventBus.subscribe("document.deleted", (data) => {
    console.log(`[Notification Service] [Audit Log] Document deleted: ID ${data.id}`);
  });

  eventBus.subscribe("document.updated", (data) => {
    console.log(`[Notification Service] [Audit Log] Document updated: ID ${data.id}`);
  });

  eventBus.subscribe("document.restored", (data) => {
    console.log(`[Notification Service] [Audit Log] Document ID ${data.id} was restored to "${data.versionName}" by ${data.userEmail}`);
  });
}
