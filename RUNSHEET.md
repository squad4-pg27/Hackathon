# Run sheet — conducting the experiment

Everything here is a decision already made for you. Follow it as written and the
four runs will be comparable.

**The question:** does an AI-written brief save effort beyond organised retrieval
plus the same decision checklist?

**The design:** two reviewers, two batches, both modes. Nobody does the same
batch twice.

| Run | Reviewer | Batch | Mode |
|---|---|---|---|
| RUN-1 | Reviewer 1 | A | baseline (no brief) |
| RUN-2 | Reviewer 1 | B | brief |
| RUN-3 | Reviewer 2 | A | brief |
| RUN-4 | Reviewer 2 | B | baseline (no brief) |

Compare **RUN-1 against RUN-3** (both batch A) and **RUN-2 against RUN-4** (both
batch B). Never compare across batches.

---

## Before the day

### 1. Have the evidence key reviewed — this blocks everything

`data/evidence_key.csv` was written by the builder of this demonstration. Until
someone else has read it, **every figure that comes out of it is author-prepared
and must be described that way.**

Ask a teammate to read `data/evidence_key.csv` against `data/README.md` and
answer one question per row: *is this genuinely the critical fact, and is the
required-unknown flag right?* Note what they changed or disputed.

Their name and what they found gets typed into the assessor panel later.

**They must not be one of your two reviewers.**

### 2. Give each reviewer their own copy

Runs are kept apart for decisions, capacity and history — but **not hidden from
each other.** Anyone can switch runs and read the other reviewer's reasons. That
would spoil the comparison.

So: make **two folders**, each with its own copy of `index.html`.

```
reviewer-1/index.html
reviewer-2/index.html
```

A different folder means different storage, so neither can see the other's work
even if they go looking. Each reviewer uses only their own copy.

> **Do not try to merge the two copies at the end.** Restoring a backup replaces
> everything; it does not merge. Each copy is assessed on its own and the two
> assessment exports are combined in a spreadsheet.

### 3. Do one dry run of the brief loop yourself

**No brief has ever been through a real AI.** The checking has been tested with
written-by-hand examples; whether a real model returns the format the packet asks
for has not been.

Take fifteen minutes and do it once, on any request in a brief run:

1. **Copy evidence for this request**. A packet is about 4,000 characters, so it
   pastes anywhere comfortably.
2. Paste it into whichever AI you have access to.
3. Paste the reply back and press **Check and save brief**.

**What you are looking for:** does it return the packet ID, use the four
headings, and cite only identifiers from the packet? If it does, you are ready.

**If it does not** — briefs come back rejected every time — then say so in your
write-up. That is a genuine finding about the workflow, not a failure of the
tool, and it is more interesting than a clean result. Do not quietly change the
experiment to hide it.

---

## Reviewer script — the same for every run

Give the reviewer the copy of `index.html` for them, and nothing else. **Never
show them `data/evidence_key.csv` or `data/README.md`.**

Say this to them:

> *"You are an executive assistant. The leader has 120 minutes left this week
> after their fixed commitments. Work through the requests and record a decision
> and a reason for each. There is no right answer. Several different allocations
> can each be defensible. Take as long as you need."*

Then:

**1. Pick their run** in the **Run** dropdown at the top right. Reviewer 1 does
RUN-1 first, then RUN-2. Reviewer 2 does RUN-3 first, then RUN-4.

**2. They decide the four initial requests.** Do not help. Do not hint. If they
ask what a control does, answer; if they ask what they should decide, do not.

Two fields will stop them if they skip them, and both are deliberate:

- **"What this displaces"** appears whenever an action reserves time. Reserving
  the leader's time means some other use of it does not happen, and naming that
  other use is part of the decision, not commentary on it. If genuinely nothing
  was competing, they say so — that is a valid answer and a recorded one.
- **A clarification needs somebody to answer it and a date.** The relationship
  owner from the records is offered by default and stays editable. Nothing is
  sent; it is recorded, and it sits on the unresolved list until someone acts.

Both are recorded as their own fields rather than buried inside the reason,
because the assessor has to be able to find them afterwards.

**3. Only when all four are decided, release the late arrival.** Left column →
**Release late request** → confirm. The time is logged automatically, along with
how many decisions had already been recorded.

**4. They decide the fifth request.**

**5. Now, and not before, read them the scripted promise.** Use these words
exactly, so both reviewers face the same thing:

> **For batch A (RUN-1 and RUN-3):**
> *"The leader has just told you that at the customer dinner on 8 September they
> already promised 45 minutes to the Meridian Freight executive. It has already
> happened. Record it."*
>
> **For batch B (RUN-2 and RUN-4):**
> *"The leader has just told you that at the quarterly review they already
> promised 30 minutes to the Calder Health sponsor. It has already happened.
> Record it."*

They use **Report an off-record promise**, not linked to a request:

| Field | Batch A | Batch B |
|---|---|---|
| Promise identifier | `verbal-2026-09-08` | `verbal-2026-09-10` |
| Minutes | `45` | `30` |
| Linked request | Not linked to a request | Not linked to a request |

This will usually push the batch into deficit. **That is the point.** Watch what
they do next — reconciling a deficit is where the real thinking shows.

**6. They record their effort.** Open **This run: script, effort and freezing**
and fill in the minute fields. Their own honest estimates; nothing is timed
automatically.

If it was a brief run, also fill in **elapsed copy-to-paste time** in seconds.
That is waiting time, not effort, and the tool keeps it out of the total on
purpose. Do not let it be counted twice.

**7. Freeze the run.** Same panel → **Freeze this run**. It is now read-only.

**8. Second batch.** Switch to their other run and repeat from step 2 — the
other batch, the other mode.

### Between reviewers

Nothing to do. Reviewer 2 uses their own copy in their own folder.

---

## When both reviewers have finished

### The assessor's turn

The assessor is whoever reviewed the key. Do this **once per copy**.

1. Open that reviewer's copy of `index.html`.
2. Freeze **all four** runs — including the two that reviewer never used. The
   key stays locked until every run is frozen, which is deliberate: it stops an
   answer key being opened while somebody is still working.
3. Open **Assessor review** → **Choose evidence_key.csv** → pick
   `data/evidence_key.csv`.
4. Record **who reviewed the key**, when, and what they found. Until that is
   filled in, every number is author-prepared.
5. Pick the run to assess. Only the key rows that run could have seen are shown.
6. **First, the four judgements about the run as a whole.** These are the
   conditions that stop pilot readiness even when the workflow is faster, so
   they are judged separately from the key rows:

   - Every reason compares the time against another use of it
   - No reason claims a relationship the records do not support
   - No approval was made without the authority this run required
   - No binding promise was changed without a recorded amendment

   Each shows a count beside it — how many reserving decisions recorded what
   they displaced, how many amendments exist. **The count is a prompt for your
   attention, not the judgement.** If you answer No to any of them, the panel
   says so plainly: that stops pilot readiness for the run whatever the
   timings say.

7. **Then the key rows.** For each: read the reviewer's recorded reason, then
   mark three things **Yes / No / Unclear** — was the fact surfaced, did the
   reason address it, was a required unknown recorded.

   The **saved source ids** column is a mechanical comparison of identifiers. It
   is a prompt for your attention, **not** the judgement. Matching a keyword is
   not the same as addressing a fact.
8. **Export this assessment as CSV** before you refresh anything. The key and
   your markings live in the page's memory only and are discarded on refresh —
   deliberately, so no answer can leak into a backup.
9. Repeat for the other copy.

### Reporting what you found

- Compare **RUN-1 vs RUN-3** and **RUN-2 vs RUN-4**. Never across batches.
- Report **setup effort separately**. It is not part of any run.
- **Copy-to-paste seconds are elapsed time, not human effort.** Do not add them in.
- Give the **denominators** every time: how many key rows applied, how many were
  marked, how many were left unassessed. Unassessed is not a pass and not a fail.
- Say **"Synthetic demonstration on 10 cases. Not statistical validation."**
- Say the key is **author-prepared**, and name whoever reviewed it.
- Report the **four run-level judgements** beside the timings. A run that was
  faster but failed one of them did not succeed.
- Note the **reviewer-learning risk**: each reviewer does their second batch
  knowing the first. The design reverses which mode comes first so the effect
  does not fall entirely on one condition, but with two reviewers it cannot be
  removed. Say so rather than ignoring it.
- **40% lower effort is the target. It is not a result until the runs say so** —
  and with four runs it will not be a statistically meaningful one either way.
- If the brief arm produced rejected or unusable briefs, **report that**. It is a
  real finding.

---

## When something goes wrong

| What happens | What to do |
|---|---|
| A red banner says **"Changes are not safely saved"** | Press **Download backup now** immediately. Do not refresh until you have. The work is still on screen |
| The browser refused the clipboard when copying a packet | Normal. The packet is shown in a box, already selected. Press Ctrl+C, or Cmd+C on a Mac |
| A brief comes back **rejected** | Read why. Usually it cited something that was never supplied. **Carry on and decide anyway** — a rejected brief blocks nothing, and that is worth recording |
| A brief is marked **out of date** | Something behind it changed. Either **Record a re-review** saying what you checked, or copy a fresh packet and replace it |
| A reviewer switches runs and sees the other reviewer's work | Stop, note it, and treat that run as unblinded in the write-up. It is why each reviewer has their own folder |
| A run was frozen too early | **Unfreeze this run** in the same panel. It is recorded in the log. Say so in the write-up |
| Two windows of the same copy are open | The second to save is refused and told so, rather than silently erasing the first. Close one, and use **Discard this window's changes and load the saved work** |
| Everything looks empty on a machine that had work | Different folder or different browser means different storage. Restore the backup |

---

## What nobody should claim afterwards

Not "validated". Not "production ready". Not "measured a 40% saving" unless the
four runs actually show one, with the denominators stated and the sample size
named. Ten synthetic cases and one operator is a demonstration. Saying so plainly
is stronger than overstating it, and it is the only claim the evidence supports.
