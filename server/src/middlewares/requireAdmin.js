import { requireAuth } from "./requireAuth.js";

export const requireAdmin = (req, res, next) => {
  return requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Acceso solo para administrador" });
    }

    return next();
  });
};
