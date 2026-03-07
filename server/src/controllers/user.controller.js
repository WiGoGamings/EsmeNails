import { db, persist } from "../db/storage.js";
import { decryptText, encryptText, hashEmail } from "../lib.crypto.js";
import { sendEmailVerificationCode } from "../lib.mailer.js";
import { confirmEmailCodeSchema, updateProfileSchema } from "../schemas/user.schema.js";

const safeDecrypt = (value) => {
  if (!value) return "";
  try {
    return decryptText(value);
  } catch {
    return "";
  }
};

const profileFromUser = (user) => ({
  id: user.id,
  name: safeDecrypt(user.nameEnc),
  email: safeDecrypt(user.emailEnc),
  birthDate: user.birthDate || "",
  phone: safeDecrypt(user.phoneEnc),
  description: user.description || "",
  profileImageUrl: user.profileImageUrl || "",
  emailVerified: Boolean(user.emailVerified),
  phoneVerified: Boolean(user.phoneVerified),
  points: user.points
});

export const getMyProfile = (req, res) => {
  const user = db.data.users.find((entry) => entry.id === req.user.sub);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const orders = db.data.orders.filter((entry) => entry.userId === user.id);
  const appointments = db.data.appointments.filter((entry) => entry.userId === user.id);
  const completedAppointments = (db.data.completedAppointments || []).filter(
    (entry) => entry.userId === user.id
  );

  return res.status(200).json({
    profile: {
      ...profileFromUser(user),
      ordersCount: orders.length,
      appointmentsCount: appointments.length + completedAppointments.length
    }
  });
};

export const getMyHistory = (req, res) => {
  const user = db.data.users.find((entry) => entry.id === req.user.sub);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const activeAppointments = db.data.appointments
    .filter((entry) => entry.userId === user.id)
    .map((entry) => ({
      id: entry.id,
      type: "appointment",
      serviceName: entry.serviceName,
      employeeName: entry.employeeName || "Sin asignar",
      scheduledAt: entry.scheduledAt,
      status: entry.status || "scheduled",
      notes: entry.notes || "",
      createdAt: entry.createdAt,
      completedAt: ""
    }));

  const completedAppointments = (db.data.completedAppointments || [])
    .filter((entry) => entry.userId === user.id)
    .map((entry) => ({
      id: entry.id,
      type: "appointment",
      serviceName: entry.serviceName,
      employeeName: entry.employeeName || "Sin asignar",
      scheduledAt: entry.scheduledAt,
      status: entry.status || "completed",
      notes: entry.notes || "",
      createdAt: entry.createdAt,
      completedAt: entry.completedAt || ""
    }));

  const appointments = [...activeAppointments, ...completedAppointments].sort(
    (a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)
  );

  const orders = db.data.orders
    .filter((entry) => entry.userId === user.id)
    .map((entry) => ({
      id: entry.id,
      type: "order",
      subtotal: Number(entry.subtotal || 0),
      discount: Number(entry.discount || 0),
      donationAmount: Number(entry.donationAmount || 0),
      total: Number(entry.total || 0),
      pointsEarned: Number(entry.pointsEarned || 0),
      createdAt: entry.createdAt,
      items: Array.isArray(entry.items)
        ? entry.items.map((item) => ({
            kind: item.kind,
            name: item.name,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            lineTotal: Number(item.lineTotal || 0)
          }))
        : []
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalSpent = Number(
    orders.reduce((acc, entry) => acc + Number(entry.total || 0), 0).toFixed(2)
  );
  const totalPointsEarned = orders.reduce(
    (acc, entry) => acc + Number(entry.pointsEarned || 0),
    0
  );

  return res.status(200).json({
    history: {
      appointments,
      orders,
      summary: {
        appointments: appointments.length,
        completedAppointments: appointments.filter((entry) => entry.status === "completed").length,
        cancelledAppointments: appointments.filter((entry) => entry.status === "cancelled").length,
        orders: orders.length,
        totalSpent,
        totalPointsEarned
      }
    }
  });
};

export const updateMyProfile = async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    const flatten = parsed.error.flatten();
    const message =
      Object.values(flatten.fieldErrors).flat()[0] ||
      flatten.formErrors[0] ||
      "Datos de perfil invalidos";
    return res.status(400).json({ error: message, details: flatten });
  }

  const user = db.data.users.find((entry) => entry.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const next = parsed.data;
  const currentEmail = safeDecrypt(user.emailEnc);
  const currentPhone = safeDecrypt(user.phoneEnc);

  if (next.email.trim().toLowerCase() !== currentEmail.trim().toLowerCase()) {
    const nextEmailHash = hashEmail(next.email);
    const existing = db.data.users.find(
      (entry) => entry.id !== user.id && entry.emailHash === nextEmailHash
    );
    if (existing) {
      return res.status(409).json({ error: "Este correo ya fue registrado" });
    }

    user.emailHash = nextEmailHash;
    user.emailEnc = encryptText(next.email.trim().toLowerCase());
    user.emailVerified = false;
  }

  if (next.phone.trim() !== currentPhone.trim()) {
    user.phoneEnc = next.phone.trim() ? encryptText(next.phone.trim()) : "";
    user.phoneVerified = false;
  }

  user.nameEnc = encryptText(next.name.trim());
  user.birthDate = next.birthDate;
  user.description = next.description;
  user.profileImageUrl = next.profileImageUrl;

  await persist();

  return res.status(200).json({
    message: "Perfil actualizado",
    profile: profileFromUser(user)
  });
};

export const verifyMyEmail = async (req, res) => {
  const user = db.data.users.find((entry) => entry.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  if (!user.emailEnc) {
    return res.status(400).json({ error: "Primero agrega un correo valido" });
  }

  const email = safeDecrypt(user.emailEnc);
  const name = safeDecrypt(user.nameEnc);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  user.emailVerificationCode = code;
  user.emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  let mailResult;
  try {
    mailResult = await sendEmailVerificationCode({ email, name, code });
  } catch (error) {
    console.error("[EMAIL ERROR] No se pudo enviar codigo:", error?.message || error);
    mailResult = {
      delivered: false,
      provider: "dev-fallback-error"
    };
  }

  await persist();

  if (!mailResult.delivered) {
    return res.status(200).json({
      message: "Codigo generado en modo local. Puedes usarlo ahora mismo.",
      devCode: code
    });
  }

  return res.status(200).json({ message: "Codigo enviado al correo ingresado" });
};

export const confirmMyEmailCode = async (req, res) => {
  const parsed = confirmEmailCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    const flatten = parsed.error.flatten();
    const message =
      Object.values(flatten.fieldErrors).flat()[0] ||
      flatten.formErrors[0] ||
      "Codigo invalido";
    return res.status(400).json({ error: message, details: flatten });
  }

  const user = db.data.users.find((entry) => entry.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpiresAt) {
    return res.status(400).json({ error: "Primero solicita un codigo de verificacion" });
  }

  const expiresAt = new Date(user.emailVerificationExpiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    user.emailVerificationCode = "";
    user.emailVerificationExpiresAt = "";
    await persist();
    return res.status(400).json({ error: "El codigo expiro. Solicita uno nuevo" });
  }

  if (parsed.data.code !== user.emailVerificationCode) {
    return res.status(400).json({ error: "El codigo ingresado es incorrecto" });
  }

  user.emailVerified = true;
  user.emailVerificationCode = "";
  user.emailVerificationExpiresAt = "";
  await persist();
  return res.status(200).json({ message: "Correo verificado" });
};

export const verifyMyPhone = async (req, res) => {
  const user = db.data.users.find((entry) => entry.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  if (!user.phoneEnc) {
    return res.status(400).json({ error: "Primero agrega un numero de telefono" });
  }

  user.phoneVerified = true;
  await persist();
  return res.status(200).json({ message: "Telefono verificado" });
};
