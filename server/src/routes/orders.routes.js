import { Router } from "express";
import { createOrder } from "../controllers/order.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.post("/", requireAuth, createOrder);

export default router;
