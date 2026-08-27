# Adaptive Wake Coach infrastructure

The application is a provider-neutral modular monolith:

- `apps/web` is served from public HTTPS edge hosting.
- `/api/*` routes to the stateless `apps/api` service under the same origin.
- PostgreSQL is the canonical store and must provide encrypted connections, automated backups and
  point-in-time recovery in production.

## Environments

Development, staging and production must use independent databases, secrets, Telegram bot
configuration and public origins. Production credentials never use values from `.env.example`.

## Local database

```bash
pnpm db:start
pnpm db:migrate
```

Stop the container with `pnpm db:stop`. The named volume intentionally survives ordinary stops.

## Production requirements

- Same-origin HTTPS delivery for web and API
- At least one always-on API instance; two instances when provider and pilot budget allow
- Managed PostgreSQL health monitoring and tested restore procedure
- Deployment health check and rollback to the prior application release
- Structured logs without Telegram launch payloads, bot tokens or wake-up answers

Provider selection remains deferred until staging measurements establish expected regional traffic,
database size and monthly cost.
