// server.js
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
// import { auth } from "./src/middleware/auth.js"; // not used here, keep if needed

import bulkUsersRoutes from "./src/routes/admin.bulkUsers.routes.js";
import adminUsersRoutes from "./src/routes/admin.users.routes.js";
import allocationRoutes from "./src/routes/allocations.js";

import { connectDB } from "./src/config/db.js";

import Session from "./src/models/Session.js";
import User from "./src/models/User.js";

// Routers
import authRoutes from "./src/routes/auth.routes.js";
import studentRoutes from "./src/routes/student.routes.js";
import coordinatorRoutes from "./src/routes/coordinator.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import subjectsRoutes from "./src/routes/subjects.js";

import { errorHandler } from "./src/middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

/* ---------- CORS (robust, works with preflight) ---------- */
/**
 * Allowed origins:
 * - From env: CORS_ORIGIN="https://ssaems-frontend1.onrender.com,https://another.com"
 * - Fallback to your Render frontend if env is missing
 */
const allowedOriginsFromEnv = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const defaultAllowed = ["https://ssaems-frontend1.onrender.com"];
const allowedOrigins = allowedOriginsFromEnv.length ? allowedOriginsFromEnv : defaultAllowed;

/**
 * In dev (no Origin header or localhost tools), allow requests without Origin.
 * In prod, only allow explicit matches.
 */
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman/same-origin
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: Origin not allowed -> ${origin}`));
  },
  credentials: true, // keep true if you use cookies or Authorization headers from browser
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Length"],
  optionsSuccessStatus: 204, // make preflight happy on older browsers
  preflightContinue: false,  // cors will end the OPTIONS request
};

// Apply CORS for all routes
app.use(cors(corsOptions));
// Ensure explicit handling of OPTIONS preflight across the board
app.options("*", cors(corsOptions));

/* ---------- Core Middlewares ---------- */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// If behind a proxy (Render), trust it so secure cookies & protocol work correctly
app.set("trust proxy", 1);

/* ---------- Health ---------- */
app.get("/", (_req, res) =>
  res.json({ status: "ok", service: "SSAEMS Backend", env: NODE_ENV })
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------- Routes ---------- */
app.use("/api/admin", bulkUsersRoutes);
app.use("/api/admin", adminUsersRoutes);
app.use("/api/allocations", allocationRoutes);

app.use("/api/auth", authRoutes);
app.use("/api", studentRoutes);
app.use("/api", coordinatorRoutes);
app.use("/api", adminRoutes);
app.use("/api/subjects", subjectsRoutes);

/* ---------- 404 ---------- */
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

/* ---------- Global Error Handler ---------- */
app.use(errorHandler);

/* ---------- Session bootstrap ---------- */
async function ensureActiveSession() {
  const have = await Session.findOne({ active: true, locked: { $ne: true } }).lean();
  if (have) {
    console.log("Active session:", have._id.toString(), have.name);
    return have;
  }
  const doc = await Session.create({
    name: "Default Session",
    code: "DEFAULT-" + Date.now(),
    active: true,
    locked: false,
  });
  console.log("Created active session:", doc._id.toString(), doc.name);
  return doc;
}

/* ---------- Start ---------- */
(async () => {
  try {
    await connectDB();

    try {
      await User.syncIndexes();
      console.log("User indexes synced");
    } catch (e) {
      console.warn("User.syncIndexes failed:", e?.message);
    }

    await ensureActiveSession();

    app.listen(PORT, () => {
      console.log(
        `SSAEMS API running on http://localhost:${PORT}  (NODE_ENV=${NODE_ENV})`
      );
      console.log("CORS allowed origins:", allowedOrigins.join(", ") || "(none)");
    });
  } catch (e) {
    console.error("Failed to start server", e);
    process.exit(1);
  }
})();

process.on("unhandledRejection", (reason) =>
  console.error("Unhandled Rejection:", reason)
);
process.on("uncaughtException", (err) =>
  console.error("Uncaught Exception:", err)
);
