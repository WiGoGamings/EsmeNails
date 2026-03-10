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

export const sendPaymentReceiptEmail = async ({ email, name, payment, pdfBuffer, fileName }) => {
  if (!email) {
    return {
      delivered: false,
      provider: "skipped-no-email"
    };
  }

  const subject = `Recibo de pago - ${payment?.serviceName || "Servicio"}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#2f120c;">
      <h2>Hola ${name || "clienta"},</h2>
      <p>Gracias por tu pago en EsmeNails.</p>
      <p><strong>Servicio:</strong> ${payment?.serviceName || "Servicio"}</p>
      <p><strong>Monto:</strong> $${Number(payment?.amount || 0).toFixed(2)}</p>
      <p><strong>Metodo:</strong> ${payment?.paymentMethodLabel || payment?.paymentMethod || "No definido"}</p>
      <p><strong>Fecha:</strong> ${new Date(payment?.paidAt || Date.now()).toLocaleString("es-ES")}</p>
      <p>Adjuntamos tu recibo en PDF.</p>
    </div>
  `;

  if (!transporter) {
    console.log(`[EMAIL DEV] Recibo de pago para ${email} (archivo: ${fileName || "recibo.pdf"})`);
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
    text: `Gracias por tu pago en EsmeNails. Servicio: ${payment?.serviceName || "Servicio"}. Monto: $${Number(payment?.amount || 0).toFixed(2)}. Metodo: ${payment?.paymentMethodLabel || payment?.paymentMethod || "No definido"}.`,
    attachments: [
      {
        filename: fileName || "recibo-esmenails.pdf",
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  });

  return {
    delivered: true,
    provider: "smtp"
  };
};
