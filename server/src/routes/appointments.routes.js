import { Router } from "express";
import {
  createAppointment,
  getMyAppointments
} from "../controllers/appointment.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/my", requireAuth, getMyAppointments);
router.post("/", requireAuth, createAppointment);

export default router;
