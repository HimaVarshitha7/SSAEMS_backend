// server.js
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import { auth } from "./src/middleware/auth.js";

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

/* ---------- CORS ---------- */
const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const isDev = process.env.NODE_ENV !== "production";
const corsOptions = {
  origin: envOrigins.length ? envOrigins : (isDev ? true : false),
  credentials: true,
};
app.use(cors(corsOptions));

/* ---------- Core Middlewares ---------- */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

/* ---------- Health ---------- */
app.get("/", (_req, res) => res.json({ status: "ok", service: "SSAEMS Backend" }));
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

    app.listen(PORT, () =>
      console.log(`SSAEMS API running on http://localhost:${PORT}  (NODE_ENV=${process.env.NODE_ENV || "dev"})`)
    );
  } catch (e) {
    console.error("Failed to start server", e);
    process.exit(1);
  }
})();

process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
