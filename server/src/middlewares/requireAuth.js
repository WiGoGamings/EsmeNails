import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
};
