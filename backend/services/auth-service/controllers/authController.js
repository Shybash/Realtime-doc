import admin from "../firebase/admin.js";

export const firebaseEmailLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "Missing Firebase ID token" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name } = decoded;

    res.cookie("token", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    return res.status(200).json({ uid, email, name: name || null });
  } catch (err) {
    console.error("Firebase login error:", err);
    res.status(401).json({ error: "Unauthorized", details: err.message });
  }
};

import redisClient from "../utils/redis.js";

export const logout = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token && redisClient && redisClient.isOpen) {
      let ttl = 3600; // fallback to 1 hour (default Firebase token lifespan)
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        const exp = decoded.exp;
        const now = Math.floor(Date.now() / 1000);
        const calculatedTtl = exp - now;
        if (calculatedTtl > 0) {
          ttl = calculatedTtl;
        }
      } catch (tokenErr) {
        console.warn("[Auth Service] Token verification failed on logout, using fallback TTL:", tokenErr.message);
      }

      await redisClient.set(`blacklist:${token}`, "1", { EX: ttl });
      console.log(`[Auth Service] JWT blacklisted for ${ttl} seconds.`);
    }
  } catch (err) {
    console.error("[Auth Service] Failed to blacklist token on logout:", err.message);
  }

  res.clearCookie("token");
  res.json({ message: "Logged out" });
};
