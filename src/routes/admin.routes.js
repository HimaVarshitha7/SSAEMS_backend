import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { createSession, listSessions, setSessionFlags } from "../controllers/admin.session.controller.js";

const r = Router();
// r.use(auth) // if you want admin-only, auth+role check add cheyyi

r.post("/sessions", createSession);
r.get("/sessions", listSessions);
r.patch("/sessions/:id", setSessionFlags);

export default r;
