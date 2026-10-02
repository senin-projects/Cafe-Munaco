# Cafe Munaco Operations

A role-based restaurant operations app that keeps Cafe Munaco's front-of-house, cashier, kitchen, events, and inventory workflows in one place.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cafe-munaco` — React web app, Clerk account screens, role-aware operations UI
- `artifacts/api-server/src/routes` — shared Express API route handlers
- `lib/api-spec/openapi.yaml` — API contract; regenerate clients after changes
- `lib/db/src/schema` — PostgreSQL/Drizzle tables
- `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` — generated client and validation schemas

## Architecture decisions

- Clerk handles employee sign-in; API requests use Clerk session cookies.
- The first verified account is bootstrapped as admin when the staff roster is empty. Admins add each later employee's verified work email and role before that employee can access the system.
- Role checks are enforced in API middleware as well as the UI; frontend visibility alone is not an authorization boundary.
- Shift summaries and order views poll at a modest interval to reflect updates between stations without requiring WebSockets.

## Product

Staff can process orders, advance kitchen ticket statuses, manage table and event bookings (including birthdays and buffets), maintain menu availability, and track stock quantities, suppliers, and expiry dates for fresh items such as seafood.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Use the first verified employee account for initial admin setup; the roster is otherwise intentionally empty.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
