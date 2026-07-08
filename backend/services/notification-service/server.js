import dotenv from "dotenv";
import { initNotificationSubscribers } from "./subscribers/notificationHandlers.js";

dotenv.config();

// Initialize Event-Driven listeners
initNotificationSubscribers();

// Prevent process from exiting instantly
setInterval(() => {
  // Keep daemon alive
}, 60000);
