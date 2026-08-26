# Voltium `FOLLOWUP_TICKETS.md` — TOC + Ticket-Index Plan (PR-B, PR-D)

**Date:** 2026-07-29
**Source file:** [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) (95 KB, 53 tickets, ~1927 lines after PR-A, PR-B, PR-D)
**Prior plan:** [`docs/FOLLOWUP_TICKETS_FIX_PLAN.md`](./FOLLOWUP_TICKETS_FIX_PLAN.md) — PR-A shipped (filing checklist + ship-it callout + source-count fix)
**Method:** Re-read the doc to verify line numbers and structure. PR-C (fuller P0 section above summary) is fully subsumed by PR-A's "Ship-it-this-week" callout — dropping it.
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** add navigation (TOC) and a per-source-plan ticket index so the doc is usable for "find all DB tickets" / "find all Security tickets" workflows.

---

## TL;DR — Status: PR-B and PR-D already shipped

When I re-read the file to apply this plan, **PR-B (Table of Contents at line 21) and PR-D (Tickets-by-source-plan index table at line 125) were already in the file from a previous session.** This plan is now a record of what was shipped + a review of the implementation.

**Findings from the re-read:**

1. **PR-B TOC exists at line 21** — 9 anchor links to existing sections. The 6 source-plan sub-bullets all point to `#tickets-by-source-plan` (the single anchor for the table index). Since the index is one table, not separate sub-sections, this is acceptable — all 6 sub-bullets land on the same table. Minor cosmetic issue, not a fix.
2. **PR-D index exists at line 125** as a compact 6-row table (Phase 3-6, DB, Design, Admin Web, Infra, Security) with ticket numbers, counts, and priority range. **This is a better format than my draft** — terser, scannable, and includes a "Filing tip" line at the bottom. No changes needed.
3. **No fixes needed in this turn.** The doc is now in good shape: PR-A fixed the worst issue (filing checklist misorder), PR-B added navigation, PR-D added the per-source-plan index.

**PR-C (fuller P0 section above the Summary) is dropped** — PR-A's "Ship-it-this-week" callout already covers the 8 highest-leverage P0s with a one-line description each, and the Filing checklist at the bottom covers the remaining 11 P0s. A third "P0 section above the Summary" would be duplicate information.

---

## Table of contents

1. [Status check: PR-B and PR-D already shipped](#1-status-check-pr-b-and-pr-d-already-shipped)
2. [What was shipped in PR-B and PR-D (verification)](#2-what-was-shipped-in-pr-b-and-pr-d-verification)
3. [Minor cosmetic issue in PR-B TOC](#3-minor-cosmetic-issue-in-pr-b-toc)
4. [What's NOT in this plan (deferred to v3)](#4-whats-not-in-this-plan-deferred-to-v3)
5. [Cross-references](#5-cross-references)

---

## 1. Status check: PR-B and PR-D already shipped

The file's current state:

| Line | Section | Source |
|---|---|---|
| 17 | "6 audit reviews" (PR-A source-count fix) | PR-A (this session) |
| 21 | "Table of Contents" | PR-B (previous session) |
| 38 | "## Summary" | original |
| 40 | "🚨 Ship-it-this-week (8 P0s, ~5 hours focused total)" | PR-A (this session) |
| 125 | "Tickets by source plan" (compact table) | PR-D (previous session) |
| 142 | "## Ticket #1" (first ticket body) | original |
| 1739 | "## Trivial/cosmetic items" | original |
| 1893 | "## Filing checklist" with "Phase 1 — P0 ship-it-this-week" | PR-A (this session) |

**All 3 of the previously "skipped" items are now in the file.** This plan is now a record of what was shipped + a review of the implementation.

---

## 2. What was shipped in PR-B and PR-D (verification)

### 2.1 PR-B: Table of Contents (line 21)

The TOC has 9 anchor links:
- `[🚨 Ship-it-this-week (8 P0s)](#-ship-it-this-week-8-p0s-5-hours-focused-total)` — links to the PR-A callout at line 40. **Anchor is correct.**
- `[Summary — All 53 tickets](#all-53-tickets)` — links to `### All 53 tickets` at line 59 (the heading under the ship-it callout). **Anchor is correct.**
- `[Tickets by source plan](#tickets-by-source-plan)` — links to the PR-D table at line 125. **Anchor is correct.**
- 6 sub-bullets for Phase 3-6, DB, Design, Admin Web, Infra, Security — **all point to the same `#tickets-by-source-plan` anchor** (since the index is one table, not separate sub-sections). **Cosmetic issue: sub-bullets imply they should land on different sections, but they all land on the same table.**
- `[Ticket bodies (#1–#53)](#ticket-1)` — links to the first ticket heading. **Anchor works** (GitHub auto-generates `#ticket-1-...` from the heading).
- `[Trivial/cosmetic items](#trivialcosmetic-items-not-individual-tickets)` — **Anchor is correct.**
- `[Filing checklist](#filing-checklist)` — **Anchor is correct.**

### 2.2 PR-D: Tickets by source plan (line 125)

The PR-D index is a compact 6-row table:

| Source plan | Tickets | Count | Priority range |
|---|---|---|---|
| Phase 3–6 follow-ups | #1, #2, #3, #4, #5 | 5 | Medium–Low |
| DB Audit | #6-12 | 7 | Medium–Low |
| Design System | #13-14, #27-32 | 8 | Medium–Low |
| Admin Web | #15-26, #33 | 13 | Medium–Low |
| Infra | #34-43 | 10 | P0 (9), P1 (1) |
| Security | #44-53 | 10 | P0 (all) |

Plus a "Filing tip" line: "To file all Security tickets at once, copy tickets #44–#53 from the bodies below. To file all Infra P0s, copy #34–#42."

**This is a better format than my draft** — terser, scannable, and includes the priority range per source plan. **No changes needed.**

### 2.3 Verifications

- **All 53 ticket bodies unchanged.** Verified by counting `## Ticket #N:` lines (53 matches).
- **All ticket numbers stable.** No renumbering.
- **All cross-references in `SCOPE.md` and the audit plans still resolve.** The plan docs reference `#1`-`#53` by number, and those numbers didn't change.

---

## 3. Minor cosmetic issue in PR-B TOC

**Issue:** Lines 26-31 of the TOC have 6 sub-bullets all pointing to `#tickets-by-source-plan`:

```markdown
- [Tickets by source plan](#tickets-by-source-plan)
  - [Phase 3–6 follow-ups (#1–5)](#tickets-by-source-plan)   <-- same anchor
  - [DB Audit (#6–12)](#tickets-by-source-plan)                <-- same anchor
  - [Design System (#13–14, #27–32)](#tickets-by-source-plan)  <-- same anchor
  - [Admin Web (#15–26, #33)](#tickets-by-source-plan)        <-- same anchor
  - [Infra (#34–43)](#tickets-by-source-plan)                  <-- same anchor
  - [Security (#44–53)](#tickets-by-source-plan)              <-- same anchor
```

**This works** (all 6 sub-bullets land on the same table), but it's misleading — the sub-bullets imply each links to its own section.

**Why this is a minor cosmetic issue, not a real bug:**

- All 6 sub-bullets do land on the table. The table is short (6 rows). A reader who clicks "DB Audit" lands on the table and can find the row.
- Fixing it would require splitting the table into 6 sub-sections (one per source plan), each with its own `### Phase 3-6`, `### DB Audit`, etc. heading. That's a bigger change and the current table format is more scannable.

**Recommendation: leave as-is.** If the team wants per-source-plan sub-sections, file a v3 ticket.

---

## 4. What's NOT in this plan (deferred to v3)

### 4.1 Per-ticket MD files (v3)

The doc is 95 KB. A common "fix" is to break it into per-ticket MD files (e.g. `docs/followup/001-split-rider-management.md`). **Don't do that.** The single-doc format is the team's editable source of truth. Per-ticket files make filing harder (`gh issue create --body-file ./001-...` vs. copy-paste from the section). **Stay with one doc.**

If the team wants a script-generated per-ticket MD dump for `gh issue create --body-file` workflows, file a v3 ticket.

### 4.2 Auto-syncing to GitHub Issues (v3)

A common "fix" is to auto-create GitHub issues from the doc on every push. **Don't do that.** The doc is the team's editable source of truth; GitHub issues are the read-only result of filing. Auto-syncing loses the "edit locally, file when ready" workflow. **Stay manual.**

### 4.3 P0 section above the Summary (v3)

PR-C was supposed to add a fuller "all 19 P0s" section above the Summary. Dropped in this turn (PR-A's callout + Filing checklist cover the need). If the team wants a single "All P0s" place in the future, it should subsume PR-A's callout + the current Filing checklist Phase 1 — not duplicate. v3 design decision.

### 4.4 Per-priority reordering (v3, do not do)

A common "fix" is to sort tickets by priority (P0 first, P1 next, P2 last). **Don't do that.** The numbered ticket system is the team's stable identifier. Reordering would break cross-references in SCOPE.md, the audit plans, and the GitHub issues themselves.

**Use the Summary table's Priority column, the "Ship-it-this-week" callout (PR-A), or the Filing checklist (PR-A) for priority-based reading. The TOC (PR-B) and Tickets-by-source index (PR-D) are for navigation, not priority-based reading.**

### 4.5 Sub-bullet anchors in the TOC (v3)

The 6 sub-bullets in the TOC all point to the same anchor. Could be split into per-source-plan sub-sections. Cosmetic, low value. v3.

---

## 5. Cross-references

- **Source file:** [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) (95 KB, 53 tickets, ~1927 lines after PR-A, PR-B, PR-D)
- **Prior plan:** [`docs/FOLLOWUP_TICKETS_FIX_PLAN.md`](./FOLLOWUP_TICKETS_FIX_PLAN.md) — PR-A shipped (filing checklist + ship-it callout + source-count fix)
- **PR-B and PR-D**: shipped in a previous session (TOC at line 21, Tickets-by-source table at line 125). No code changes needed in this turn.
- **Source plans** (the 7 source docs that generated the 53 tickets):
  - [`docs/RELEASE_READINESS_2026-07-29.md`](./RELEASE_READINESS_2026-07-29.md) — Phase 7 follow-ups (Tickets #1-5)
  - [`docs/DB_REMEDIATION_PLAN.md`](./DB_REMEDIATION_PLAN.md) — DB audit (Tickets #6-12)
  - [`docs/DESIGN_SYSTEM_PLAN.md`](./DESIGN_SYSTEM_PLAN.md) — Design system audit (Tickets #13-14, #27-32)
  - [`docs/ADMIN_WEB_PLAN.md`](./ADMIN_WEB_PLAN.md) — Admin web audit (Tickets #15-26, #33)
  - [`docs/RIDER_APP_PLAN.md`](./RIDER_APP_PLAN.md) — Rider app audit (no separate tickets; all in plan PRs)
  - [`docs/INFRASTRUCTURE_PLAN.md`](./INFRASTRUCTURE_PLAN.md) — Infrastructure audit (Tickets #34-43)
  - [`docs/SECURITY_PLAN.md`](./SECURITY_PLAN.md) — Auth/security audit (Tickets #44-53)
- **SCOPE.md:** `D:\voltium\SCOPE.md` — references the followup ticket numbers in its revision history and follow-up PRs
