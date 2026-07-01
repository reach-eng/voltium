# Voltium Release Checklist

Use this checklist before and during every major production release to ensure quality, security, and stability.

## Pre-Release Preparation
- [ ] **Tests are Green**: Ensure all CI pipeline jobs (Linting, TypeScript, Unit Tests, E2E Tests, and Golden Tests) are passing on the `main` branch.
- [ ] **Coverage Validated**: Ensure test coverage remains above the mandatory 85% threshold.
- [ ] **Migrations Reviewed**: Check `prisma/migrations/` for any new SQL files. Ensure they have been reviewed for locking operations (e.g., adding constraints to large tables) and missing indexes.
- [ ] **Load Testing**: Review the latest nightly k6 load test summary in CI artifacts. Ensure p95 latencies are under 200ms for vehicles and 500ms for bookings.
- [ ] **Security Scans**: Ensure `npm audit` and `semgrep` run cleanly without High or Critical vulnerabilities.
- [ ] **Secrets Rotation**: Verify if any API keys, JWT secrets, or DB passwords need rotation in `docs/SECURITY.md`. Ensure `.env` vars in Vercel/PM2 are up-to-date.

## Release Execution
- [ ] **Stakeholders Notified**: Post a release announcement in `#engineering-releases` outlining the version number, changes, and estimated deployment time.
- [ ] **Feature Flags Configured**: Toggle on/off necessary feature flags for the new release in the admin dashboard or environment variables.
- [ ] **Database Backup**: Ensure a snapshot or backup script (`scripts/db-sync.sh`) has run recently.
- [ ] **Deploy**: Execute the deployment via `npm run deploy:prod`.
- [ ] **Sentry Tagging**: Ensure the release version is tagged in Sentry for proper error tracking and regression analysis.

## Post-Release Verification
- [ ] **Health Check**: Verify `/api/health` returns `200 OK`.
- [ ] **Smoke Testing**: Perform a manual login and vehicle listing verification on the production app.
- [ ] **Monitoring**: Monitor Datadog/Grafana for abnormal error rates or latency spikes for the first 30 minutes post-deployment.
- [ ] **Rollback Plan Documented**: Ensure the team knows the commit hash of the previous stable release, as documented in `docs/RUNBOOK.md`.
