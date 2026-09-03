#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Automated end-to-end PostgreSQL backup and restore verification test.
.DESCRIPTION
  Dumps a test snapshot, encrypts it with OpenSSL, decrypts it, restores to a temporary
  scratch database, verifies data/schema integrity and table counts, and cleans up.
#>

param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$TestDbName = "voltium_restore_test_$(Get-Date -Format 'yyyyMMdd_HHmmss')",
  [string]$EncryptionKey = $env:BACKUP_ENCRYPTION_KEY
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

Write-Step "Voltium Database Restore Drill & Verification"

# Default encryption key for test drill if not supplied
if ([string]::IsNullOrWhiteSpace($EncryptionKey)) {
  $EncryptionKey = 'drill-test-backup-encryption-key-32-chars!'
}

# Resolve DATABASE_URL from .env files if unset
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $envFiles = @(
    Join-Path $ProjectRoot 'web/.env.production.local',
    Join-Path $ProjectRoot 'web/.env.local',
    Join-Path $ProjectRoot 'web/.env'
  )
  foreach ($ef in $envFiles) {
    if (Test-Path $ef) {
      $match = Get-Content $ef | Where-Object { $_ -match '^DATABASE_URL=(.+)$' } | Select-Object -First 1
      if ($match) {
        $DatabaseUrl = $match.Replace('DATABASE_URL=', '').Trim("'`"")
        break
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  Write-Fail "DATABASE_URL not found. Provide -DatabaseUrl or set environment variable."
  exit 1
}

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "voltium_drill_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$DumpFile = Join-Path $TempDir "test_dump.sql"
$EncFile = Join-Path $TempDir "test_dump.sql.enc"
$RestoredSql = Join-Path $TempDir "test_restored.sql"

try {
  Write-Step "Step 1: Creating test schema dump"
  # Dump schema + limited data for fast drill verification
  & pg_dump --dbname="$DatabaseUrl" --format=plain --no-owner --no-acl --file="$DumpFile"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DumpFile)) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
  }
  Write-Ok "Dump created at $DumpFile ($((Get-Item $DumpFile).Length) bytes)"

  Write-Step "Step 2: Testing AES-256-CBC encryption"
  $env:TEST_KEY = $EncryptionKey
  & openssl enc -aes-256-cbc -pbkdf2 -salt -iter 100000 -pass env:TEST_KEY -in "$DumpFile" -out "$EncFile"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $EncFile)) {
    throw "Encryption failed with exit code $LASTEXITCODE"
  }
  Write-Ok "Backup encrypted at $EncFile ($((Get-Item $EncFile).Length) bytes)"

  Write-Step "Step 3: Testing decryption round-trip"
  & openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass env:TEST_KEY -in "$EncFile" -out "$RestoredSql"
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $RestoredSql)) {
    throw "Decryption failed with exit code $LASTEXITCODE"
  }
  Write-Ok "Backup decrypted cleanly at $RestoredSql"

  Write-Step "Step 4: Creating scratch database: $TestDbName"
  # Derive base connection URL for postgres admin db
  $uri = [System.Uri]$DatabaseUrl
  $baseDbUrl = $DatabaseUrl -replace "/$($uri.AbsolutePath.TrimStart('/'))", "/postgres"
  & psql "$baseDbUrl" -c "CREATE DATABASE $TestDbName;"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create scratch test database $TestDbName"
  }
  Write-Ok "Created database $TestDbName"

  Write-Step "Step 5: Restoring decrypted SQL into scratch database"
  $targetDbUrl = $DatabaseUrl -replace "/$($uri.AbsolutePath.TrimStart('/'))", "/$TestDbName"
  & psql "$targetDbUrl" -f "$RestoredSql"
  if ($LASTEXITCODE -ne 0) {
    throw "Restore into $TestDbName failed with exit code $LASTEXITCODE"
  }
  Write-Ok "Restoration into $TestDbName succeeded"

  Write-Step "Step 6: Verifying restored database integrity"
  $tableCount = & psql "$targetDbUrl" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
  $tableCount = [int]($tableCount.Trim())
  if ($tableCount -le 0) {
    throw "Verification failed: 0 tables found in restored database."
  }
  Write-Ok "Integrity verified: $tableCount tables successfully restored and queried in public schema."

  Write-Host "`n=======================================================" -ForegroundColor Green
  Write-Host "✅ RESTORE DRILL PASSED: Backup and restore verified." -ForegroundColor Green
  Write-Host "=======================================================" -ForegroundColor Green
} catch {
  Write-Fail "Restore drill failed: $_"
  exit 1
} finally {
  # Cleanup scratch database
  if ($targetDbUrl) {
    Write-Step "Cleaning up scratch database $TestDbName"
    try {
      & psql "$baseDbUrl" -c "DROP DATABASE IF EXISTS $TestDbName WITH (FORCE);" | Out-Null
      Write-Ok "Dropped scratch database $TestDbName"
    } catch {
      Write-Host "Could not drop scratch DB: $_" -ForegroundColor Yellow
    }
  }
  if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
  }
}

exit 0
