import { Router } from "express";
import {
  adminLogin,
  createAdminEmployee,
  createAdminProduct,
  createAdminPromotion,
  createAdminService,
  deleteAdminEmployee,
  deleteAdminProduct,
  deleteAdminPromotion,
  deleteAdminService,
  deleteAdminAppointment,
  exportAdminCsv,
  getAdminDashboard,
  getAdminSettings,
  restoreCompletedAdminAppointment,
  updateAdminAppointment,
  updateAdminContactMessage,
  updateAdminEmployee,
  updateAdminOwnerContact,
  updateAdminPointsGameAchievements,
  updateAdminPointsProgram,
  updateAdminProduct,
  updateAdminPromotion,
  updateAdminService
} from "../controllers/admin.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.post("/login", adminLogin);
router.get("/dashboard", requireAdmin, getAdminDashboard);
router.get("/settings", requireAdmin, getAdminSettings);
router.get("/reports/csv", requireAdmin, exportAdminCsv);
router.post("/settings/services", requireAdmin, createAdminService);
router.put("/settings/services/:id", requireAdmin, updateAdminService);
router.delete("/settings/services/:id", requireAdmin, deleteAdminService);
router.post("/settings/products", requireAdmin, createAdminProduct);
router.put("/settings/products/:id", requireAdmin, updateAdminProduct);
router.delete("/settings/products/:id", requireAdmin, deleteAdminProduct);
router.post("/settings/promotions", requireAdmin, createAdminPromotion);
router.put("/settings/promotions/:id", requireAdmin, updateAdminPromotion);
router.delete("/settings/promotions/:id", requireAdmin, deleteAdminPromotion);
router.post("/settings/employees", requireAdmin, createAdminEmployee);
router.put("/settings/employees/:id", requireAdmin, updateAdminEmployee);
router.delete("/settings/employees/:id", requireAdmin, deleteAdminEmployee);
router.put("/settings/owner-contact", requireAdmin, updateAdminOwnerContact);
router.put("/settings/points-program", requireAdmin, updateAdminPointsProgram);
router.put("/settings/points-game-achievements", requireAdmin, updateAdminPointsGameAchievements);
router.put("/appointments/:id", requireAdmin, updateAdminAppointment);
router.post("/appointments/:id/restore", requireAdmin, restoreCompletedAdminAppointment);
router.delete("/appointments/:id", requireAdmin, deleteAdminAppointment);
router.put("/contact-messages/:id", requireAdmin, updateAdminContactMessage);

export default router;
