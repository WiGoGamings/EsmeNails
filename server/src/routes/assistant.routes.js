import { Router } from "express";
import { askAssistant } from "../controllers/assistant.controller.js";

const router = Router();

router.post("/", askAssistant);

export default router;
