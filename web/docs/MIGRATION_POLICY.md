# Database Migration Policy

Voltium relies on Prisma for database schema management. As the application matures, safe, zero-downtime database migrations are critical for reliability. 

This document outlines the required procedures for evolving the database schema.

---

## 🚫 1. Never Use `db push` in Production

**Rule:** You must never run `npx prisma db push` against the staging or production databases. 

`db push` synchronizes the schema by forcefully dropping and recreating constraints, indexes, or columns if it cannot reconcile the differences gracefully. It does not track migration history and can cause catastrophic data loss.

**Enforcement:**
- Always use `npx prisma migrate deploy` in CI/CD and deployment scripts.
- Schema changes must always be represented by a `.sql` file in the `prisma/migrations/` directory.

---

## 🛠 2. Creating Migrations

Because the local development environment might not support shadow databases for `prisma migrate dev`, the standard workflow for generating migrations is to create empty migrations and write the SQL manually, or use `--create-only` when a shadow database is available.

### Workflow:
1. Make your changes to `prisma/schema.prisma`.
2. Generate an empty migration file (or auto-generate if shadow DB is working):
   ```bash
   npx prisma migrate dev --create-only --name <descriptive_name>
   ```
3. If auto-generation failed or you need custom logic (like backfilling data), manually edit the resulting `migration.sql` file.
4. Apply the migration to your local database:
   ```bash
   npm run db:deploy
   # or
   npx prisma migrate deploy
   ```
5. Commit the schema changes and the migration directory.

---

## 📈 3. The Expand/Contract Pattern (Zero-Downtime Migrations)

For any destructive change (renaming a column, changing a column type, dropping a column), you must use the **Expand/Contract** pattern. You cannot make breaking database changes in a single deployment because the old version of the application will still be running and connected to the database during the rollout.

### Phase 1: Expand
1. **Schema:** Add the new column/table alongside the old one. Make the new column nullable (or give it a default value).
2. **App Code:** Update the application to write to *both* the old and the new columns, but continue reading from the *old* column.
3. **Migration:** Create a migration to add the column. Include a backfill script to copy existing data from the old column to the new one.
4. **Deploy:** Deploy Phase 1.

### Phase 2: Transition
1. **App Code:** Update the application to read from the *new* column. Stop writing to the *old* column.
2. **Deploy:** Deploy Phase 2. At this point, the old column is obsolete.

### Phase 3: Contract
1. **Schema:** Remove the old column from `schema.prisma`.
2. **Migration:** Create a migration that drops the old column.
3. **Deploy:** Deploy Phase 3.

---

## ⏪ 4. Rollback Policy

Prisma migrations apply linearly. Prisma does not have a built-in `down` migration command (like `migrate down`).

### Handling Bad Migrations:
1. **If the migration has NOT been deployed to production:**
   - You can manually revert your local database (e.g., restore from a backup, or manually `ALTER TABLE`), delete the bad migration folder from `prisma/migrations`, and recreate it.
2. **If the migration HAS been deployed to production:**
   - **Never delete or modify a deployed migration file.** This will break the migration history (`_prisma_migrations` table) for all other environments.
   - **Roll-forward instead:** Write a *new* migration that reverts the schema changes (e.g., adds the dropped column back, removes the bad index) and deploy it.

---

## ✅ 5. Code Review Checklist for Database Changes

Before approving a PR that touches `schema.prisma` or `prisma/migrations/`, verify the following:

- [ ] **No `db push`:** The PR only contains generated `migration.sql` files, not instructions to use `db push`.
- [ ] **Linear History:** The new migration folder is named correctly with a timestamp and is the latest in the sequence.
- [ ] **Expand/Contract:** If the PR renames, drops, or alters a column's type, is it broken down into an Expand/Contract phased rollout?
- [ ] **Default Values / Nullability:** If adding a new column to an existing table, is it either optional (`?`) or does it have a default value (`@default(...)`)? If not, the migration will fail on tables with existing rows.
- [ ] **Indexes:** Are appropriate indexes added for new foreign keys or columns that will be heavily filtered/sorted?
- [ ] **Backfill:** If adding a new required column using Expand/Contract, does the `migration.sql` include the necessary `UPDATE` statements to backfill existing rows before enforcing the `NOT NULL` constraint?
