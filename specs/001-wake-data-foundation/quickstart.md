# Quickstart Validation: Надёжный фундамент данных пробуждения

This guide defines the runnable validation path the implementation must provide. Commands become
available as their corresponding tasks are completed.

## Prerequisites

- Node.js 22 LTS
- pnpm 11
- Docker-compatible local container runtime
- A test Telegram bot token only for real launch-data verification

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm db:start
pnpm db:migrate
pnpm dev
```

Expected:

- Web client is available at the printed local URL.
- API health check reports ready.
- Database migration status is current.
- Demo authentication is explicitly labeled and is unavailable in production mode.

## Required automated checks

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

Expected: every command exits successfully. Unit tests do not require network access. Integration
tests use an isolated database. End-to-end tests use a mobile viewport and a deterministic test
authentication adapter.

## Scenario 1: Verified bootstrap

1. Open the web app with deterministic valid test launch data.
2. Confirm the bootstrap response contains a clean user profile and no mock sessions.
3. Repeat with invalid and expired launch data.

Expected: valid data creates/loads only its owner. Invalid or expired data returns an authentication
error and no profile payload.

Contract references: `POST /api/v1/auth/telegram`, `GET /api/v1/bootstrap`.

## Scenario 2: Resume an interrupted session

1. Create a session with an operation ID.
2. Submit a baseline rating with the returned state version.
3. Submit the first assigned task result.
4. Close the client and request bootstrap again.

Expected: exactly one active session is returned at the next step with the confirmed rating and task
observation preserved.

Contract references: session create, baseline and task-result operations in `contracts/openapi.yaml`.

## Scenario 3: Duplicate and stale commands

1. Send the same task result twice with the same operation ID and body.
2. Reuse the operation ID with a different body.
3. Send a new operation using an old expected session version.

Expected:

- Identical retry returns the original successful response and creates no duplicate.
- Changed content with reused key returns a conflict.
- Stale version returns the canonical session and does not overwrite it.

## Scenario 4: Complete session and follow-up

1. Complete all assigned steps.
2. Submit the post-protocol rating.
3. Reopen after follow-up due time.
4. Submit outcome `up`.

Expected: session delta is available after protocol completion; due follow-up appears in bootstrap;
success rate includes the session only after the answer is saved.

## Scenario 5: Honest mixed-protocol analytics

1. Seed completed sessions containing movement and cognitive actions together without matched
   comparison assignments.
2. Request the analytics profile.
3. Add matched assignments differing only by movement.
4. Request the profile again.

Expected:

- First response exposes exact-protocol descriptive results but no movement causal value.
- Category effect appears only after at least three comparable observations and is labeled low
  confidence until six.
- Evidence identifiers and method version reproduce the displayed value.

## Scenario 6: User deletion

1. Create two independent users with sessions.
2. Request deletion for the first user.
3. Complete the deletion workflow.
4. Authenticate both users again.

Expected: the first user starts with a clean profile; the second user's profile is unchanged; no
remaining audit record can be linked back to the deleted Telegram identity.

## Production readiness check

Before pilot release, verify:

- public HTTPS URL opens from the configured Telegram Main Mini App;
- server rejects modified and expired `initData`;
- staging backup can be restored into an isolated database;
- previous application release reads the migrated schema;
- alerts fire for failed health checks, elevated save failures and database unavailability;
- no bot token, launch payload or database credential appears in client assets or logs.
