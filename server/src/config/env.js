import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret";
const encryptionSecret = process.env.ENCRYPTION_SECRET || "dev_encryption_secret";
const adminPassword = process.env.ADMIN_PASSWORD || "Admin!123";

if (isProduction) {
  const insecureDefaults = [];

  if (jwtSecret === "dev_jwt_secret") insecureDefaults.push("JWT_SECRET");
  if (encryptionSecret === "dev_encryption_secret") insecureDefaults.push("ENCRYPTION_SECRET");
  if (adminPassword === "Admin!123") insecureDefaults.push("ADMIN_PASSWORD");

  if (insecureDefaults.length > 0) {
    throw new Error(`Missing secure production variables: ${insecureDefaults.join(", ")}`);
  }
}

export const env = {
  PORT: process.env.PORT || "4000",
  JWT_SECRET: jwtSecret,
  ENCRYPTION_SECRET: encryptionSecret,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@esmenails.com",
  ADMIN_PASSWORD: adminPassword,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: Number(process.env.SMTP_PORT || "587"),
  SMTP_SECURE: process.env.SMTP_SECURE === "true",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "no-reply@esmenails.local",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini"
};
