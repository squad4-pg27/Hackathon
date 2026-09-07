# CLAUDE.md — Time Ledger

Project instructions for Claude Code working in this repository.
These rules were created for the "Who Gets the Time?" hackathon build.
Preserve any future unrelated instructions added below; do not overwrite them.

## What this project is

**Time Ledger** — a single-operator meeting-request review desk.

An executive assistant inspects original evidence, sees identity uncertainty,
optionally uses a manually supplied AI brief, and records a **human** decision
with its reason and reserved minutes. The experiment tests whether synthesis
saves effort beyond organised retrieval plus the same decision checklist.

## Product boundary (hard limits)

The application must NEVER:

- Rank people, assign value scores, or sort by importance.
- Recommend acceptance or decline.
- Contact anyone or book meetings.
- Infer value from title, seniority, or from missing records.
- Learn priorities or change policy automatically. Only an explicit human
  policy change creates a new priority version.

Limitations that must be displayed plainly in the UI:

- Synthetic demonstration; single operator; no live calendar integration.
- Role selection simulates a role; it is not real authorisation.
- Remaining minutes reflect supplied records only, not actual calendar availability.
- Browser-held decisions are local to this browser/storage location.

## Technical constraints (hard limits)

- The runnable application is **one self-contained `index.html`** with inline
  HTML, CSS and ordinary JavaScript.
- No framework, npm, build step, CDN, backend, database, credentials or
  external assets. The application makes no service/API requests.
- It runs by **double-clicking `index.html`**. Never use `fetch()` or
  `XMLHttpRequest` to read local files. Imports use a file input + `FileReader`.
- Allowed supporting files (not runtime dependencies): `CLAUDE.md`,
  `data/*.csv`, `data/README.md`.
- Embed normal demo records as safely serialised JavaScript data.
  **Never embed the assessor evidence key** (`data/evidence_key.csv`) in
  `index.html`, in application state, in backups, or in copied packets.
- Render imported/embedded text with `textContent`, never as executable markup.
  Escape embedded fixtures so a closing script tag inside data cannot terminate
  the enclosing script element (e.g. `<\/script>`).
- Capacity, validation and state transitions use deterministic JavaScript,
  never a model.
- Keep data access, transitions, rendering and persistence as **separate
  functions** within the one file. The UI and the self-checks must call the
  **same** business logic — tests must not reimplement the rules they check.
- Manual use of an external model happens **outside** the application; it is
  optional and requires separate access to that service.
- Local inspection/browser tools (e.g. Playwright + Chromium) may be used for
  development, but must not become application dependencies. Do not install
  packages or introduce a server to evade these constraints.

## State machine (authoritative — agreed at Gate 3A)

States: `needs_review`, `provisional_approval`, `binding`, `declined`,
`deferred`, `delegation_pending`, `delegation_confirmed`.

**Reservation effect of each state — this is the whole of it:**

| State | Reserves leader minutes |
|---|---|
| `provisional_approval` | **Yes**, the recorded duration |
| `binding` | **Yes**, the recorded duration |
| `needs_review`, `declined`, `deferred`, `delegation_pending`, `delegation_confirmed` | **Zero** |

Capacity is computed from **current active reservations only**, never from
summed historical approvals. Each batch starts with **120 minutes remaining
after fixed commitments**; those commitments are context and are never
deducted again.

### Gate tokens used in the table

| Token | Requirement |
|---|---|
| **R** | A reason is required. Trimmed non-empty. Every transition needs one |
| **CAP** | Capacity check on the **increase only** (`new − currently held`). An increase must fit the remaining minutes. Blocked while the batch is in deficit |
| **REL** | Releases the outgoing reservation **explicitly**. The minutes released and the reason are recorded on the decision and in history |
| **KEEP** | Carries the existing reservation across **unchanged**. No new capacity check, and it can never reserve twice. Duration is locked during the move |
| **AMEND** | An explicit simulated leader-approved amendment: approver name, approver role and a separate amendment reason. **An ordinary edit can never satisfy this** |
| **OWN** | Owner and review date required |
| **ACK** | Explicit acknowledgement required: who acknowledged, and when |

### Allowed transitions

Rows are the current state, columns the target. `✕` means the move is not
allowed at all.

| from ↓ / to → | needs_review | provisional_approval | binding | declined | deferred | delegation_pending | delegation_confirmed |
|---|---|---|---|---|---|---|---|
| **needs_review** | ✕ | R + CAP | R + CAP | R | R + OWN | R + OWN | ✕ |
| **provisional_approval** | R + REL | R + CAP *(increase)* / REL *(decrease)* | **R + KEEP** | R + REL | R + OWN + REL | R + OWN + REL | ✕ |
| **binding** | R + AMEND + REL | R + AMEND + KEEP | R + AMEND + CAP *(increase)* / REL *(decrease)* | R + AMEND + REL | R + AMEND + OWN + REL | R + AMEND + OWN + REL | ✕ |
| **declined** | R | R + CAP | R + CAP | ✕ | R + OWN | R + OWN | ✕ |
| **deferred** | R | R + CAP | R + CAP | R | R + OWN *(change owner or date)* | R + OWN | ✕ |
| **delegation_pending** | R | R + CAP | R + CAP | R | R + OWN | R + OWN *(reassign or change date)* | **R + ACK** |
| **delegation_confirmed** | R | R + CAP | R + CAP | R | R + OWN | R + OWN *(re-delegate)* | ✕ |

Notes on specific cells:

- **`provisional_approval` → `binding` is the conversion.** It preserves the
  same reservation, so the duration field is locked during the move and no
  capacity is consumed a second time. To change the duration, amend the
  provisional first, then convert.
- **Nothing may enter `delegation_confirmed` except from `delegation_pending`.**
  Confirmation must follow a real acknowledgement, so there is no shortcut.
- **Every route out of `binding` carries AMEND**, because every such route
  either changes the binding duration or releases its reservation.
- **`declined` → `declined` is not offered.** There is nothing to amend but the
  reason, and reasons are part of the frozen record behind a decision.

### The off-record promise (a report, not an approval)

"Report off-record promise" records something the leader **already promised
outside this desk**. It is not a decision on a request and is labelled
distinctly in history. It collects: promise identifier, description, minutes,
reported-by role, and optionally a linked request.

- **It is never blocked by capacity, and succeeds into deficit.** It records
  what already happened; it does not ask for new time.
- **Unlinked promise** — reserves its own minutes directly against the batch.
- **Linked promise** — converts the linked request to `binding` at the
  promise's minutes, and the promise itself then contributes **zero** to
  capacity. This is the "convert or link, never reserve twice" rule:
  - linked request held a provisional reservation of the same minutes → net
    capacity change is **zero**;
  - linked request held no reservation → the request now reserves the
    promise's minutes, and the batch may go into deficit;
  - linked request is **already `binding`** → **refused.** Changing a binding
    duration requires the AMEND path, and reporting must not become a way
    around it.
- A promise may later be **released** (marked inactive) with a reason, which
  frees its minutes. This is how a deficit caused by an unlinked promise is
  reconciled.

### Deficit

A batch is in deficit when reserved minutes exceed 120.

- **Blocked while in deficit:** any transition whose reservation increase is
  above zero — that is every `CAP` cell, and any amendment that raises a
  duration.
- **Still usable in deficit:** every zero-reserving transition, every release
  or reduction, reporting an off-record promise, and releasing a promise.
- **Reconciliation is explicit.** Reducing or releasing a reservation is done
  through the ordinary transitions above, with their gates intact: a provisional
  release needs its reason, a binding change still needs its leader-approved
  amendment. There is no bulk "fix capacity" action.

### Priority versions and strategic exceptions

- Every decision records the **priority version in force** at the time.
- A **routine amendment is not a policy change** and never creates a version.
- A **strategic exception** is recorded on the decision itself, as a separate
  flagged explanation. It does not create a version either.
- **Only an explicit human policy change** — a person deliberately recording a
  new priority version and its summary — creates a new `priority_versions`
  entry. No decision, amendment or exception may do this as a side effect.

### Idempotency

Every action carries a **stable submission ID generated when its form is
opened**, not derived from its content. Re-submitting the same ID is a no-op
that reports "already recorded". Because IDs are per form instance, two
different legitimate requests are never merged just because their text matches.

## Evidence rules

- Retrieve personal history **only** via established identifiers. Name, domain
  or email similarity may only *suggest* candidates; unresolved identity needs
  explicit human confirmation with a recorded basis. Confirming identity does
  not verify relationship claims.
- Hide prior personal decisions until identity is established, showing
  "Prior decisions hidden — identity unconfirmed."
- Show only retrieved, identity-appropriate excerpts with source ID, date and
  full text. Unavailable sources appear as gaps, never as invented excerpts.
  Warn that inventory coverage itself may be incomplete.
- "Requester says" (assertions) is kept separate from "Documented in records"
  (a record is evidence, not guaranteed truth).
- Unreleased late requests never enter normal retrieval or copied packets.

## Gates

Work proceeds in numbered steps. **Stop at each GATE and wait for the operator
to type `continue`.** `continue` authorises the next step through its gate.

- GATE 0 — existing work, verification, gaps, checkpoint, CLAUDE.md handling
- GATE 1 — fixtures and every deliberate trap
- GATE 2 — eight-step click checklist for the core journey
- GATE 3A — transition table (before implementing it)
- GATE 3B — exact clicks for approve / convert / report promise / reconcile
- GATE 4 — checks for namesakes, assertions, gaps, hidden history, overdue work
- GATE 5 — clipboard fallback, invalid citations, stale packets, late release,
  run isolation, assessor review
- Step 6 — verification, fixes and delivery

## Honest test reporting

- Report only checks actually performed, as `PASS`, `FAIL`, `NOT IMPLEMENTED`
  or `UNVERIFIED`, each with the actual observation.
- Reading code, showing a screenshot, or intending a behaviour is **not** proof
  that a workflow works.
- A serialisation test is not proof of browser refresh recovery; actual reload
  must be tested in a browser or marked `UNVERIFIED`.
- Never claim zero bugs, production readiness, adoption, statistical validation
  or measured savings without evidence. 40% lower effort is a target, never an
  assumed result.
- If the evidence key was written by the builder, label it author-prepared and
  record any independent human review. An agent-authored key is not independent
  validation.

## Editing rules

- Make focused changes. Preserve working components and unrelated work.
- Before each editing step, give a short summary of changes, likely risks and
  verification. Keep private reasoning brief.
- Explain checks to a nontechnical operator as exact clicks and expected results.
- Ask questions only for material blockers, plus the gates above.
- Fix failures affecting data, evidence, capacity or the core journey before
  cosmetic issues; re-run affected tests and the core workflow afterwards.
- Defer visual polish, sophisticated filters, automated evaluation, complex
  roles and general-purpose imports before compromising the core workflow.
  Do not silently drop promised features.
- Self-checks must never reset, overwrite or clear the operator's active state
  or persistence; they use isolated fixtures and a separate test storage adapter.

## Git

- Develop on branch `claude/new-session-ctxdnm`.
- Checkpoint with explicitly named project files; never blindly stage the whole
  repository. Do not hide errors with `|| true`, do not change global Git
  configuration, and never claim a failed checkpoint succeeded.
- Do not publish externally without an explicit instruction.

## Assessor materials (never runtime assets)

`data/README.md` and `data/evidence_key.csv` are assessor materials. They are
never retrieval inputs, never embedded in `index.html`, never added to ordinary
state, backups or copied prompts. The key may be loaded only through a file
input, only after all evaluation runs are frozen. Hidden controls are workflow
separation, not access security.
