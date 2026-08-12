import db from "../db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { expo } from "@better-auth/expo";
import { emailOTP } from "better-auth/plugins";
import * as schema from "../db/auth-schema";
import { createTransport } from "nodemailer";
import { env } from "../env";
import { renderOtpEmail } from "./otp-email";

const mailer = createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth:
    env.SMTP_USER && env.SMTP_PASSWORD
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  plugins: [
    expo(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === "sign-in" ? "Your sign in code" : "Verify your email";

        const { html, text } = renderOtpEmail({
          otp,
          heading: subject,
          expiresInMinutes: 5,
        });

        await mailer.sendMail({
          from: env.SMTP_FROM,
          to: email,
          subject,
          html,
          text,
        });
      },
    }),
  ],
  trustedOrigins: ["com.sigh10.template://"],
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});

declare module "fastify" {
  interface FastifyRequest {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
  }
}

export const authHook = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  request.user = session.user;
  request.session = session.session;
};
