import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import { swaggerUi, swaggerSpec } from "./utils/swagger.js";
import "./utils/redis.js";

dotenv.config();

// Environment Variable Validation
const requiredEnvs = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);
if (missingEnvs.length > 0) {
  console.error(`[Auth Service] [CRITICAL] Missing required environment variables: ${missingEnvs.join(", ")}`);
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(morgan("dev"));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow any onrender.com subdomain for the deployed frontend
      if (allowedOrigins.includes(origin) || origin.endsWith(".onrender.com")) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Mount Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount routes (prefix matches monolithic REST setup /api/auth)
app.use("/api/auth", authRoutes);

app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`[Auth Service] Running at http://localhost:${PORT}`);
  console.log(`[Auth Service] Swagger Docs at http://localhost:${PORT}/api-docs`);
});
