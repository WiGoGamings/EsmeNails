import express from "express";
import cors from "cors";
import path from "path";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";
import appointmentsRoutes from "./routes/appointments.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import usersRoutes from "./routes/users.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import assistantRoutes from "./routes/assistant.routes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "https://wigogamings.github.io",
  "https://esmenails.com"
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".netlify.app") || hostname.endsWith(".netlify.live");
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman), dominios conocidos y previews de Netlify.
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());

// Servir archivos estáticos desde /public
app.use("/static", express.static(path.resolve("../public")));

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "esmenails-api",
    message: "API activa. Usa las rutas bajo /api",
    docs: {
      health: "/api/health",
      adminLogin: "/api/admin/login",
      userLogin: "/api/auth/login"
    }
  });
});

app.get("/api", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "esmenails-api",
    message: "Prefijo base de la API",
    health: "/api/health"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "esmenails-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/ai", assistantRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API lista en http://localhost:${env.PORT}`);
});
