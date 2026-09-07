# Test fixtures (mock data)

Development material only. The application never loads any of this, and none
of it is a runtime dependency. Everything here is synthetic.

You can use these by hand as well as through the test suites: the CSV sets can
be dragged into the application's import control, and the brief and backup
files can be pasted or selected in the interface.

---

## `invalid-csv/` — a dataset with many kinds of error

Select all eight files in **Data, storage and backups → Choose all eight CSV
files**. The import must be **rejected**, must name every problem with its file
and row, and must leave your records and your work untouched.

| File | Row | What is wrong | What the application should say |
|---|---|---|---|
| `notes.csv` | N003 | `2026-13-99` — month 13, day 99 | `date must be YYYY-MM-DD, found "2026-13-99"` |
| `notes.csv` | N005 renamed to N004 | duplicate `note_id` | `Duplicate note_id "N004" (first seen on row 5)` |
| `notes.csv` | N010 | `contact_id` `C999` does not exist | `contact_id "C999" is not in contacts.csv` |
| `commitments.csv` | CM003 | `-45` minutes | `minutes must be a positive whole number, found "-45"` |
| `commitments.csv` | CM006 | `binding` is `no` | `binding must be TRUE or FALSE, found "no"` |
| `requests.csv` | R004 | `2026-09-07 13:55` is not an ISO date-time | `arrival must be YYYY-MM-DDTHH:MM:SS` |
| `accounts.csv` | ACC005 | `210000.50` is not a whole number | `annual_value must be a whole number or empty` |

Because `notes.csv` also loses a note that `source_inventory.csv` still points
at, the reference checks report that too. That is expected: one broken row
usually breaks something downstream.

## `invalid-header/` — a wrong column name

`requests.csv` has `minutes_needed` where the format requires
`minutes_requested`. The application must report the header and **stop there**
for that file: a file whose columns are wrong cannot be checked row by row.
This set is kept separate from `invalid-csv/` for exactly that reason — put a
header error in the same set and it hides all the value errors behind it.

## `invalid-inventory/` — two subtle coverage-ledger errors

Everything looks ordinary until the rules relating notes to sources are checked.

| Row | What is wrong | What the application should say |
|---|---|---|
| `S023` | not retrieved, yet claims note `N001` | `a source that was not retrieved must leave note_id empty, because no text was retrieved` |
| `S025` | marked retrieved while `exists` is FALSE | `a retrieved source must also exist` |

This set matters because these two rules are what stop the application
inventing an excerpt for a source nobody actually read.

---

## `briefs/` — sample replies from an external model

The application never produces these. They stand in for what a reviewer would
paste back after using a model **outside** the tool.

Each file uses placeholders that the test suite replaces with identifiers taken
from the packet the application actually produced:
`{{PACKET_ID}}`, `{{REQUEST_ID}}`, `{{CONTACT_ID}}`, `{{NOTE_1}}`, `{{NOTE_2}}`,
`{{GAP_ID}}`.

**To use one by hand**, copy an evidence packet first, then paste the file's
text and replace the placeholders with identifiers from that packet.

| File | What it is | Expected outcome |
|---|---|---|
| `valid.txt` | Well formed: returns the packet id, has all four sections, cites supplied identifiers, keeps the requester's claim attributed | **accepted** — "citations check out" |
| `unknown-citation.txt` | Cites `[NOTE:N999]` and `[DECISION:D999]`, which were never supplied | **rejected**, naming the unknown citations |
| `wrong-packet-id.txt` | Returns a different packet id | **rejected** — it was written against other evidence |
| `missing-packet-id.txt` | Returns no packet id at all | **rejected** — there is no way to tell what it was written from |
| `uncited-claims.txt` | Three factual bullets with no citation | **needs review**, with the offending bullets listed |
| `recommendation.txt` | Ranks the account, scores it 9/10, recommends accepting | **needs review**, flagged as a recommendation rather than an evidence brief |
| `absence-bullets.txt` | Bullets reading "None." and "Not in the records" | **accepted** — a statement of absence is not an uncited claim. This is a regression guard: it used to be flagged wrongly |
| `instruction-injection.txt` | Contains `IGNORE PREVIOUS INSTRUCTIONS…` and `<script>alert(1)</script>` | Both render as **visible text**; nothing executes and no handling changes |

## `backups/` — files that must not be allowed to replace your work

Select each in **Data, storage and backups → Restore from a backup file**. Each
must be refused, and your current work must be untouched.

| File | What is wrong | Expected message |
|---|---|---|
| `not-json.json` | Truncated part way through | "The file is not valid JSON" |
| `wrong-format.json` | `format` is another tool's | "Not a Time Ledger backup" |
| `wrong-schema.json` | `schemaVersion` 99 | "Backup schema version is 99" |
| `missing-snapshot.json` | `activeSnapshotId` names a snapshot that is not in the file | "does not match any snapshot" |
| `no-runs.json` | No runs at all | "The backup has no runs" |

There is deliberately **no valid backup file here**. A valid one has to be
exported by the application, because it carries identifiers and timestamps
generated at the time; the suites make their own and restore it.

---

## What is not here

- **No assessor answers.** `data/evidence_key.csv` stays where it is and is
  never copied into this folder.
- **No corrupt-storage fixture.** Unreadable browser storage is injected by the
  test at run time, because it lives in the browser rather than in a file.
