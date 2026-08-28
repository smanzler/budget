import { defineConfig } from "vitest/config";
import type { Env } from "./src/env";

const testEnv: Record<keyof Env, string> = {
  BETTER_AUTH_SECRET: "test-secret",
  BETTER_AUTH_URL: "https://auth.test",

  DATABASE_URL: "postgres://test:test@localhost:25432/test",
  PORT: "24000",
  CLIENT_ORIGIN: "http://localhost:23000",

  BUCKET_REGION: "us-east-1",
  BUCKET_ACCESS_KEY_ID: "test-access-key-id",
  BUCKET_SECRET_KEY: "test-secret-key",
  BUCKET_NAME: "test-bucket",
  BUCKET_URL: "https://cdn.example.com",

  SMTP_HOST: "test",
  SMTP_PORT: "21025",
  SMTP_SECURE: "false",
  SMTP_USER: "test-user",
  SMTP_PASSWORD: "test-pass",
  SMTP_FROM: "test@example.com",

  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",

  APPLE_CLIENT_ID: "apple-client-id",
  APPLE_TEAM_ID: "apple-team-id",
  APPLE_KEY_ID: "apple-key-id",
  APPLE_PRIVATE_KEY: "apple-private-key",
  APPLE_APP_BUNDLE_IDENTIFIER: "com.test",
};

export default defineConfig({
  test: {
    env: testEnv,
  },
});
