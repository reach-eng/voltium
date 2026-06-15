# Disaster Recovery Plan

Voltium's laptop-only architecture means **all data lives on a single machine**. A disaster recovery plan is essential.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hard drive failure | Complete data loss | Low | Daily backups + external USB copy |
| Laptop theft | Data + hardware loss | Low | Encrypted drive, external backup |
| Accidental deletion | Partial data loss | Medium | Retention policy, verified backups |
| Database corruption | App unusable | Low | Pre-restore backup before any restore |
| Power surge | Hardware damage | Low | UPS, external off-site backup |
| Ransomware | Data encrypted | Low | Offline USB backup, air-gapped copy |

## Recovery Levels

### Level 1 — Quick Recovery (App Restart)

**When:** App is down but data is intact
**Symptom:** Server not responding, PM2 crashed
**Action:**
```powershell
pm2 list
pm2 restart voltium
pm2 logs voltium --lines 50
```

### Level 2 — Data Recovery (Restore from Backup)

**When:** Data is corrupted or partially lost
**Symptom:** App starts but shows errors, missing data
**Action:**
1. Identify latest verified backup from **Admin → Data Management → Backups**
2. Go to **Restore** tab
3. Select backup → **Validate & Continue** → **Start Restore**
4. System creates pre-restore backup, restores data, runs migrations

### Level 3 — Full Recovery (New Laptop)

**When:** Laptop is lost, stolen, or hardware failure
**Symptom:** No access to original machine
**Action:**
1. Obtain replacement laptop
2. Follow [LAPTOP_SERVER_SETUP.md](./LAPTOP_SERVER_SETUP.md) for initial setup
3. Restore from most recent external backup:
   ```powershell
   # Connect USB drive with backups
   .\scripts\restore-local.ps1 -BackupPath "E:\VoltiumBackups\manual\latest_backup"
   ```
4. Verify app health:
   ```powershell
   curl http://localhost:8081/api/health/db
   curl http://localhost:8081/api/health/worker
   ```
5. Test admin login
6. Restart Cloudflare Tunnel with new token
7. Update DNS if IP changed

## Backup Strategy

### Required
- **Daily automated backup** at 02:00 AM (configured in Schedule)
- **7 daily + 4 weekly + 6 monthly** retention (configurable)
- **Automatic verification** via checksums
- **External USB copy** for off-site storage

### Recommended
- **Weekly USB backup** swapped off-site
- **Monthly integrity test** — restore backup to test database
- **Quarterly DR drill** — full recovery on spare laptop

## Monitoring & Alerts

Check these regularly:

| Check | Frequency | Tool |
|-------|-----------|------|
| Last backup succeeded | Daily | Admin → Overview |
| Disk space | Daily | Admin → Storage |
| Backup verification | Weekly | Admin → Backups → Verify |
| Restore test | Monthly | Test restore to test DB |
| External backup | Weekly | Check USB drive connected |

## Health Checks

The app exposes health endpoints:

```bash
# Database connectivity
GET /api/health/db
# → {"status":"healthy","database":"connected"}

# Worker process
GET /api/health/worker
# → {"status":"healthy","worker":"running"}

# Full overview (requires admin session)
GET /api/admin/data-management/overview
```

## DR Checklist

Run this checklist monthly:

- [ ] Last backup status: COMPLETED
- [ ] Backup verified: PASS
- [ ] Free disk space: > 20 GB
- [ ] External USB drive connected
- [ ] External backup updated
- [ ] PM2 running
- [ ] Cloudflare Tunnel running
- [ ] App accessible via public URL
- [ ] Admin login works
- [ ] Test OTP login disabled
- [ ] Dev admin login disabled

## Critical Actions

### If you suspect data corruption

1. **DO NOT** restart the app
2. **DO** create a manual backup immediately
3. **DO** run backup verification
4. **DO** restore from the most recent verified backup
5. **DO** run `prisma migrate deploy` after restore

### If backup fails

1. Check disk space (`Admin → Storage`)
2. Check backup path exists
3. Check PostgreSQL is running
4. Run test schedule (`Admin → Schedule → Test Settings`)
5. Review backup logs (`Admin → Backup Logs`)

## Recovery Time Objectives

| Scenario | Target Recovery Time | Target Data Loss |
|----------|---------------------|------------------|
| App crash/restart | < 5 minutes | None |
| Database corruption | < 30 minutes | < 24 hours |
| Hard drive failure | < 4 hours | < 24 hours |
| Full laptop replacement | < 8 hours | < 24 hours |
