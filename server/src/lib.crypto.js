import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./config/env.js";

const key = createHash("sha256").update(env.ENCRYPTION_SECRET).digest();

export const hashEmail = (email) => {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
};

export const encryptText = (text) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}.${authTag.toString("hex")}.${encrypted.toString("hex")}`;
};

export const decryptText = (payload) => {
  const [ivHex, tagHex, encryptedHex] = payload.split(".");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
};
