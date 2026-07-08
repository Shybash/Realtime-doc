import admin from "../firebase/admin.js";
import redisClient from "../utils/redis.js";

const verifyJWT = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) return res.status(401).json({ error: "No token" });

    // Check blacklist in Redis
    if (redisClient && redisClient.isOpen) {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: "Unauthorized: Token revoked" });
      }
    }

    const decoded = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || null,
    };

    next(); 
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export default verifyJWT;
