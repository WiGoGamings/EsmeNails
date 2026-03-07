import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { db, persist } from "../db/storage.js";
import { decryptText } from "../lib.crypto.js";
import {
  adminAppointmentUpdateSchema,
  adminContactMessageUpdateSchema,
  adminEmployeeSchema,
  adminLoginSchema,
  adminOwnerContactSchema,
  adminPointsProgramSchema,
  adminProductSchema,
  adminPromotionSchema,
  adminServiceSchema,
  periodSchema
} from "../schemas/admin.schema.js";

let adminPasswordHashCache = "";

const getAdminPasswordHash = async () => {
  if (env.ADMIN_PASSWORD_HASH) {
    return env.ADMIN_PASSWORD_HASH;
  }

  if (!adminPasswordHashCache) {
    adminPasswordHashCache = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  }

  return adminPasswordHashCache;
};

const sum = (values) => values.reduce((acc, value) => acc + value, 0);

const isSameDay = (date, now) => {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getPeriodFlags = (date, now) => {
  const weekStart = startOfWeek(now);
  const monthMatch =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const yearMatch = date.getFullYear() === now.getFullYear();

  return {
    day: isSameDay(date, now),
    week: date >= weekStart && date <= now,
    month: monthMatch,
    year: yearMatch
  };
};

const parseValidationError = (error, fallback = "Datos invalidos") => {
  const flatten = error.flatten();
  const fieldErrors = Object.values(flatten.fieldErrors).flat();
  return {
    error: fieldErrors[0] || flatten.formErrors[0] || fallback,
    details: flatten
  };
};

const safeDecrypt = (value) => {
  if (!value) return "";
  try {
    return decryptText(value);
  } catch {
    return "";
  }
};

const toAdminData = () => {
  const now = new Date();

  const users = db.data.users.map((user) => ({
    id: user.id,
    name: safeDecrypt(user.nameEnc),
    email: safeDecrypt(user.emailEnc),
    phone: safeDecrypt(user.phoneEnc),
    birthDate: user.birthDate || "",
    description: user.description || "",
    points: user.points,
    createdAt: user.createdAt
  }));

  const userMap = new Map(users.map((user) => [user.id, user]));

  const appointments = db.data.appointments.map((appointment) => {
    const client = userMap.get(appointment.userId);
    const employee = (db.data.employees || []).find((entry) => entry.id === appointment.employeeId);
    return {
      ...appointment,
      clientName: appointment.clientSnapshot?.name || client?.name || "Cliente",
      clientEmail: appointment.clientSnapshot?.email || client?.email || "Sin email",
      clientPhone: appointment.clientSnapshot?.phone || client?.phone || "",
      clientBirthDate: appointment.clientSnapshot?.birthDate || client?.birthDate || "",
      clientDescription: appointment.clientSnapshot?.description || client?.description || "",
      employeeName: appointment.employeeName || employee?.name || "Sin asignar"
    };
  });

  const completedAppointments = (db.data.completedAppointments || []).map((appointment) => {
    const client = userMap.get(appointment.userId);
    const employee = (db.data.employees || []).find((entry) => entry.id === appointment.employeeId);
    return {
      ...appointment,
      clientName: appointment.clientSnapshot?.name || client?.name || "Cliente",
      clientEmail: appointment.clientSnapshot?.email || client?.email || "Sin email",
      clientPhone: appointment.clientSnapshot?.phone || client?.phone || "",
      clientBirthDate: appointment.clientSnapshot?.birthDate || client?.birthDate || "",
      clientDescription: appointment.clientSnapshot?.description || client?.description || "",
      employeeName: appointment.employeeName || employee?.name || "Sin asignar"
    };
  });

  const allAppointments = [...appointments, ...completedAppointments];

  const orders = db.data.orders.map((order) => {
    const client = userMap.get(order.userId);
    return {
      ...order,
      clientName: client?.name || "Cliente",
      clientEmail: client?.email || "Sin email"
    };
  });

  const donations = db.data.donations || [];
  const contactMessages = (db.data.contactMessages || [])
    .map((entry) => {
      const client = userMap.get(entry.userId);
      return {
        ...entry,
        clientName: entry.clientSnapshot?.name || client?.name || "Cliente",
        clientEmail: entry.clientSnapshot?.email || client?.email || "Sin email",
        clientPhone: entry.clientSnapshot?.phone || client?.phone || "",
        clientBirthDate: entry.clientSnapshot?.birthDate || client?.birthDate || "",
        clientDescription: entry.clientSnapshot?.description || client?.description || ""
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const makeTotals = (period) => {
    const periodUsers = users.filter((user) => {
      const flags = getPeriodFlags(new Date(user.createdAt), now);
      return flags[period];
    });

    const periodAppointments = allAppointments.filter((appointment) => {
      const flags = getPeriodFlags(new Date(appointment.scheduledAt), now);
      return flags[period];
    });

    const periodOrders = orders.filter((order) => {
      const flags = getPeriodFlags(new Date(order.createdAt), now);
      return flags[period];
    });

    const periodDonations = donations.filter((donation) => {
      const flags = getPeriodFlags(new Date(donation.createdAt), now);
      return flags[period];
    });

    return {
      newClients: periodUsers.length,
      appointments: periodAppointments.length,
      orders: periodOrders.length,
      revenue: Number(sum(periodOrders.map((order) => order.total || 0)).toFixed(2)),
      donations: Number(
        sum(periodDonations.map((donation) => donation.amount || 0)).toFixed(2)
      )
    };
  };

  const clientHistory = users.map((user) => ({
    client: user,
    appointments: allAppointments
      .filter((appointment) => appointment.userId === user.id)
      .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)),
    orders: orders
      .filter((order) => order.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }));

  return {
    overview: {
      clients: users.length,
      appointments: allAppointments.length,
      orders: orders.length,
      revenue: Number(sum(orders.map((order) => order.total || 0)).toFixed(2))
    },
    totals: {
      day: makeTotals("day"),
      week: makeTotals("week"),
      month: makeTotals("month"),
      year: makeTotals("year")
    },
    users,
    appointments,
    contactMessages,
    recentCompletedAppointments: completedAppointments
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
      .slice(0, 20),
    clientHistory
  };
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const toCsv = (headers, rows) => {
  const csvRows = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    csvRows.push(row.map(escapeCsv).join(","));
  }
  return csvRows.join("\n");
};

const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;

export const adminLogin = async (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error, "Datos admin invalidos"));
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail !== env.ADMIN_EMAIL.toLowerCase()) {
    return res.status(401).json({ error: "Credenciales admin invalidas" });
  }

  const hash = await getAdminPasswordHash();
  const validPassword = await bcrypt.compare(password, hash);

  if (!validPassword) {
    return res.status(401).json({ error: "Credenciales admin invalidas" });
  }

  const token = jwt.sign(
    {
      sub: "admin",
      role: "admin",
      email: env.ADMIN_EMAIL
    },
    env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  return res.status(200).json({
    message: "Login admin exitoso",
    token,
    admin: {
      email: env.ADMIN_EMAIL,
      role: "admin"
    }
  });
};

export const getAdminDashboard = (req, res) => {
  return res.status(200).json(toAdminData());
};

export const getAdminSettings = (_req, res) => {
  return res.status(200).json({
    services: db.data.services,
    products: db.data.products,
    promotions: db.data.promotions,
    employees: db.data.employees || [],
    ownerContact: db.data.ownerContact || {},
    pointsProgram: db.data.pointsProgram || {
      pointsPerAmount: 10,
      pointsPerUnit: 1,
      rewards: []
    }
  });
};

export const updateAdminPointsProgram = async (req, res) => {
  const parsed = adminPointsProgramSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const payload = parsed.data;
  const rewardIds = new Set();
  for (const reward of payload.rewards) {
    if (rewardIds.has(reward.id)) {
      return res.status(400).json({ error: `ID repetido en recompensas: ${reward.id}` });
    }
    rewardIds.add(reward.id);
  }

  const sortedRewards = [...payload.rewards].sort((a, b) => a.points - b.points);

  db.data.pointsProgram = {
    pointsPerAmount: payload.pointsPerAmount,
    pointsPerUnit: payload.pointsPerUnit,
    rewards: sortedRewards
  };

  await persist();
  return res.status(200).json({
    message: "Programa de puntos actualizado",
    pointsProgram: db.data.pointsProgram
  });
};

export const updateAdminOwnerContact = async (req, res) => {
  const parsed = adminOwnerContactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  db.data.ownerContact = {
    ...parsed.data
  };

  await persist();
  return res.status(200).json({
    message: "Datos del dueno actualizados",
    ownerContact: db.data.ownerContact
  });
};

export const createAdminEmployee = async (req, res) => {
  const parsed = adminEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const employee = {
    id: `emp-${randomUUID().slice(0, 8)}`,
    ...parsed.data
  };

  db.data.employees.push(employee);
  await persist();

  return res.status(201).json({ message: "Empleada creada", employee });
};

export const updateAdminEmployee = async (req, res) => {
  const parsed = adminEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const employee = db.data.employees.find((item) => item.id === req.params.id);
  if (!employee) {
    return res.status(404).json({ error: "Empleada no encontrada" });
  }

  Object.assign(employee, parsed.data);
  await persist();

  return res.status(200).json({ message: "Empleada actualizada", employee });
};

export const updateAdminAppointment = async (req, res) => {
  const parsed = adminAppointmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const appointment = db.data.appointments.find((item) => item.id === req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: "Cita no encontrada" });
  }

  const payload = parsed.data;
  const service = db.data.services.find((item) => item.id === appointment.serviceId);
  const durationMinutes = Number(service?.timeMinutes) || 60;

  const nextEmployeeId = payload.employeeId || appointment.employeeId;
  const nextStatus = payload.status || appointment.status || "scheduled";
  const nextScheduledAt = payload.scheduledAt || appointment.scheduledAt;

  const employee = (db.data.employees || []).find((item) => item.id === nextEmployeeId);
  if (!employee || !employee.active) {
    return res.status(404).json({ error: "Profesional no encontrada" });
  }

  const start = new Date(nextScheduledAt);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ error: "Fecha de cita invalida" });
  }

  if (nextStatus !== "cancelled") {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const hasConflict = db.data.appointments.some((entry) => {
      if (entry.id === appointment.id) return false;
      if (entry.employeeId !== employee.id) return false;
      if (!["scheduled", "confirmed"].includes(entry.status || "scheduled")) return false;

      const existingService = db.data.services.find((item) => item.id === entry.serviceId);
      const existingDuration = Number(existingService?.timeMinutes) || 60;
      const existingStart = new Date(entry.scheduledAt);
      const existingEnd = new Date(existingStart.getTime() + existingDuration * 60_000);
      return overlaps(start, end, existingStart, existingEnd);
    });

    if (hasConflict) {
      return res.status(409).json({ error: "La profesional ya tiene otra cita en ese horario" });
    }
  }

  if (nextStatus === "completed") {
    const completedRecord = {
      ...appointment,
      employeeId: employee.id,
      employeeName: employee.name,
      scheduledAt: start.toISOString(),
      status: "completed",
      notes: Object.prototype.hasOwnProperty.call(payload, "notes") ? payload.notes || "" : appointment.notes || "",
      completedAt: new Date().toISOString()
    };

    db.data.completedAppointments.push(completedRecord);
    db.data.appointments = db.data.appointments.filter((item) => item.id !== appointment.id);
    await persist();

    return res.status(200).json({
      message: "Cita completada y archivada",
      appointment: completedRecord
    });
  }

  appointment.employeeId = employee.id;
  appointment.employeeName = employee.name;
  appointment.scheduledAt = start.toISOString();
  appointment.status = nextStatus;
  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    appointment.notes = payload.notes || "";
  }

  await persist();

  return res.status(200).json({
    message: "Cita actualizada",
    appointment
  });
};

export const restoreCompletedAdminAppointment = async (req, res) => {
  const completed = (db.data.completedAppointments || []).find((item) => item.id === req.params.id);
  if (!completed) {
    return res.status(404).json({ error: "Cita completada no encontrada" });
  }

  const service = db.data.services.find((item) => item.id === completed.serviceId);
  const durationMinutes = Number(service?.timeMinutes) || 60;
  const employee = (db.data.employees || []).find((item) => item.id === completed.employeeId);

  if (!employee || !employee.active) {
    return res.status(404).json({ error: "No se puede restaurar porque la profesional ya no esta activa" });
  }

  const start = new Date(completed.scheduledAt);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ error: "Fecha de cita invalida" });
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const hasConflict = db.data.appointments.some((entry) => {
    if (entry.employeeId !== employee.id) return false;
    if (!["scheduled", "confirmed"].includes(entry.status || "scheduled")) return false;

    const existingService = db.data.services.find((item) => item.id === entry.serviceId);
    const existingDuration = Number(existingService?.timeMinutes) || 60;
    const existingStart = new Date(entry.scheduledAt);
    const existingEnd = new Date(existingStart.getTime() + existingDuration * 60_000);
    return overlaps(start, end, existingStart, existingEnd);
  });

  if (hasConflict) {
    return res.status(409).json({ error: "No se puede restaurar porque el horario ya esta ocupado" });
  }

  const restoredAppointment = {
    ...completed,
    status: "scheduled"
  };
  delete restoredAppointment.completedAt;

  db.data.appointments.push(restoredAppointment);
  db.data.completedAppointments = db.data.completedAppointments.filter((item) => item.id !== completed.id);
  await persist();

  return res.status(200).json({
    message: "Cita restaurada a activas",
    appointment: restoredAppointment
  });
};

export const deleteAdminAppointment = async (req, res) => {
  const activeBefore = db.data.appointments.length;
  const completedBefore = (db.data.completedAppointments || []).length;

  db.data.appointments = db.data.appointments.filter((item) => item.id !== req.params.id);
  db.data.completedAppointments = (db.data.completedAppointments || []).filter(
    (item) => item.id !== req.params.id
  );

  if (
    db.data.appointments.length === activeBefore &&
    (db.data.completedAppointments || []).length === completedBefore
  ) {
    return res.status(404).json({ error: "Cita no encontrada para borrar" });
  }

  await persist();
  return res.status(200).json({ message: "Cita borrada" });
};

export const updateAdminContactMessage = async (req, res) => {
  const parsed = adminContactMessageUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const message = (db.data.contactMessages || []).find((item) => item.id === req.params.id);
  if (!message) {
    return res.status(404).json({ error: "Mensaje de contacto no encontrado" });
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "status")) {
    message.status = parsed.data.status;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "adminNote")) {
    message.adminNote = parsed.data.adminNote || "";
  }

  message.updatedAt = new Date().toISOString();
  await persist();

  return res.status(200).json({ message: "Mensaje de contacto actualizado", contactMessage: message });
};

export const createAdminService = async (req, res) => {
  const parsed = adminServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const service = {
    id: `srv-${randomUUID().slice(0, 8)}`,
    ...parsed.data
  };

  db.data.services.push(service);
  await persist();

  return res.status(201).json({ message: "Servicio creado", service });
};

export const updateAdminService = async (req, res) => {
  const parsed = adminServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const service = db.data.services.find((item) => item.id === req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }

  Object.assign(service, parsed.data);
  await persist();

  return res.status(200).json({ message: "Servicio actualizado", service });
};

export const deleteAdminService = async (req, res) => {
  const service = db.data.services.find((item) => item.id === req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }

  db.data.services = db.data.services.filter((item) => item.id !== req.params.id);
  await persist();

  return res.status(200).json({ message: "Servicio eliminado" });
};

export const createAdminProduct = async (req, res) => {
  const parsed = adminProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const product = {
    id: `prd-${randomUUID().slice(0, 8)}`,
    ...parsed.data
  };

  db.data.products.push(product);
  await persist();

  return res.status(201).json({ message: "Producto creado", product });
};

export const updateAdminProduct = async (req, res) => {
  const parsed = adminProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const product = db.data.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  Object.assign(product, parsed.data);
  await persist();

  return res.status(200).json({ message: "Producto actualizado", product });
};

export const deleteAdminProduct = async (req, res) => {
  const product = db.data.products.find((item) => item.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  db.data.products = db.data.products.filter((item) => item.id !== req.params.id);
  await persist();

  return res.status(200).json({ message: "Producto eliminado" });
};

export const createAdminPromotion = async (req, res) => {
  const parsed = adminPromotionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const promotion = {
    id: `promo-${randomUUID().slice(0, 8)}`,
    ...parsed.data
  };

  db.data.promotions.push(promotion);
  await persist();

  return res.status(201).json({ message: "Promocion creada", promotion });
};

export const updateAdminPromotion = async (req, res) => {
  const parsed = adminPromotionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const promotion = db.data.promotions.find((item) => item.id === req.params.id);
  if (!promotion) {
    return res.status(404).json({ error: "Promocion no encontrada" });
  }

  Object.assign(promotion, parsed.data);
  await persist();

  return res.status(200).json({ message: "Promocion actualizada", promotion });
};

export const deleteAdminPromotion = async (req, res) => {
  const promotion = db.data.promotions.find((item) => item.id === req.params.id);
  if (!promotion) {
    return res.status(404).json({ error: "Promocion no encontrada" });
  }

  db.data.promotions = db.data.promotions.filter((item) => item.id !== req.params.id);
  await persist();

  return res.status(200).json({ message: "Promocion eliminada" });
};

export const deleteAdminEmployee = async (req, res) => {
  const employee = db.data.employees.find((item) => item.id === req.params.id);
  if (!employee) {
    return res.status(404).json({ error: "Empleada no encontrada" });
  }

  const hasLinkedAppointments = db.data.appointments.some(
    (appointment) => appointment.employeeId === req.params.id && ["scheduled", "confirmed"].includes(appointment.status || "scheduled")
  );

  if (hasLinkedAppointments) {
    return res.status(409).json({ error: "No se puede eliminar porque tiene citas activas" });
  }

  db.data.employees = db.data.employees.filter((item) => item.id !== req.params.id);
  await persist();

  return res.status(200).json({ message: "Empleada eliminada" });
};

export const exportAdminCsv = (req, res) => {
  const parsed = periodSchema.safeParse(req.query.period || "day");
  if (!parsed.success) {
    return res.status(400).json({ error: "Periodo invalido" });
  }

  const period = parsed.data;
  const data = toAdminData();
  const totals = data.totals[period];

  const rows = [
    ["Periodo", period],
    ["Nuevos clientes", totals.newClients],
    ["Citas", totals.appointments],
    ["Ventas", totals.orders],
    ["Ingresos", totals.revenue],
    ["Donaciones", totals.donations],
    ["", ""],
    ["Clientes", data.overview.clients],
    ["Citas totales", data.overview.appointments],
    ["Ventas totales", data.overview.orders],
    ["Ingresos totales", data.overview.revenue]
  ];

  const csv = toCsv(["Metric", "Value"], rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=esmenails-${period}-report.csv`
  );

  return res.status(200).send(csv);
};
