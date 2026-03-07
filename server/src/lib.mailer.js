import nodemailer from "nodemailer";
import { env } from "./config/env.js";

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    })
  : null;

export const sendEmailVerificationCode = async ({ email, name, code }) => {
  const subject = "Codigo de verificacion - EsmeNails";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#2f120c;">
      <h2>Hola ${name || "clienta"},</h2>
      <p>Tu codigo de verificacion para EsmeNails es:</p>
      <p style="font-size:28px; font-weight:700; letter-spacing:4px;">${code}</p>
      <p>Este codigo vence en 10 minutos.</p>
    </div>
  `;

  if (!transporter) {
    console.log(`[EMAIL DEV] Codigo para ${email}: ${code}`);
    return {
      delivered: false,
      provider: "dev-console"
    };
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject,
    html,
    text: `Tu codigo de verificacion de EsmeNails es: ${code}. Vence en 10 minutos.`
  });

  return {
    delivered: true,
    provider: "smtp"
  };
};
