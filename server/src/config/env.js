import "dotenv/config";

export const env = {
  PORT: process.env.PORT || "4000",
  JWT_SECRET: process.env.JWT_SECRET || "dev_jwt_secret",
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET || "dev_encryption_secret",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@esmenails.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin!123",
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || "587"),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "no-reply@esmenails.local"
};
