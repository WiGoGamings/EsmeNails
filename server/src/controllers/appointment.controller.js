import { randomUUID } from "node:crypto";
import { db, persist } from "../db/storage.js";
import { decryptText } from "../lib.crypto.js";
import { createAppointmentSchema } from "../schemas/appointment.schema.js";

const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;
const safeDecrypt = (value) => {
  if (!value) return "";
  try {
    return decryptText(value);
  } catch {
    return "";
  }
};

export const createAppointment = async (req, res) => {
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { serviceId, employeeId, scheduledAt, notes } = parsed.data;
  const service = db.data.services.find((entry) => entry.id === serviceId);
  const employee = (db.data.employees || []).find((entry) => entry.id === employeeId);

  if (!service) {
    return res.status(404).json({ error: "Servicio no encontrado" });
  }

  if (!employee || !employee.active) {
    return res.status(404).json({ error: "Profesional no encontrada" });
  }

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime()) || date < new Date()) {
    return res.status(400).json({ error: "Fecha de cita invalida" });
  }

  const requestedDuration = Number(service.timeMinutes) || 60;
  const requestedEnd = new Date(date.getTime() + requestedDuration * 60_000);

  const hasConflict = db.data.appointments.some((entry) => {
    if (entry.status && entry.status !== "scheduled") {
      return false;
    }

    if ((entry.employeeId || "") !== employee.id) {
      return false;
    }

    const existingStart = new Date(entry.scheduledAt);
    if (Number.isNaN(existingStart.getTime())) {
      return false;
    }

    const existingService = db.data.services.find((serviceItem) => serviceItem.id === entry.serviceId);
    const existingDuration = Number(existingService?.timeMinutes) || 60;
    const existingEnd = new Date(existingStart.getTime() + existingDuration * 60_000);

    return overlaps(date, requestedEnd, existingStart, existingEnd);
  });

  if (hasConflict) {
    return res.status(409).json({ error: "Ese horario ya esta ocupado. Elige otro bloque disponible." });
  }

  const client = db.data.users.find((entry) => entry.id === req.user.sub);
  const clientSnapshot = {
    name: safeDecrypt(client?.nameEnc),
    email: safeDecrypt(client?.emailEnc),
    phone: safeDecrypt(client?.phoneEnc),
    birthDate: client?.birthDate || "",
    description: client?.description || ""
  };

  const appointment = {
    id: randomUUID(),
    userId: req.user.sub,
    serviceId: service.id,
    serviceName: service.name,
    employeeId: employee.id,
    employeeName: employee.name,
    clientSnapshot,
    scheduledAt: date.toISOString(),
    notes: notes || "",
    status: "scheduled",
    createdAt: new Date().toISOString()
  };

  db.data.appointments.push(appointment);
  await persist();

  return res.status(201).json({
    message: "Cita agendada",
    appointment
  });
};

export const getMyAppointments = (req, res) => {
  const appointments = db.data.appointments
    .filter((entry) => entry.userId === req.user.sub)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  return res.status(200).json({ appointments });
};
