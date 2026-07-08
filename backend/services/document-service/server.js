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
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness.js";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";

import docsRoutes from "./routes/docs.routes.js";
import commentRoutes from "./routes/comments.routes.js";
import { docs } from "./utils/documentStore.js";
import { typeDefs } from "./graphql/schema.js";
import { resolvers } from "./graphql/resolvers.js";
import { swaggerUi, swaggerSpec } from "./utils/swagger.js";
import eventBus from "./utils/eventBus.js";

dotenv.config();

// Environment Variable Validation
const requiredEnvs = ["JWT_SECRET", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);
if (missingEnvs.length > 0) {
  console.error(`[Document Service] [CRITICAL] Missing required environment variables: ${missingEnvs.join(", ")}`);
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(morgan("dev"));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 500, 
  standardHeaders: "draft-8", 
  legacyHeaders: false, 
  message: { error: "Too many requests, please try again later" }
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
app.set("io", io);

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
          let isBlacklisted = false;
          if (eventBus && eventBus.isRedisConnected && eventBus.redisClient) {
            isBlacklisted = await eventBus.redisClient.get(`blacklist:${token}`);
          }

          if (!isBlacklisted) {
            const decoded = await admin.auth().verifyIdToken(token);
            user = {
              uid: decoded.uid,
              email: decoded.email,
              name: decoded.name || null,
            };
          } else {
            console.log("[GraphQL] Access blocked: Token is blacklisted.");
          }
        }
      } catch (err) {
        // Context user remains null if verification fails
      }
      return { user };
    },
  })
);

// Mount Swagger API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount REST routes
app.use("/api", commentRoutes);
app.use("/api/docs", docsRoutes);

app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const token = cookieHeader
      .split(";")
      .find((row) => row.trim().startsWith("token="))
      ?.split("=")[1];

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    if (eventBus && eventBus.isRedisConnected && eventBus.redisClient) {
      const isBlacklisted = await eventBus.redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return next(new Error("Authentication error: Session revoked"));
      }
    }

    const decoded = await admin.auth().verifyIdToken(token);
    socket.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || null,
    };
    next();
  } catch (err) {
    console.warn(`[Socket.IO Auth Failed] Connection rejected: ${err.message}`);
    next(new Error("Authentication error: Invalid session"));
  }
});

io.on("connection", (socket) => {
  console.log(`Authenticated client connected: ${socket.id} (User: ${socket.user?.email || "Unknown"})`);

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
  console.log(`[Document Service] Running at http://localhost:${PORT}`);
  console.log(`[Document Service] Swagger Docs at http://localhost:${PORT}/api-docs`);
});

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

process.on("SIGTERM", async () => {
  console.log("[SIGTERM] Flushing all active documents before shutdown…");
  clearInterval(autoSaveInterval);
  await Promise.allSettled(
    Array.from(docs.keys()).map(roomName => saveYDocToFirestore(roomName))
  );
  process.exit(0);
});
