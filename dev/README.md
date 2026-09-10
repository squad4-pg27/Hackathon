# Time Ledger — test kit

Development tooling. **The application does not use any of this.** `index.html`
stays one self-contained file with no dependencies; nothing in `dev/` is loaded
by it, referenced from it, or needed to run it. You can delete this whole folder
and the application still works.

---

## Running the tests

You need Node and Playwright's Chromium. Playwright is a development tool only.

```bash
npm install --no-save playwright
npx playwright install chromium

node dev/run-all.js              # every suite, one line per check
node dev/run-all.js --quiet      # summary table, plus any failures
node dev/run-all.js 03 05        # only suites 03 and 05
node dev/suites/03-state-machine.js   # one suite on its own

python3 dev/validate-fixtures.py # checks data/*.csv without a browser
```

The exit code is `0` if nothing failed, `1` if something did, `2` if the
harness itself could not run (usually Playwright missing — it says so).

Every suite opens `index.html` at its real `file://` address. **No server is
started at any point.** That is deliberate: the application has to work by
double-clicking the file, so it is tested that way.

---

## What each suite covers

| Suite | Covers |
|---|---|
| `01-core-journey.js` | The eight-step path: open, select, inspect evidence and identity uncertainty, the labelled brief placeholder, save a decision with a reason, correct remaining minutes, **a real page reload**, and **a real backup download, reset and restore**. Also whitespace-only reasons, rapid double clicks, a blocked over-capacity approval, hostile text, focus and layout, and **the warning before a refresh discards an unfinished entry** — raised when a typed reason is still on screen, silent when there is nothing to lose |
| `02-data-handling.js` | Importing a whole dataset only after validating it; each class of error named with its file and row; a wrong header stopping row checks; the coverage-ledger rules; the assessor key refused by the ordinary import; earlier input snapshots never erased; quoted multi-line CSV; five kinds of bad backup refused; storage that is already unreadable, left alone, with unrelated keys untouched |
| `03-state-machine.js` | The exact capacity scenario end to end, then the gates: conversion carrying a reservation across, a promise linked to an existing reservation converting rather than reserving twice, a promise unable to get around the amendment gate, ordinary edits unable to touch a binding, delegation needing an acknowledgement, and only an explicit policy change creating a priority version. Then **the ledger audit**: silent on an exercised ledger, and catching each structural fault deliberately introduced — a reservation with no batch of its own, a duration that is not whole minutes, an unrecognised state, and a linked promise whose minutes are reserved nowhere |
| `04-evidence-and-identity.js` | Namesakes staying separate, a domain-only link staying unverified, "cannot be resolved" as an explicit choice, requester assertions kept out of the records, coverage gaps, reviewer-recorded unknowns, the reason prompts and openers, conditional fields, overdue work resurfacing, what is kept behind a decision, later outcomes, and that no scoring or ranking feature exists |
| `05-briefs-and-runs.js` | Copying a packet and what it may and may not contain, the clipboard fallback, every brief fixture and its expected verdict, staleness and re-review, releasing the late request, run isolation, effort capture with elapsed time excluded, and the assessor gate including that the key never reaches state, storage or a backup. Also that **marking one dropdown leaves the page still and keeps focus on that dropdown**, with dozens of selects on screen |
| `06-self-checks.js` | Presses the application's own **Run self-checks** button and reports every row it produces, then confirms from outside that the operator's work and saved record were untouched |
| `07-control-audit.js` | Every button labelled, every field labelled, focus visible on every control reached, no horizontal overflow at 1280×720, and clicking every control (except the one-way ones) raising no errors |
| `08-stress.js` | Deliberate abuse: malformed and awkward CSV shapes, durations JavaScript would quietly reinterpret, markup vectors beyond a script tag, two windows saving at once, an exhausted storage quota, a 500-step random walk checked for invariant drift, the overdue boundary, hand-edited backups, a promise linked to a request in every state, a long session, brief checking under a megabyte of input, extreme text, and hammering the interface |

`dev/fixtures/README.md` documents the mock data, including what each broken
file breaks and what the application should say about it.

---

## How the checks are written

- **Verdicts are `PASS`, `FAIL`, `UNVERIFIED` or `NOT IMPLEMENTED`**, each with
  what was actually observed, not what was expected.
- **Suites drive the interface**, clicking real controls, because that is what
  an operator does. Where a rule has no matching control — re-submitting a
  stored submission id, for instance — the suite calls the engine function
  directly and the check text says so.
- **The checks assert outcomes, never re-derive rules.** A capacity check
  expects the literal number 70, rather than recomputing it from the same
  formula the application uses. A test that reimplements the rule it is
  checking cannot fail when that rule is wrong.
- **`UNVERIFIED` is used honestly.** Recovering work across a browser reload is
  reported by the in-page self-checks as UNVERIFIED, because writing to memory
  is not proof a browser keeps data. Suite 01 does perform a real reload, so it
  reports a genuine result — but only in the browser it ran in.

---

## What these tests do not tell you

- They ran in **Chromium**. Browser storage under a `file://` address is not
  guaranteed elsewhere; Safari and Firefox commonly restrict it, and neither
  has been tested. The application probes storage on load and reports what it
  finds rather than assuming.
- They check **behaviour, not judgement**. Nothing here can tell you whether
  the fixtures read as realistic or whether the evidence key's judgements are
  the right ones. Those need a person.
- A full pass is **not** a claim that the application is free of faults. **Seventeen
  faults have been found by these checks after the application was believed
  finished**, which is the point of having them.

---

## Faults these checks have found

Each one now has a permanent check, so it cannot come back unnoticed.

| Found by | Fault |
|---|---|
| In-page self-checks | A literal closing script tag in the self-check source ended the script element, leaving a blank page |
| In-page self-checks | `writeVerified` reported the previous saved record as preserved without checking the restore had taken |
| In-page self-checks | A brief bullet reading "none" was flagged as an uncited factual claim |
| Control audit | A file input with no label, and an unused screen-reader class that reported as overflowing |
| Brief fixtures | The packet's example citation line used real-looking identifiers with nothing marking them as illustrative, so a model copying the example would have its brief rejected |
| **Stress: CSV shapes** | **A line break inside a quoted value kept its carriage return.** Any spreadsheet saving CRLF put a stray `\r` inside the evidence text |
| **Stress: durations** | **`0x10` was quietly read as 16 minutes and `1e2` as 100.** A capacity figure was being silently reinterpreted |
| **Stress: two windows** | **Two windows open on the same file silently overwrote each other's work.** The second to save erased the first, with no warning |
| **Stress: backups** | **A hand-edited backup carrying a negative or impossible reservation was accepted**, producing negative reserved minutes and more than 120 remaining |

| **Stress: carried reservations** | **Converting a provisional hold to binding demanded a fresh statement of what it displaced**, contradicting the rule that a carried reservation is not a new one, and inviting two different answers about one reservation |
| **Stress: older records** | A saved record from before the displacement and question-owner fields existed rendered as **"question for undefined by undefined"** |
| **Stress: amending** | The displacement box was the only field not pre-filled when amending a decision, so an amendment invited a different answer about the same reservation |
| **Assessor review** | **Marking one dropdown rebuilt the whole page**, destroying all 60 selects on screen, dropping focus to the document body and moving the page 877 pixels. The assessor does this dozens of times in one run |
| **Core journey** | **A half-typed reason was discarded by a refresh with no warning.** Drafts are deliberately never saved, so there was nothing to recover |

| **Bug hunt: changed records** | **Importing records that no longer contain a decided request silently released its reserved minutes.** 45 minutes vanished from capacity, and the decision survived but was invisible everywhere |
| **Bug hunt: effort figures** | An effort entry of "twelve" was silently ignored, "-4" was subtracted and "1e2" read as 100 — silently making a run look cheaper than it was |
| **Bug hunt: policy versions** | A policy change dated before the one in force was accepted and announced as though new decisions would use it. They would not |
| **Bug hunt: assessor key** | A key written against a different set of records showed an empty table and a denominator of zero, with no indication that nothing matched |
| **Bug hunt: dead flag** | A question carried an `answered` flag that nothing in the application could ever set |

The last eleven were found by `08-stress.js` and the bug hunts behind it, and
are the reason it exists.
Two of the "failures" it reported first time were faults in the checks
themselves, not the application — both are noted in the suite where they
were corrected.

---

## Files written while testing

Downloads captured during a run go to `dev/.out/`, which is ignored by Git.
Delete it whenever you like.
