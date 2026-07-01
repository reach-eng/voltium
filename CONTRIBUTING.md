# Contributing to Voltium

We love your input! We want to make contributing to Voltium as easy and transparent as possible.

## Local Development Setup

Please refer to the `README.md` for instructions on standing up the local Node.js and PostgreSQL environment, as well as the Flutter emulator.
Before committing, ensure your local environment has `husky` installed to run pre-commit hooks:
```bash
npm run prepare
```

## Branch Naming Convention

We use a standard branching naming convention to keep track of features and bug fixes:
- `feature/<issue-number>-<brief-description>` (e.g., `feature/12-add-wallet-topup`)
- `bugfix/<issue-number>-<brief-description>` (e.g., `bugfix/45-fix-otp-timeout`)
- `hotfix/<brief-description>` (e.g., `hotfix/database-indexing`)
- `chore/<brief-description>` (e.g., `chore/update-dependencies`)

## Commit Message Format

We strictly follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This allows us to auto-generate changelogs and version bumps.

Format:
```
<type>[optional scope]: <description>

[optional body]
```

Examples:
- `feat(api): add idempotency key support to rentals endpoint`
- `fix(flutter): resolve null pointer exception on dashboard`
- `docs: update API documentation for webhooks`
- `test(core): add property-based fuzzing for money paths`

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`.

## Pull Request Template

When creating a PR, please copy and paste the following template into the PR description:

```markdown
## Description
Provide a brief summary of the changes and the issue they resolve.

## Issue Link
Fixes #<issue-number>

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing Performed
Describe the tests you ran to verify your changes.
- [ ] Unit tests added/updated
- [ ] Integration tests passed locally
- [ ] UI verified on emulator (if applicable)

## Screenshots / Screen Recordings
(If UI changes were made)
```

## Code Review Checklist

Before requesting a review, please verify the following:
- [ ] I have run `npm run lint` and `npm run typecheck` locally.
- [ ] I have written unit tests for my new code.
- [ ] `npm run test:coverage` shows coverage has not dropped below 85%.
- [ ] If I modified the database schema, I have generated a migration and reviewed the SQL output for performance implications.
- [ ] If I added a new environment variable, I have updated `web/src/lib/config.ts` (Zod validation) and `.env.example`.
- [ ] No hardcoded secrets exist in the code.
