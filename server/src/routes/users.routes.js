import { Router } from "express";
import {
	confirmMyEmailCode,
	getMyHistory,
	getMyProfile,
	updateMyProfile,
	verifyMyEmail,
	verifyMyPhone
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/me", requireAuth, getMyProfile);
router.get("/me/history", requireAuth, getMyHistory);
router.put("/me", requireAuth, updateMyProfile);
router.post("/me/verify-email", requireAuth, verifyMyEmail);
router.post("/me/verify-email/confirm", requireAuth, confirmMyEmailCode);
router.post("/me/verify-phone", requireAuth, verifyMyPhone);

export default router;
