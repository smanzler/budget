# template

pnpm monorepo starting point: Expo mobile app, TanStack Start web app, Fastify +
tRPC API, shared types.

```
apps/mobile     Expo Router app — email OTP auth, push notifications
apps/web        TanStack Start (Vite) app — shadcn/Tailwind v4
packages/api    Fastify + tRPC + better-auth + Drizzle (Postgres)
packages/shared Types/schemas shared between the API and the clients
docker/         Local Postgres, pgAdmin and Mailpit
```

## What's wired up

- **Auth** — better-auth with email OTP. The API mails codes through SMTP
  (Mailpit locally); the mobile app has sign-in + verify screens, and everything
  under `app/(protected)` requires a session.
- **API** — tRPC router mounted at `/trpc`, `protectedProcedure` for
  session-guarded calls, better-auth routes at `/api/auth/*`.
- **Push notifications** — `notify()` writes a notification row and queues a
  delivery on pg-boss, which sends it via Expo. The mobile app registers its
  push token on launch.
- **File uploads** — `files.createUpload` / `files.confirmUpload` hand out
  presigned S3 URLs so clients upload straight to the bucket.

## Local setup

1. `pnpm install`
2. Copy the env examples and fill them in:
   - `cp docker/.env.example docker/.env`
   - `cp packages/api/.env.example packages/api/.env` — generate
     `BETTER_AUTH_SECRET` with `openssl rand -base64 32`
   - `cp apps/mobile/.env.example apps/mobile/.env`
3. `pnpm start` — Postgres (5432), pgAdmin (15433), Mailpit (8025)
4. Create the first migration, then apply it:
   `pnpm --filter @template/api exec drizzle-kit generate` and
   `pnpm --filter @template/api exec drizzle-kit migrate`
5. `pnpm dev` — runs docker, API, mobile and web in tmux panes

Sign-in codes land in Mailpit at http://localhost:8025.

## Per-project setup checklist

Things that can't be inherited from the template — do these once per project:

- [ ] **Expo/EAS**: run `eas init` in `apps/mobile` to create the project and
      fill in `extra.eas.projectId` (push tokens and EAS builds need it). Check
      `owner`, `name`, `slug`, `scheme` and the bundle/package IDs in
      `app.config.ts`.
- [ ] **Android push**: add `google-services.json` to `apps/mobile` and
      re-enable `android.googleServicesFile` in `app.config.ts`.
- [ ] **Icons**: replace the images in `packages/shared/assets/images` (app
      icon, splash, adaptive icons, favicon, and `icon-email.png` used in the
      OTP email).
- [ ] **Fly.io**: `app` in `packages/api/fly.toml` must be an app that exists
      (`fly apps create <name>`), then set the `FLY_API_TOKEN` and
      `DATABASE_URL` GitHub secrets.
- [ ] **Vercel**: set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
      GitHub secrets for the web deploy, and `EXPO_TOKEN` for mobile OTA.
- [ ] **S3**: create a bucket and fill in the `BUCKET_*` env vars, or delete
      `packages/api/src/lib/s3.ts` and the `files` router if you don't need
      uploads.

## Notes

- Postgres runs the stock `postgres:16` image. Need PostGIS or another
  extension? Point the `database` service at a custom image and add a
  `CREATE EXTENSION` line to `docker/postgres/init.sql`.
- `packages/shared/src/notify.ts` defines the notification payload union — add a
  variant per notification type your app sends, then handle it in
  `renderNotification` in `packages/api/src/lib/notify.ts`.
- Social sign-in (Google/Apple) isn't included. better-auth's `socialProviders`
  is the place to add it back.

## Scripts

`pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm check` (prettier) — all run
across every workspace.
