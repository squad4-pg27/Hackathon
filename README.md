# Time Ledger

A single-operator meeting-request review desk, built for the "Who Gets the Time?"
challenge.

An executive assistant inspects the original evidence behind a meeting request,
sees plainly where an identity is unconfirmed or a record is missing, optionally
reads a brief they obtained from an AI **outside** this tool, and records a
**human** decision with its reason and the minutes it reserves.

The experiment it is built to run: **does an AI-written brief save effort beyond
organised retrieval plus the same decision checklist?** The tool is the
instrument. The answer comes from running it.

---

## Open it

**Double-click `index.html`.** That is the whole installation.

One file. No server, no install, no account, no internet. It makes no network
requests of any kind.

---

## Sixty seconds before you present

1. Double-click `index.html`.
2. Open **Data, storage and backups (technical)** at the bottom.
3. Read the line that says either **"Storage is working"** or **"Storage is NOT working"**.

**If it says storage is working**, the demo below works exactly as written.

**If it says storage is NOT working** — some browsers refuse to let a page saved
on your own computer keep anything — then everything still works *except*
surviving a refresh. **Do not press refresh during the demo.** Use **Download
backup** and **Restore from a backup file** to show the same point instead. The
app will be showing a red banner saying so; that banner is the tool being honest,
not a fault, and it is worth pointing at.

4. Open **Run self-checks** and press the button. Expect **67 passed, 0 failed**.
   That takes about two seconds and is a good thing to do on stage.

---

## The two-minute demo

Every number below was verified in a real browser.

| | Do this | They should see |
|---|---|---|
| **0:00** | Double-click `index.html` | Four requests, batch A. Top right: **remaining 120 of 120 min** |
| **0:20** | Click **R002 Sam Rivera** | **"Identity unconfirmed"** and **"Prior decisions hidden — identity unconfirmed."** Three suggested matches, none chosen. *Say: two people share this name. The tool refuses to guess.* |
| **0:45** | Pick the **Meridian Freight** Sam, type a basis, **Record identity decision** | Only *his* records and *his* prior approval appear. The other Sam's decline never shows |
| **1:05** | Click **R001**, choose **Provisional approval**, 50 minutes, a reason, **Save decision** | **remaining 70 of 120** |
| **1:25** | Choose **Binding**, save | **No duration box** — *"Reservation carried across unchanged: 50 minutes."* Still **remaining 70**. *Say: converting never reserves twice* |
| **1:45** | Choose **Binding** again, try to cut it to 20 | Refused: *"A binding commitment can only be changed or released with a leader-approved amendment."* |
| **2:00** | **Run self-checks** | **67 passed, 0 failed** |

**The strongest line to close on:** *"It is built to refuse. It will not guess who
someone is, it will not let a firm commitment be quietly shortened, and it never
ranks anybody."*

---

## What is in the folder

| | |
|---|---|
| **`index.html`** | **The application. This is the whole thing.** |
| `RUNSHEET.md` | How to actually run the experiment with two reviewers |
| `data/*.csv` | The synthetic records. Not needed to run — the app has its own copy built in |
| `data/README.md`, `data/evidence_key.csv` | **Assessor material. Do not show these to a reviewer before they have finished** |
| `dev/` | The test kit. Development only; delete it and the app still works |
| `CLAUDE.md` | The rules this was built to |

---

## What it deliberately never does

- Rank people, score value, or sort by importance
- Recommend accepting or declining
- Contact anyone or book anything
- Infer value from job title, seniority, or from a missing record
- Change its own priorities. Only a person recording a policy change does that

---

## What it honestly is not

- **A synthetic demonstration on 10 cases with one operator. Not statistical validation.**
- Not connected to a calendar. Remaining minutes come from the supplied records only.
- Role selection simulates a role. A leader-approved amendment is *recorded*, not obtained.
- The history is append-only in this browser, but it is ordinary browser storage and is not tamper-proof.
- Using an AI happens outside this tool and needs your own access to one.
- The evidence key was written by the builder. **Author-prepared is not independent validation.**
- Runs keep their decisions apart, but they are not hidden from each other. Anyone at this browser can switch runs and read another reviewer's work. `RUNSHEET.md` explains how to work around that.

**40% lower effort is the target of the experiment, never an assumed result.**

---

## Testing it yourself

Inside the page: **Run self-checks** → 67 checks in about two seconds.

From a terminal, if you want the full sweep:

```bash
npm install --no-save playwright && npx playwright install chromium
node dev/run-all.js
```

261 checks across eight suites, including a real page reload, a real backup and
restore, deliberately broken files, two windows fighting over the same storage,
and a 500-step random walk through every transition. `dev/README.md` lists the
nine faults these checks have already caught.
