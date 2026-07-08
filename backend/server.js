import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import admin from "./firebase/admin.js";
import { getFirestore } from "firebase-admin/firestore";
import { Server as SocketIOServer } from "socket.io";
import { encodeStateAsUpdate, applyUpdate, Doc } from "yjs";
import { Buffer } from "buffer";
import helmet from "helmet";
import morgan from "morgan";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./graphql/schema.js";
import { resolvers } from "./graphql/resolvers.js";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { swaggerUi, swaggerSpec } from "./utils/swagger.js";

import authRoutes from "./routes/auth.routes.js";
import docsRoutes from "./routes/docs.routes.js";
import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate } from "y-protocols/awareness.js";
import commentRoutes from './routes/comments.routes.js';
import { docs } from "./utils/documentStore.js";
import { initEventSubscribers } from "./subscribers/eventHandlers.js";

dotenv.config();

// Initialize Event-Driven Subscribers
initEventSubscribers();

// Environment Variable Validation
const requiredEnvs = ['JWT_SECRET', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
if (missingEnvs.length > 0) {
  console.error(`\x1b[31m[CRITICAL] Missing required environment variables:\x1b[0m ${missingEnvs.join(', ')}`);
  console.error("Please create or update your backend/.env file.");
  process.exit(1);
}

// Global Process Event Listeners to prevent crashes from external network timeouts (e.g. Firestore)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] Promise:', promise, 'Reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] Error:', err);
});

const app = express();

app.use(helmet());
app.use(morgan("dev"));

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-8', 
  legacyHeaders: false, 
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});
app.use(globalLimiter);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Configure Redis adapter for Socket.IO horizontal scaling
const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
if (redisUrl) {
  try {
    const pubClient = createClient(
      redisUrl.startsWith("redis://") ? { url: redisUrl } : { socket: { host: redisUrl, port: 6379 } }
    );
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("[Socket.IO Redis] Pub Client Error:", err));
    subClient.on("error", (err) => console.error("[Socket.IO Redis] Sub Client Error:", err));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[Socket.IO] Redis adapter successfully connected and configured for horizontal scaling.");
  } catch (error) {
    console.warn("[Socket.IO] Redis adapter connection failed. Falling back to default memory adapter:", error.message);
  }
} else {
  console.log("[Socket.IO] No Redis configuration found. Running with default in-memory socket adapter.");
}

const db = getFirestore();

app.set('io', io);

async function saveYDocToFirestore(roomName) {
  const room = docs.get(roomName);
  if (!room || !room.doc) return;
  const update = encodeStateAsUpdate(room.doc);
  const docId = roomName.replace(/^document-/, "");
  await db
    .collection("documents")
    .doc(docId)
    .set(
      {
        yjsState: Buffer.from(update).toString("base64"),
        updatedAt: new Date(),
      },
      { merge: true }
    );
}

async function loadYDocFromFirestore(roomName) {
  const docId = roomName.replace(/^document-/, "");
  const docSnap = await db.collection("documents").doc(docId).get();
  if (!docSnap.exists) return null;
  const data = docSnap.data();
  const stateStr = data.yjsState;
  if (typeof stateStr === "string" && stateStr.length > 0) {
    try {
      const ydoc = new Doc();
      const update = Buffer.from(stateStr, "base64");
      applyUpdate(ydoc, update);
      return ydoc;
    } catch (e) {
      console.warn("Failed to decode Yjs update from Firestore, returning empty doc:", e);
      return new Doc();
    }
  }
  return null;
}

const getYDoc = async (roomName) => {
  if (!docs.has(roomName)) {
    let doc = await loadYDocFromFirestore(roomName);
    if (!doc) doc = new Y.Doc();
    const awareness = new Awareness(doc);
    awareness.setLocalStateField("user", {
      name: "Anonymous",
      color: "#" + Math.floor(Math.random() * 16777215).toString(16),
      id: Math.random().toString(36).substr(2, 9),
    });
    docs.set(roomName, { doc, awareness, users: new Set() });
  }
  return docs.get(roomName);
};

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Initialize Apollo Server
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
});
await apolloServer.start();

app.use(
  "/graphql",
  expressMiddleware(apolloServer, {
    context: async ({ req }) => {
      let user = null;
      try {
        const token = req.cookies?.token;
        if (token) {
          const decoded = await admin.auth().verifyIdToken(token);
          user = {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name || null,
          };
        }
      } catch (err) {
        // Context user remains null if token invalid/missing
      }
      return { user };
    },
  })
);

// Mount Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use('/api', commentRoutes);
app.use("/api/docs", docsRoutes);


app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});


io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-document", async (roomName, userInfo) => {
    socket.join(roomName);
    const room = await getYDoc(roomName);
    room.users.add(socket.id);
    const { doc, awareness } = room;

    if (userInfo) {
      awareness.setLocalStateField("user", {
        name: userInfo.name || "Anonymous",
        color:
          userInfo.color ||
          "#" + Math.floor(Math.random() * 16777215).toString(16),
        id: userInfo.id || Math.random().toString(36).substr(2, 9),
      });
    }

    console.log(`User joined document: ${roomName}`);

    const update = Y.encodeStateAsUpdate(doc);
    socket.emit("document-state", {
      content: Buffer.from(update).toString("base64"),
      users: Array.from(awareness.getStates().values()),
    });
  });

  socket.on("yjs-update", async (roomName, update) => {
    const room = await getYDoc(roomName);
    Y.applyUpdate(room.doc, new Uint8Array(update));
    socket.to(roomName).emit("yjs-update", update);
  });

  socket.on("leave-document", async (roomName) => {
    socket.leave(roomName);
    const room = docs.get(roomName);
    if (room) {
      room.users.delete(socket.id);
      if (room.users.size === 0) {
        await saveYDocToFirestore(roomName);
        docs.delete(roomName);
      }
    }
    console.log(`User left document: ${roomName}`);
  });

  socket.on("awareness-update", (roomName, update) => {
    socket.to(roomName).emit("awareness-update", update);
  });

  socket.on("disconnect", async () => {
    for (const [roomName, room] of docs.entries()) {
      room.users.delete(socket.id);
      if (room.users.size === 0) {
        await saveYDocToFirestore(roomName);
        docs.delete(roomName);
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});

// ── Periodic Auto-save ────────────────────────────────────────────────────────
// Saves all active in-memory Yjs documents to Firestore every 60 seconds.
// Without this, if the server crashes, all in-progress edits since the last
// user disconnect are permanently lost. Auto-save limits that window to 60s.
const AUTO_SAVE_INTERVAL_MS = 60_000;

const autoSaveInterval = setInterval(async () => {
  const activeRooms = Array.from(docs.keys());
  if (activeRooms.length === 0) return;

  console.log(`[AutoSave] Saving ${activeRooms.length} active room(s) to Firestore…`);
  await Promise.allSettled(
    activeRooms.map(roomName =>
      saveYDocToFirestore(roomName).catch(err =>
        console.error(`[AutoSave] Failed to save ${roomName}:`, err)
      )
    )
  );
}, AUTO_SAVE_INTERVAL_MS);

// Clean shutdown — flush all rooms before exiting
process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Flushing all active documents before shutdown…');
  clearInterval(autoSaveInterval);
  await Promise.allSettled(
    Array.from(docs.keys()).map(roomName => saveYDocToFirestore(roomName))
  );
  process.exit(0);
});
