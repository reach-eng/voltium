# DB-only migrations recovery + Prisma generate EPERM analysis

**Date:** 2026-09-06
**Branch:** `chore/dead-code-removal-2026-09-02`
**Author:** mavis
**Reviewer focus:** clean dev-DB state for next contributor

## TL;DR

Two DB-only migrations are back on disk. `prisma migrate status` shows
**62 migrations** (up from 60) and the dev DB is **up to date**. The
`prisma generate` EPERM is the dev server holding the Prisma DLL — see
section 4 for the analysis and the proposed action.

| Item                                  | State                                                 |
| ------------------------------------- | ----------------------------------------------------- |
| `20260826000000_legal_draft_publish`  | On disk, content matches commit `4a3dc9cc`            |
| `20260826010000_guarantor_rejection_reason` | On disk, content matches commit `ec6700f2`      |
| `npx prisma migrate status`           | 62 migrations, **up to date**, exit 0                 |
| `npx tsc --noEmit`                    | 0 errors                                              |
| `.tmp*` debris in `node_modules/.prisma/client/` | 37 files / 747.5 MB cleaned              |
| `prisma generate` EPERM               | Open — see §4                                        |

## 1. Source of the two DB-only migrations

Both migrations were once committed to the repo and then disappeared from
disk (the directory was deleted, the `migration.sql` blob remained in git
object storage and was retrievable). The `_prisma_migrations` table in
`voltium_dev` had them recorded as **applied** (`finished_at` set,
`rolled_back_at` null) but with `applied_steps_count = 0` — a phantom
registration: the migration was marked done without actually running
the SQL.

| Migration name                            | Introduced in         | SQL content (essence)                                  |
| ----------------------------------------- | --------------------- | ------------------------------------------------------ |
| `20260826000000_legal_draft_publish`      | `4a3dc9cc` (W9 L-1)   | `CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT','PUBLISHED'); ALTER TABLE "legal_documents" ADD COLUMN "publishedAt" TIMESTAMP(3), ADD COLUMN "status" "LegalDocumentStatus" NOT NULL DEFAULT 'PUBLISHED';` |
| `20260826010000_guarantor_rejection_reason` | `ec6700f2` (W10 R-7f) | `ALTER TABLE "guarantors" ADD COLUMN "rejectionReason" TEXT;` |

Both files are written at the canonical path under
`web/prisma/migrations/<name>/migration.sql` with the **original SQL
content as committed in the source commit**, encoded as UTF-8 with LF
line endings (modern convention; the original blobs were also
plain UTF-8/LF — the brief UTF-16 LE appearance in early inspection
was a PowerShell pipeline artifact, not the actual blob content).

## 2. Schema drift (the real concern, separate from this fix)

This is the important caveat: **the two migrations describe side-effects
that the current Prisma schema does not want.** A `migrate reset` that
re-runs the SQL on a fresh DB will produce columns / an enum that the
schema doesn't expect:

| Migration                        | SQL says                                    | Current Prisma schema (`schema.prisma`)                  | Current dev DB                                              |
| -------------------------------- | ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `legal_draft_publish`            | adds `legal_documents.publishedAt`, `legal_documents.status`, `LegalDocumentStatus` enum | **`LegalDocument` model has neither column; no enum**    | **No `publishedAt`/`status` columns; no `LegalDocumentStatus` enum** |
| `guarantor_rejection_reason`     | adds `guarantors.rejectionReason`           | **`Guarantor` model has no `rejectionReason`**            | **No `rejectionReason` column**                             |

So: the migrations are on disk (the bookkeeping is consistent), but the
side-effects they describe have been **quietly undone by later schema
work**. The L-1b lifecycle (DRAFT/PUBLISHED) is now implemented in code
against `legal_document_revisions` (see `9bf9b866 feat(legal): L-1b
DRAFT/PUBLISHED lifecycle & permission gate for legal documents`),
without a DB-level `status` column. The guarantor `rejectionReason`
was added in `ec6700f2` and removed in a later W4 commit
(`a4bce2a2 fix(admin): real bugs surfaced by pre-existing test suite`
or one of its dependents — pin down exactly with
`git log -G rejectionReason -- web/prisma/schema.prisma` when this
needs to be done as a follow-up ticket).

**Why this is OK right now:**
- The dev DB has these recorded as applied (so `migrate deploy` skips
  them).
- A future `migrate reset` on this dev DB will drop the dev DB and
  re-apply everything from disk. The two recovered migrations will run
  and create the columns/enum, producing a DB state that is **not
  what the current Prisma schema expects**.
- The next `prisma db push` (or any schema diff) will want to drop
  those columns, undoing the migration's work.
- A production `migrate reset` on staging/prod would have the same
  drift but with a different starting state (other rows that depend
  on the columns).

**Recommended follow-up (out of scope for this PR):** either
1. **Add a corrective migration** that drops the new columns and the
   enum (so a `migrate reset` produces a schema consistent with the
   current `schema.prisma`), OR
2. **Inert the two migrations** — replace the SQL with a no-op
   (`-- no-op: side-effects reverted by W4 work; see follow-up ticket`).
   This keeps the bookkeeping and makes `migrate reset` produce a DB
   that matches the current schema.

The user should pick the option they prefer. Both are safer than the
current "migrations exist with side-effects that don't match the
schema" state.

## 3. `.tmp*` debris cleanup

`node_modules/.prisma/client/` had **37 `.tmp*` files totalling
747.5 MB** — leftover from prior failed `prisma generate` attempts.
None of them are held open by any process (verified by enumerating
`Get-Process -Id <pid> | Select-Object -ExpandProperty Modules` for
the dev-server PIDs and the npm/cross-env wrappers). The real
`query_engine-windows.dll.node` is held by **PID 5856** (the
`next-server.js` worker for the dev server on port 8081).

The `.tmp` files have been moved to a staging dir and trashed. Disk
space recovered: ~750 MB.

## 4. `prisma generate` EPERM — analysis + recommendation

The error (captured from a live run):
```
EPERM: operation not permitted, rename
  'D:\voltium\web\node_modules\.prisma\client\query_engine-windows.dll.node.tmp20340'
  -> 'D:\voltium\web\node_modules\.prisma\client\query_engine-windows.dll.node'
```

Prisma writes a new `.tmp<PID>` first, then atomically renames it over
the real DLL. The rename fails because the **destination is held open
by PID 5856** (`next-server.js`, the active dev server on port 8081).
This is the standard "stale dev server holding the Prisma DLL" pattern.

**Why this is benign right now** (per the agent memory playbook):
- `npx tsc --noEmit` → **0 errors** (verified post-cleanup).
- `npx prisma migrate status` → **up to date** (62 migrations).
- All 28 admin-panel + KYC-correction tests pass.
- The dev server is using the existing Prisma client, which is current
  enough for everything else.
- A `prisma generate` "drift" is a smell, not a blocker, when tsc is
  clean.

**Three options for the user:**

| Option                                     | What it does                                                              | Risk                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **(A) Leave it as-is** *(recommended)*     | Accept the EPERM as benign. Document in this report. tsc/tests/migrate clean. | None for current work. Will surface again on next contributor's fresh `prisma generate`. |
| **(B) Restart the dev server**             | Kill PID 5856 + parents (10800, 8640, 11544), run `prisma generate`, restart `npm run dev`. | Disrupts the user's port-8081 browser session for device-level QA.                       |
| **(C) Hot-swap the DLL**                   | Copy the new DLL into place, then bump the dev server to re-`require` it. | Brittle. Next `prisma generate` will still fail.                                         |

**My recommendation: (A).** The dev server has been up since Sept 5/6
(>24h). It holds the DLL until the user's QA session ends. Killing it
to make `prisma generate` happy trades a working dev server for a
non-blocker.

If/when the user wants to take (B), the cleanup recipe is:

```powershell
# Stop the dev server (this releases the DLL)
Get-Process -Id 10800,8640,11544,5856 -ErrorAction SilentlyContinue | Stop-Process -Force
# Re-run the generator
cd D:\voltium\web
npx prisma generate
# Restart the dev server
cd D:\voltium
npm run dev
```

## 5. Files changed in this commit

```
?? web/prisma/migrations/20260826000000_legal_draft_publish/migration.sql
?? web/prisma/migrations/20260826010000_guarantor_rejection_reason/migration.sql
```

(`.tmp*` debris is in `node_modules/`, not committed.)
