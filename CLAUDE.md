# budget

## Frontend styling

Prefer `className` over the `style` prop for frontend styling whenever possible.

## Verification

Never start a dev server (`pnpm dev`, `expo start`, `vite dev`/`preview`, `next dev`, `docker compose up`, `./dev.sh`, etc.) or use the `run` skill — the user runs these manually. For verification, only use the lint and typecheck scripts already defined in package.json (`pnpm lint`, `pnpm typecheck`, `pnpm test`, or the per-app equivalents).

## Tests

Add tests when it makes sense and they provide real value — not for the sake of coverage. Don't add tests for trivial code or scenarios that can't happen.

Put test files in a `__tests__` directory beside the code under test, named
`<module>.test.ts` — not colocated next to the module.

## Database migrations

Never run database migrations yourself. If a schema change requires a migration, tell the user and let them run it manually.
