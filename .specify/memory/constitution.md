<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles:
  - Placeholder Principle 1 -> I. Reliable Wake-Up Continuity
  - Placeholder Principle 2 -> II. Truthful Experimentation
  - Placeholder Principle 3 -> III. Privacy and Security by Default
  - Placeholder Principle 4 -> IV. Modular Domain Architecture
  - Placeholder Principle 5 -> V. Testable and Observable Delivery
- Added sections:
  - Product and Data Constraints
  - Specification-Driven Delivery
- Removed sections: none
- Follow-up TODOs: none
-->
# Adaptive Wake Coach Constitution

## Core Principles

### I. Reliable Wake-Up Continuity
The product MUST remain usable whenever an authenticated user opens the Telegram Mini App.
Completed data MUST survive refreshes, reconnects, deployments, and device changes. An interrupted
wake-up session MUST either resume from a safely persisted checkpoint or restart with an explicit
user choice; it MUST NOT silently fabricate completion or lose accepted answers. Every production
plan MUST define measurable availability, recovery, backup, and degradation targets before release.

Rationale: a wake-up product is used at a time-sensitive moment. Unavailable service or silent data
loss destroys trust and invalidates the user's learning history.

### II. Truthful Experimentation
Raw observations, derived metrics, and recommendations MUST be distinguishable and traceable.
Mock data MUST never enter a real user's profile. A session-level outcome MUST NOT be attributed
causally to every action in a mixed protocol unless the experiment design supports that conclusion.
Algorithms MUST expose sample size, confidence, and the limits of any conclusion. Changes to
protocol selection or metric formulas MUST be versioned so historical results remain reproducible.

Rationale: personalization is the core product promise; misleading analytics are a product defect,
not merely an implementation detail.

### III. Privacy and Security by Default
Telegram identity MUST be verified on a trusted server before user data is read or written. Client-
supplied identity, scores, and session ownership MUST NOT be trusted without validation. Secrets
and privileged credentials MUST never be shipped to the client. The system MUST collect only data
needed for wake-up personalization, protect it in transit and at rest, and provide documented
retention and deletion behavior. Logs and analytics MUST exclude authentication material and avoid
personally identifying content unless explicitly required and protected.

Rationale: wake times, behavior, and sleep-related responses are personal data and require a clear
trust boundary from the first production release.

### IV. Modular Domain Architecture
Wake-up domain rules MUST be independent from screen components, Telegram APIs, persistence
vendors, and deployment providers. The application MUST have one canonical, versioned domain
model for users, protocols, sessions, task results, follow-ups, experiments, and recommendations.
State transitions and analytics MUST be expressed as deterministic domain operations with explicit
inputs and outputs. Persistence schemas MUST support migrations and backward-compatible reads.

Rationale: separating domain logic from delivery and infrastructure allows the prototype to evolve
without rewriting the learning engine or coupling product decisions to a single vendor.

### V. Testable and Observable Delivery
Every requirement that changes session state, identity, persistence, or analytics MUST have
automated tests at the appropriate boundary. Analytics formulas and state transitions MUST have
deterministic unit tests; authentication and persistence MUST have integration tests; the critical
wake-up journey MUST have an end-to-end smoke test. Production failures MUST be observable through
structured, privacy-safe telemetry, and releases MUST support rollback without corrupting user data.
No change may merge into the development branch with failing required checks.

Rationale: the product cannot learn reliably from behavior that the team cannot verify or diagnose.

## Product and Data Constraints

- Telegram Mini App is the first delivery channel, but domain behavior MUST remain portable to
  another web or mobile shell.
- The initial production scope is wake-up measurement and experimentation: baseline alertness,
  protocol execution, post-protocol alertness, delayed follow-up, and derived recommendations.
- Productivity planning, medical diagnosis, and unsupported claims about sleep health are outside
  the initial product scope.
- Server timestamps MUST be canonical; user timezone and locale MUST be stored or supplied
  explicitly for scheduling and display.
- Writes that may be retried MUST be idempotent. Duplicate requests MUST NOT create duplicate
  sessions, task results, or follow-up answers.
- Derived analytics MUST be recomputable from preserved source observations.
- A recommendation MUST always have a deterministic safe fallback when personalized evidence is
  insufficient or the recommendation service is unavailable.

## Specification-Driven Delivery

1. Every material change MUST begin with a reviewed specification containing testable user
   scenarios, explicit scope, assumptions, edge cases, and measurable success criteria.
2. A technical plan MUST document trust boundaries, data ownership, failure modes, migrations,
   observability, and rollback for affected paths.
3. Tasks MUST preserve vertical slices of user value and include their verification work.
4. Implementation MUST keep the application runnable while the Figma prototype is incrementally
   replaced; large unverified rewrites require explicit justification.
5. Code review MUST verify constitution compliance and identify any intentional exception.
   Exceptions require written rationale, an owner, and a removal or review date.

## Governance

This constitution supersedes conflicting repository conventions and generated template guidance.
Amendments require a documented proposal, review of affected specifications and migrations, and
explicit approval from the project owner. Constitution versions follow semantic versioning:
MAJOR for incompatible governance changes or removed principles, MINOR for new principles or
materially expanded obligations, and PATCH for non-semantic clarifications.

Each specification and plan MUST include a constitution check before implementation. Each release
candidate MUST demonstrate compliance with applicable reliability, privacy, data integrity, and
testing rules. Known violations MUST block release unless governed by a time-bounded written
exception. The constitution MUST be reviewed whenever the product adds a new client, a new class
of personal data, or a materially different personalization method.

**Version**: 1.0.0 | **Ratified**: 2026-08-27 | **Last Amended**: 2026-08-27
