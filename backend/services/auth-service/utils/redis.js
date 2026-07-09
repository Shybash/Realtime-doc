import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
let redisClient = null;

if (redisUrl) {
  const config = redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://")
    ? { url: redisUrl }
    : { socket: { host: redisUrl, port: 6379 } };

  redisClient = createClient(config);
  redisClient.on("error", (err) => console.error("[Auth Service Redis] Error:", err));
  
  redisClient.connect()
    .then(() => console.log("[Auth Service Redis] Connected successfully."))
    .catch((err) => console.warn("[Auth Service Redis] Connection failed:", err.message));
} else {
  console.log("[Auth Service Redis] No Redis configuration found. Blacklisting disabled.");
}

export default redisClient;
