# Data Model: Надёжный фундамент данных пробуждения

## Conventions

- Internal identifiers are UUIDs and never derived from Telegram IDs.
- All canonical timestamps are UTC instants; timezone is stored separately as an IANA identifier.
- Every user-owned row includes or resolves to `user_id`.
- Source observations are append-only. Corrections create an audit record and a superseding
  observation where the product permits correction.
- Enumerations and algorithm identifiers are versioned application contracts.

## User

Represents one verified Telegram user.

| Field                  | Type           | Rules                                                          |
| ---------------------- | -------------- | -------------------------------------------------------------- |
| id                     | UUID           | Primary identifier                                             |
| telegram_user_id       | 64-bit integer | Unique; written only after verified launch data                |
| locale                 | string         | Optional Telegram/user locale                                  |
| timezone               | string         | Valid IANA timezone; explicit user setting or detected default |
| learning_session_count | integer        | Non-negative cached count; recomputable                        |
| created_at             | timestamp      | Server-generated                                               |
| updated_at             | timestamp      | Server-generated                                               |
| deletion_requested_at  | timestamp      | Nullable                                                       |

Relationships: owns sessions, experiment assignments, idempotency records and derived projections.

## ProtocolDefinition

An immutable, versioned ordered protocol that can be assigned to sessions.

| Field        | Type               | Rules                              |
| ------------ | ------------------ | ---------------------------------- |
| id           | UUID               | Primary identifier                 |
| protocol_key | string             | Stable human-readable identity     |
| version      | integer            | Positive; unique with protocol_key |
| title        | string             | User-facing name                   |
| steps        | ordered collection | At least one ProtocolStep          |
| active_from  | timestamp          | Assignment availability            |
| retired_at   | timestamp          | Nullable                           |

### ProtocolStep

| Field         | Type    | Rules                                                                         |
| ------------- | ------- | ----------------------------------------------------------------------------- |
| index         | integer | Zero-based, unique inside protocol                                            |
| task_id       | enum    | math, memory, stroop, reaction, steps, squats, shake, water, window, curtains |
| category      | enum    | cognitive, movement, behavioral, environment                                  |
| configuration | object  | Versioned task parameters; no executable code                                 |

## ExperimentAssignment

Freezes the reason and protocol choice before the session starts.

| Field                  | Type      | Rules                                        |
| ---------------------- | --------- | -------------------------------------------- |
| id                     | UUID      | Primary identifier                           |
| user_id                | UUID      | Owner                                        |
| protocol_definition_id | UUID      | Exact assigned protocol version              |
| strategy_version       | string    | Versioned selection policy                   |
| experiment_phase       | enum      | learning, adaptive, fallback                 |
| hypothesis             | string    | Testable purpose shown/explained to user     |
| evaluated_factor       | string    | Nullable; only set for controlled comparison |
| comparison_group_key   | string    | Nullable; links comparable assignments       |
| evidence_snapshot      | object    | IDs/counts used at assignment time           |
| assigned_at            | timestamp | Server-generated                             |

An assignment belongs to at most one WakeSession.

## WakeSession

Canonical resumable snapshot of one wake-up cycle.

| Field                 | Type      | Rules                                                |
| --------------------- | --------- | ---------------------------------------------------- |
| id                    | UUID      | Primary identifier                                   |
| user_id               | UUID      | Owner                                                |
| assignment_id         | UUID      | Unique experiment assignment                         |
| status                | enum      | assigned, in_progress, protocol_completed, abandoned |
| current_step_index    | integer   | Between 0 and protocol length                        |
| version               | integer   | Starts at 1; increments on every accepted transition |
| started_at            | timestamp | Nullable until baseline accepted                     |
| protocol_completed_at | timestamp | Nullable until end rating accepted                   |
| follow_up_due_at      | timestamp | Nullable; protocol completion plus configured delay  |
| abandoned_at          | timestamp | Nullable                                             |
| created_at            | timestamp | Server-generated                                     |
| updated_at            | timestamp | Server-generated                                     |

Constraint: at most one session in `assigned` or `in_progress` per user.

### State transitions

```text
assigned
  ├── accept baseline rating ──> in_progress
  └── abandon ────────────────> abandoned

in_progress
  ├── accept next task result ─> in_progress (next step)
  ├── accept end rating after final step ─> protocol_completed
  └── abandon ────────────────> abandoned

protocol_completed
  └── follow-up may be appended once; session status remains protocol_completed
```

Invalid transitions return the canonical session and do not mutate source observations.

## RatingObservation

Immutable self-reported alertness.

| Field              | Type      | Rules                                 |
| ------------------ | --------- | ------------------------------------- |
| id                 | UUID      | Primary identifier                    |
| session_id         | UUID      | Owner session                         |
| kind               | enum      | baseline, post_protocol               |
| value              | integer   | 1 through 10                          |
| observed_at        | timestamp | Server receipt time                   |
| client_observed_at | timestamp | Optional device time, never canonical |
| operation_id       | string    | Unique within user                    |

Constraint: one active observation of each kind per session.

## TaskObservation

Immutable result for one assigned protocol step.

| Field               | Type      | Rules                                       |
| ------------------- | --------- | ------------------------------------------- |
| id                  | UUID      | Primary identifier                          |
| session_id          | UUID      | Owner session                               |
| protocol_step_index | integer   | Must equal expected step when accepted      |
| task_id             | enum      | Must match assigned protocol version        |
| category            | enum      | Copied from immutable protocol step         |
| correct             | integer   | Non-negative                                |
| total               | integer   | Non-negative and at least correct           |
| duration_ms         | integer   | Non-negative, bounded against invalid input |
| observed_at         | timestamp | Server receipt time                         |
| operation_id        | string    | Unique within user                          |

Constraint: one accepted observation per session and protocol step index.

## FollowUpObservation

Immutable delayed outcome for one protocol-completed session.

| Field                    | Type      | Rules                               |
| ------------------------ | --------- | ----------------------------------- |
| id                       | UUID      | Primary identifier                  |
| session_id               | UUID      | Unique                              |
| outcome                  | enum      | up, back, drowsy                    |
| observed_at              | timestamp | Server receipt time                 |
| minutes_after_completion | integer   | Derived from canonical server times |
| operation_id             | string    | Unique within user                  |

Early or late answers remain source data and are labeled by actual delay.

## IdempotencyRecord

Stores the result of a retriable command.

| Field           | Type      | Rules                                    |
| --------------- | --------- | ---------------------------------------- |
| user_id         | UUID      | Owner                                    |
| operation_id    | string    | Unique with user_id                      |
| command_type    | string    | Stable command name                      |
| request_hash    | string    | Detects key reuse with different content |
| response_status | integer   | Original response status                 |
| response_body   | object    | Original safe response                   |
| created_at      | timestamp | Server-generated                         |
| expires_at      | timestamp | Retention policy                         |

Reusing an operation ID with the same request returns the original result. Reusing it with different
content is a conflict.

## AnalyticsProjection

Disposable, versioned calculation output.

| Field          | Type       | Rules                                             |
| -------------- | ---------- | ------------------------------------------------- |
| id             | UUID       | Primary identifier                                |
| user_id        | UUID       | Owner                                             |
| metric_key     | string     | e.g. average_delta, rise_success, protocol_effect |
| subject_key    | string     | Profile, exact protocol or comparable factor      |
| method_version | string     | Required                                          |
| value          | object     | Metric-specific value                             |
| evidence_count | integer    | Non-negative                                      |
| evidence_ids   | collection | Source observation/session identifiers            |
| confidence     | enum       | insufficient, low, medium, high                   |
| computed_at    | timestamp  | Server-generated                                  |
| stale_at       | timestamp  | Nullable                                          |

Projections may be deleted and rebuilt without loss of source data.

## AuditEvent

Privacy-safe record of material server decisions.

| Field          | Type      | Rules                                                         |
| -------------- | --------- | ------------------------------------------------------------- |
| id             | UUID      | Primary identifier                                            |
| user_id        | UUID      | Nullable after deletion/anonymization                         |
| event_type     | string    | Authentication, transition, conflict, deletion, recomputation |
| aggregate_id   | UUID      | Nullable                                                      |
| correlation_id | string    | Request correlation                                           |
| metadata       | object    | No Telegram launch data, tokens or free-form personal content |
| created_at     | timestamp | Server-generated                                              |

## Derived definitions

- **Session delta**: post-protocol rating minus baseline rating.
- **Answered follow-up**: a session with one FollowUpObservation.
- **Successful rise**: follow-up outcome equals `up`.
- **Rise success rate**: successful rises divided by answered follow-ups.
- **Exact protocol evidence**: completed sessions sharing protocol key and version.
- **Comparable factor evidence**: within-user assignments in the same comparison group whose
  protocol definitions differ only by the evaluated factor.
- **Confidence v1**: insufficient below 3 comparable observations, low at 3-5, medium at 6-11,
  high at 12 or more.

## Deletion

Deletion first prevents new sessions, then removes or irreversibly anonymizes user-owned source
rows and projections according to the retention policy. Operational audit records may remain only
without a link to Telegram identity or recoverable wake-up content.
