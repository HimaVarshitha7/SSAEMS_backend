import express from "express";
import { login, register } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register); // admin-only (enforced in controller)

export default router;
