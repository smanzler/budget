import { createTransport } from "nodemailer";
import { env } from "../env";

/**
 * The one SMTP transport, shared by everything that sends mail.
 *
 * Safe to construct at import: nodemailer opens a connection on the first
 * `sendMail`, not here — unlike `lib/boss.ts`, importing this has no side
 * effect and drags nothing into a test process.
 */
export const mailer = createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth:
    env.SMTP_USER && env.SMTP_PASSWORD
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
});
