---
description: "Implementation tasks for reliable wake-up data foundation"
---

# Tasks: Надёжный фундамент данных пробуждения

**Input**: Design documents from `/specs/001-wake-data-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Required by the project constitution for domain state, analytics, authentication,
persistence and the critical wake-up journey.

**Organization**: Tasks are grouped by user story and produce independently testable increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites
- **[Story]**: Maps to a user story from spec.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a reproducible workspace without changing the prototype's visual behavior.

- [x] T001 Create Node/TypeScript and universal ignore rules in .gitignore
- [x] T002 Move the existing Vite application into apps/web/ and preserve its build entry points in apps/web/package.json
- [x] T003 Configure pnpm workspace packages and root scripts in pnpm-workspace.yaml and package.json
- [x] T004 [P] Create package manifests and TypeScript configs in apps/api/, packages/domain/, packages/contracts/, and packages/db/
- [x] T005 [P] Configure formatting, type checking and Vitest workspace files in prettier.config.mjs, tsconfig.base.json, and vitest.workspace.ts
- [x] T006 [P] Add local PostgreSQL and environment templates in compose.yaml, .env.example, and infra/README.md

**Checkpoint**: Existing web prototype builds from `apps/web`; all empty packages type-check.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared contracts, deterministic domain rules and trusted infrastructure.

**⚠️ CRITICAL**: No user story work begins until this phase passes its tests.

- [x] T007 [P] Define shared enums and API schemas in packages/contracts/src/index.ts
- [x] T008 [P] Define canonical domain entities and command results in packages/domain/src/model.ts
- [x] T009 [P] Write failing session transition tests in packages/domain/tests/session.test.ts
- [x] T010 [P] Write failing analytics attribution tests in packages/domain/tests/analytics.test.ts
- [x] T011 Implement deterministic session transitions in packages/domain/src/session/session.ts
- [x] T012 Implement reproducible analytics v1 in packages/domain/src/analytics/profile.ts
- [x] T013 [P] Define Drizzle tables, constraints and migration scripts in packages/db/src/schema.ts and packages/db/migrations/0000_wake_foundation.sql
- [x] T014 Implement transactional repository interfaces and PostgreSQL adapters in packages/domain/src/ports.ts and packages/db/src/repositories/
- [x] T015 [P] Create Fastify application composition, configuration, health route and privacy-safe errors in apps/api/src/app/
- [x] T016 [P] Write Telegram launch-data validation tests in apps/api/tests/auth/telegram.test.ts
- [x] T017 Implement Telegram launch-data validation and secure application sessions in apps/api/src/auth/
- [x] T018 Configure required CI checks in .github/workflows/ci.yml

**Checkpoint**: Domain tests pass; database constraints represent one active session and
idempotency; invalid Telegram launch data is rejected.

---

## Phase 3: User Story 1 - Открыть приложение и продолжить работу (Priority: P1) 🎯 MVP

**Goal**: A verified Telegram user can open the app, load only their profile and resume the latest
confirmed active-session checkpoint.

**Independent Test**: Start a session, accept baseline and one task result, recreate the client,
then verify bootstrap returns the same session at the next step. Invalid launch data returns no
profile.

### Tests for User Story 1

- [x] T019 [P] [US1] Write auth and bootstrap contract tests in apps/api/tests/contract/bootstrap.test.ts
- [x] T020 [P] [US1] Write cross-restart resume integration test in apps/api/tests/integration/resume.test.ts
- [x] T021 [P] [US1] Write mobile bootstrap/resume E2E test in tests/e2e/resume.spec.ts

### Implementation for User Story 1

- [x] T022 [US1] Implement user, assignment and active-session bootstrap repositories in packages/db/src/repositories/bootstrap.ts
- [x] T023 [US1] Implement auth and bootstrap routes in apps/api/src/auth/routes.ts and apps/api/src/app/bootstrap-route.ts
- [x] T024 [P] [US1] Create Telegram bridge and explicit development adapter in apps/web/src/telegram/
- [x] T025 [P] [US1] Create typed same-origin API client in apps/web/src/shared/api/
- [x] T026 [US1] Add bootstrap loading, authentication failure and resume decisions in apps/web/src/app/
- [x] T027 [US1] Replace production mock initialization with server bootstrap while retaining explicit demo mode in apps/web/src/features/bootstrap/

**Checkpoint**: User Story 1 passes independently and is the first deployable MVP slice.

---

## Phase 4: User Story 2 - Завершить сессию без потери данных (Priority: P1)

**Goal**: Every accepted rating, task result and follow-up survives retries and restarts without
duplicates or silent conflict overwrites.

**Independent Test**: Complete a session while repeating commands and sending one stale version;
verify one canonical observation per step and a resumable final state.

### Tests for User Story 2

- [x] T028 [P] [US2] Write session command contract tests in apps/api/tests/contract/sessions.test.ts
- [x] T029 [P] [US2] Write idempotency and optimistic-concurrency integration tests in apps/api/tests/integration/session-concurrency.test.ts
- [x] T030 [P] [US2] Write full wake-up and follow-up E2E test in tests/e2e/wake-session.spec.ts

### Implementation for User Story 2

- [x] T031 [US2] Implement atomic idempotent session command repository in packages/db/src/repositories/sessions.ts
- [x] T032 [US2] Implement create, baseline, task, post-rating, follow-up and abandon services in apps/api/src/sessions/service.ts
- [x] T033 [US2] Implement session command routes from contracts/openapi.yaml in apps/api/src/sessions/routes.ts
- [x] T034 [US2] Connect existing wake-up screens to server commands and version conflicts in apps/web/src/features/session/
- [x] T035 [US2] Implement explicit unsynchronized draft handling in apps/web/src/features/session/draft-store.ts
- [x] T036 [US2] Persist follow-up to the canonical session and surface due follow-up during bootstrap in apps/web/src/features/follow-up/

**Checkpoint**: User Stories 1 and 2 pass independently; confirmed data survives refresh and retry.

---

## Phase 5: User Story 3 - Получить честный профиль пробуждения (Priority: P2)

**Goal**: Users see reproducible protocol-level metrics and factor effects only when controlled,
comparable evidence exists.

**Independent Test**: Mixed sessions produce no category effect; three matched comparisons produce
a low-confidence factor result with reproducible evidence IDs.

### Tests for User Story 3

- [x] T037 [P] [US3] Add analytics fixture and regression tests in packages/domain/tests/analytics-fixtures.test.ts
- [x] T038 [P] [US3] Write analytics profile contract test in apps/api/tests/contract/analytics.test.ts
- [x] T039 [P] [US3] Write mixed-protocol profile E2E test in tests/e2e/analytics.spec.ts

### Implementation for User Story 3

- [x] T040 [US3] Implement learning assignments and comparable-factor metadata in packages/domain/src/experiments/learning.ts
- [x] T041 [US3] Implement analytics projection repository and recomputation in packages/db/src/repositories/analytics.ts
- [x] T042 [US3] Implement analytics profile route in apps/api/src/analytics/routes.ts
- [x] T043 [US3] Replace prototype category calculations with versioned API metrics in apps/web/src/features/analytics/

**Checkpoint**: Analytics values match manual fixtures and never credit every category in a mixed
protocol.

---

## Phase 6: User Story 4 - Управлять своей историей (Priority: P3)

**Goal**: A user can delete their profile and history without affecting another user.

**Independent Test**: Delete one of two fixture users, then verify the deleted user starts clean,
the other is unchanged and retained audit data cannot be linked to Telegram identity.

### Tests for User Story 4

- [x] T044 [P] [US4] Write isolated user-deletion integration test in apps/api/tests/integration/delete-user.test.ts
- [x] T045 [P] [US4] Write profile deletion E2E test in tests/e2e/delete-profile.spec.ts

### Implementation for User Story 4

- [x] T046 [US4] Implement transactional user deletion and audit anonymization in packages/db/src/repositories/delete-user.ts
- [x] T047 [US4] Implement DELETE /me workflow in apps/api/src/auth/delete-route.ts
- [x] T048 [US4] Add deletion confirmation and clean-profile reset in apps/web/src/features/profile/delete-profile.tsx

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify production-operational promises across all stories.

- [x] T049 [P] Add structured request and state-transition telemetry in apps/api/src/observability/
- [ ] T050 [P] Add mobile accessibility and error-state checks in apps/web/tests/
- [x] T051 Add schema backward-compatibility and backup-restore validation instructions in infra/README.md
- [ ] T052 Run every scenario in specs/001-wake-data-foundation/quickstart.md and record results in specs/001-wake-data-foundation/validation.md
- [ ] T053 Verify no secrets or mock histories enter production assets using scripts/verify-production-boundaries.mjs
- [ ] T054 Review all requirements FR-001 through FR-026 and success criteria SC-001 through SC-009 in specs/001-wake-data-foundation/validation.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: starts immediately.
- **Phase 2 Foundational**: depends on Phase 1 and blocks all user stories.
- **US1**: depends on Phase 2 and is the MVP.
- **US2**: depends on session domain/repositories from Phase 2; integrates with US1 bootstrap.
- **US3**: depends on completed-session source data but its domain tests can begin after Phase 2.
- **US4**: depends on user-owned persistence from Phase 2; otherwise independently testable.
- **Polish**: follows the set of stories selected for release.

### User Story Completion Order

```text
Setup -> Foundation -> US1 (bootstrap/resume) -> US2 (durable completion)
                         ├──────────────────────> US3 (honest analytics)
                         └──────────────────────> US4 (deletion)
All selected stories -> Polish and release validation
```

### Parallel Opportunities

- T004-T006 can run in parallel after the workspace layout is chosen.
- T007-T010, T013, T015 and T016 affect separate files.
- Contract, integration and E2E tests within each story can be authored in parallel.
- After Foundation, US3 domain work and US4 deletion work can proceed alongside US1/US2.

## Parallel Example: User Story 1

```text
T019: apps/api/tests/contract/bootstrap.test.ts
T020: apps/api/tests/integration/resume.test.ts
T021: tests/e2e/resume.spec.ts
T024: apps/web/src/telegram/
T025: apps/web/src/shared/api/
```

## Implementation Strategy

### MVP First

1. Complete Setup.
2. Complete Foundation with failing-then-passing tests.
3. Complete US1 bootstrap and resume.
4. Validate US1 independently before adding durable full-session commands.

### Incremental Delivery

1. US1 makes the application identifiable and resumable.
2. US2 makes the entire wake-up cycle durable.
3. US3 replaces misleading prototype analytics.
4. US4 provides the required user control.
5. Polish establishes production readiness.

## Notes

- Tests are written before the corresponding implementation.
- Every task includes an exact file or directory path.
- Completed tasks must be changed from `[ ]` to `[x]`.
- Commit after each phase or coherent vertical slice.
- Do not introduce Redis, a broker, microservices or AI recommendation calls in this feature.
