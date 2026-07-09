import dotenv from "dotenv";
import { initNotificationSubscribers } from "./subscribers/notificationHandlers.js";

dotenv.config();

// Initialize Event-Driven listeners
initNotificationSubscribers();

import http from "http";

// Create a native HTTP healthcheck server to allow running as a free Web Service on Render
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Notification Service Active\n");
});

server.listen(PORT, () => {
  console.log(`[Notification Service] Healthcheck server listening on port ${PORT}`);
});
