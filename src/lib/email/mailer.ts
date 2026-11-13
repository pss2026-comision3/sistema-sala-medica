import nodemailer, { type Transporter } from "nodemailer";

// Evita crear un transporter nuevo en cada hot-reload de `next dev`
const globalForMailer = globalThis as unknown as { __mailer?: Transporter };

export const mailer: Transporter =
  globalForMailer.__mailer ??
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true", // true solo para puerto 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

if (process.env.NODE_ENV !== "production") globalForMailer.__mailer = mailer;

export const MAIL_FROM =
  process.env.MAIL_FROM ?? "Sala Médica <no-reply@sala-medica.local>";
