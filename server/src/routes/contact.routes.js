import { Router } from "express";
import { createContactMessage, getOwnerContactInfo } from "../controllers/contact.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/owner-info", getOwnerContactInfo);
router.post("/messages", requireAuth, createContactMessage);

export default router;
