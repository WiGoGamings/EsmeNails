import { randomUUID } from "node:crypto";
import { db, persist } from "../db/storage.js";
import { decryptText } from "../lib.crypto.js";
import { createContactMessageSchema } from "../schemas/contact.schema.js";

const safeDecrypt = (value) => {
  if (!value) return "";
  try {
    return decryptText(value);
  } catch {
    return "";
  }
};

export const getOwnerContactInfo = (_req, res) => {
  return res.status(200).json({
    ownerContact: db.data.ownerContact || {}
  });
};

export const createContactMessage = async (req, res) => {
  const parsed = createContactMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = db.data.users.find((entry) => entry.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const { subject, message, preferredContact } = parsed.data;
  const contactMessage = {
    id: randomUUID(),
    userId: user.id,
    subject,
    message,
    preferredContact,
    status: "new",
    clientSnapshot: {
      name: safeDecrypt(user.nameEnc),
      email: safeDecrypt(user.emailEnc),
      phone: safeDecrypt(user.phoneEnc),
      birthDate: user.birthDate || "",
      description: user.description || ""
    },
    createdAt: new Date().toISOString()
  };

  db.data.contactMessages.push(contactMessage);
  await persist();

  return res.status(201).json({
    message: "Mensaje enviado al equipo de EsmeNails",
    contactMessage
  });
};
