# Research: Надёжный фундамент данных пробуждения

## Decision 1: Modular monolith in a TypeScript workspace

**Decision**: Keep the existing React/Vite client, add a Fastify API, and place deterministic
session and analytics rules in shared TypeScript packages inside one pnpm workspace.

**Rationale**: One language reduces contract drift and setup cost. A modular monolith supplies the
required trust boundary and durable storage without distributed transactions or service discovery.
Node.js 22 is an LTS line, and Fastify provides schema validation, serialization, logging and
TypeScript support suitable for a small production API.

**Alternatives considered**:

- Serverless functions per route: rejected for the first slice because fragmented ownership and
  local testing would complicate transactions and authentication.
- Microservices: rejected because current scale and team size do not justify operational overhead.
- Backend-as-a-service directly from the browser: rejected because Telegram identity and ownership
  checks require a trusted server boundary.

**Sources**:

- https://nodejs.org/en/about/previous-releases
- https://fastify.dev/docs/latest/Reference/
- https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/

## Decision 2: Same-origin web and API with server-issued session

**Decision**: Send raw Telegram `initData` once to a same-origin API, validate it on the server,
check freshness, then issue a short-lived secure HTTP-only application session. The verified
Telegram user identifier is never accepted from a request body.

**Rationale**: Telegram explicitly marks `initDataUnsafe` as untrusted and requires server
validation of `initData`. Same-origin delivery avoids unnecessary cross-origin credential and
cookie complexity.

**Alternatives considered**:

- Trusting `initDataUnsafe.user.id`: rejected as insecure.
- Sending the bot token to the browser: rejected because it exposes a privileged secret.
- Revalidating a long-lived launch payload forever: rejected because replay risk grows with age.

**Source**: https://core.telegram.org/bots/webapps

## Decision 3: PostgreSQL as the canonical store

**Decision**: Use managed PostgreSQL with relational constraints, transactions, migrations and
backups. Use Drizzle as the thin typed query and migration layer.

**Rationale**: The domain has strong ownership and uniqueness rules, multi-record session
transitions and analytics over related observations. Transactions and database constraints make
idempotency and one-active-session guarantees enforceable. Drizzle keeps SQL visible and supports
transactional operations without introducing a separate service architecture.

**Alternatives considered**:

- Browser-only storage: rejected because it cannot provide cross-device recovery or durable
  ownership.
- Document database: rejected because relationships, constraints and reproducible aggregates are
  central to the model.
- Full event sourcing: rejected as unnecessary; immutable observation tables plus a session
  snapshot provide sufficient auditability.

**Sources**:

- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://orm.drizzle.team/docs/transactions

## Decision 4: Command-style state transitions with optimistic concurrency

**Decision**: Model session changes as explicit commands carrying an operation ID and expected
session version. Commit the snapshot update, observation and idempotency record atomically.

**Rationale**: Mobile networks retry requests, and Telegram users may reopen the Mini App on
another device. Idempotency prevents duplicates; version checks prevent a stale client from
silently overwriting newer state.

**Alternatives considered**:

- Last-write-wins: rejected because it can discard accepted answers.
- Client-generated complete session replacement: rejected because the client is untrusted and
  conflicts cannot be explained.
- Pessimistic locks held across user interactions: rejected because sessions last minutes.

## Decision 5: Immutable observations plus reproducible derived analytics

**Decision**: Preserve ratings, task results and follow-ups as source observations. Store derived
metrics only as disposable versioned projections. Attribute mixed-protocol outcomes to the exact
protocol; estimate category effects only from comparable within-user assignments.

**Rationale**: This directly prevents the current prototype bug where a whole session delta is
credited to every category present. Source observations allow formulas to be corrected and replayed
without changing history.

**Alternatives considered**:

- Store only displayed aggregates: rejected because results cannot be audited or recomputed.
- Credit all present categories: rejected because the experiment is confounded.
- Introduce a machine-learning model immediately: rejected because the initial sample is too small
  and explanations would be weaker than deterministic rules.

## Decision 6: Layered automated verification

**Decision**: Use Vitest for domain and component tests, Fastify's injection path with isolated
PostgreSQL for API integration, and Playwright for the mobile critical journey.

**Rationale**: The highest risks live in deterministic formulas, transaction boundaries and the
resume journey. These layers test each risk at the smallest reliable boundary. Vitest shares the
Vite transformation model; Playwright covers Chromium and WebKit mobile behavior.

**Alternatives considered**:

- End-to-end tests only: rejected because failures would be slow and hard to localize.
- Unit tests only: rejected because authentication, migrations and transaction guarantees cross
  component boundaries.

**Sources**:

- https://vitest.dev/guide/learn/writing-tests
- https://playwright.dev/docs/intro

## Decision 7: Managed hosting with no provider lock-in in the first plan

**Decision**: Require public same-origin HTTPS, edge delivery for the web client, an always-on
stateless API, managed PostgreSQL, backups, staging and monitoring. Select the provider only after
comparing regional availability, cost, database recovery and operational limits.

**Rationale**: These capabilities determine whether users can open the Mini App at any time. A
provider name does not change the application boundaries and can be chosen after the first vertical
slice produces realistic resource requirements.

**Alternatives considered**:

- Self-managed virtual machine and database: rejected for the MVP because patching, backup testing
  and failover would consume disproportionate effort.
- Provider-specific database APIs in domain code: rejected because they violate portability.
