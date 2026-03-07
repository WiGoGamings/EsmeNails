import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { db, persist } from "../db/storage.js";
import { decryptText, encryptText, hashEmail } from "../lib.crypto.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

const firstValidationMessage = (flattenedError) => {
  const fieldErrors = Object.values(flattenedError.fieldErrors || {}).flat();
  return fieldErrors[0] || flattenedError.formErrors?.[0] || "Datos invalidos";
};

export const register = async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return res.status(400).json({
      error: firstValidationMessage(flattened),
      details: flattened
    });
  }

  const { name, email, password } = parsed.data;
  const emailKey = hashEmail(email);
  const existing = db.data.users.find((user) => user.emailHash === emailKey);

  if (existing) {
    return res.status(409).json({ error: "Este correo ya fue registrado" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = {
    id: randomUUID(),
    emailHash: emailKey,
    emailEnc: encryptText(email.trim().toLowerCase()),
    nameEnc: encryptText(name.trim()),
    birthDate: "",
    phoneEnc: "",
    description: "",
    profileImageUrl: "",
    emailVerified: false,
    phoneVerified: false,
    passwordHash,
    points: 0,
    createdAt: new Date().toISOString()
  };

  db.data.users.push(user);
  await persist();

  return res.status(201).json({
    message: "Registro exitoso",
    user: {
      id: user.id,
      name: decryptText(user.nameEnc),
      email: decryptText(user.emailEnc),
      points: user.points
    }
  });
};

export const login = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return res.status(400).json({
      error: firstValidationMessage(flattened),
      details: flattened
    });
  }

  const { email, password } = parsed.data;
  const emailKey = hashEmail(email);
  const user = db.data.users.find((item) => item.emailHash === emailKey);

  if (!user) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });

  return res.status(200).json({
    message: "Login exitoso",
    token,
    user: {
      id: user.id,
      name: decryptText(user.nameEnc),
      email: decryptText(user.emailEnc),
      points: user.points
    }
  });
};
