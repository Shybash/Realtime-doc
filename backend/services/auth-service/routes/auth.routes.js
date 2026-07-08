import express from "express";
import { rateLimit } from "express-rate-limit";
import { firebaseEmailLogin, logout } from "../controllers/authController.js";
import verifyJWT from "../middlewares/auth.js";
import admin from "../firebase/admin.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 20, 
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again after 15 minutes" }
});

/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: User authentication and session management
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user session with Firebase ID Token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase Client-side ID token (JWT)
 *     responses:
 *       200:
 *         description: Login successful. Sets httpOnly token cookie.
 *       400:
 *         description: Missing or invalid token body.
 *       401:
 *         description: Authentication failed.
 */
router.post(
  "/login",
  authLimiter,
  [
    body("idToken")
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Invalid or missing idToken"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  firebaseEmailLogin
);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Clear user session cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful.
 */
router.post("/logout", logout);

/**
 * @openapi
 * /api/auth/protected:
 *   get:
 *     summary: Retrieve details of the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User session object.
 *       401:
 *         description: Unauthorized. Cookie is missing or expired.
 */
router.get("/protected", verifyJWT, (req, res) => {
  res.json(req.user);
});

router.post("/lookup-uid", verifyJWT, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    res.json({ uid: userRecord.uid, email: userRecord.email, name: userRecord.displayName });
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
});

router.post("/user-info", verifyJWT, async (req, res) => {
  const { uids } = req.body;
  if (!Array.isArray(uids) || uids.length === 0) {
    return res.status(400).json({ error: "uids must be a non-empty array" });
  }
  try {
    const users = await Promise.all(
      uids.map(async (uid) => {
        try {
          const userRecord = await admin.auth().getUser(uid);
          return {
            uid: userRecord.uid,
            email: userRecord.email,
            name: userRecord.displayName,
          };
        } catch {
          return { uid, email: null, name: null };
        }
      })
    );
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

export default router;
