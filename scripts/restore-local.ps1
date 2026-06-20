# Voltium Local Restore Script (Windows PowerShell)
# Usage: .\scripts\restore-local.ps1 -BackupPath "D:\VoltiumServer\data\backups\manual\backup_20260616_020000"
# Requires: PostgreSQL client tools (psql) in PATH

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,

    [Parameter(Mandatory = $false)]
    [string]$DatabaseUrl = $env:DATABASE_URL,

    [Parameter(Mandatory = $false)]
    [string]$UploadsDir = $env:LOCAL_STORAGE_ROOT,

    [Parameter(Mandatory = $false)]
    [switch]$SkipPreRestoreBackup,

    [Parameter(Mandatory = $false)]
    [switch]$SkipMigrations
)

$ErrorActionPreference = "Stop"
$restoreId = "restore_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "[Restore] Starting restore: $restoreId" -ForegroundColor Cyan
Write-Host "[Restore] Source: $BackupPath" -ForegroundColor Cyan

# Validate backup path
if (-not (Test-Path $BackupPath)) {
    Write-Error "[Restore] Backup path not found: $BackupPath"
    exit 1
}

# 1. Verify manifest
$manifestFile = "$BackupPath\manifest.json"
if (-not (Test-Path $manifestFile)) {
    Write-Error "[Restore] Manifest file not found: $manifestFile"
    exit 1
}
$manifest = Get-Content $manifestFile | ConvertFrom-Json
Write-Host "[Restore] Backup manifest: backupId=$($manifest.backupId), createdAt=$($manifest.createdAt)" -ForegroundColor Yellow

# 2. Verify checksums
$checksumFile = "$BackupPath\checksums.sha256"
if (Test-Path $checksumFile) {
    Write-Host "[Restore] Verifying checksums..." -ForegroundColor Yellow
    Get-Content $checksumFile | ForEach-Object {
        $parts = $_ -split '\s+'
        $expectedHash = $parts[0]
        $filename = $parts[1]
        $filePath = "$BackupPath\$filename"
        if (Test-Path $filePath) {
            $actualHash = (Get-FileHash $filePath -Algorithm SHA256).Hash.ToLower()
            if ($actualHash -ne $expectedHash) {
                Write-Error "[Restore] Checksum mismatch for $filename"
                exit 1
            }
            Write-Host "[Restore]   $filename: OK" -ForegroundColor Green
        }
    }
}
else {
    Write-Warning "[Restore] No checksum file found, skipping verification"
}

# 3a. Decrypt encrypted artifacts into a temporary restore workspace
$restoreWorkDir = $BackupPath
if ($manifest.encrypted -eq $true) {
    $identityFile = $env:BACKUP_ENCRYPTION_IDENTITY_FILE
    if (-not $identityFile) {
        $identityFile = $env:BACKUP_ENCRYPTION_KEY
    }
    if (-not $identityFile -or -not (Test-Path $identityFile)) {
        Write-Error "[Restore] BACKUP_ENCRYPTION_IDENTITY_FILE must point to an age identity file"
        exit 1
    }
    if (-not (Get-Command age -ErrorAction SilentlyContinue)) {
        Write-Error "[Restore] age CLI is required to decrypt backups"
        exit 1
    }

    $restoreWorkDir = Join-Path ([System.IO.Path]::GetTempPath()) "voltium_restore_$restoreId"
    New-Item -ItemType Directory -Path $restoreWorkDir -Force | Out-Null

    & age --decrypt -i "$identityFile" "$BackupPath\database.sql.age" > "$restoreWorkDir\database.sql"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[Restore] Database backup decryption failed"
        exit 1
    }

    if (Test-Path "$BackupPath\uploads.zip.age") {
        & age --decrypt -i "$identityFile" "$BackupPath\uploads.zip.age" > "$restoreWorkDir\uploads.zip"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "[Restore] Uploads backup decryption failed"
            exit 1
        }
    }
}

# 3. Create pre-restore backup (unless skipped)
if (-not $SkipPreRestoreBackup) {
    Write-Host "[Restore] Creating pre-restore backup..." -ForegroundColor Yellow
    $preBackupDir = Join-Path (Split-Path $BackupPath -Parent) "pre_restore_$restoreId"
    New-Item -ItemType Directory -Path $preBackupDir -Force | Out-Null

    # Quick database backup
    $dbUrl = $DatabaseUrl
    $preDbFile = "$preBackupDir\pre_restore_database.sql"
    try {
        & pg_dump --dbname="$dbUrl" --file="$preDbFile" --no-owner --no-acl
        Write-Host "[Restore] Pre-restore database backup created: $preDbFile" -ForegroundColor Green
    }
    catch {
        Write-Warning "[Restore] Pre-restore database backup failed: $_"
    }
}

# 4. Restore database
$dbFile = "$restoreWorkDir\database.sql"
if (Test-Path $dbFile) {
    Write-Host "[Restore] Restoring database..." -ForegroundColor Yellow
    try {
        # Terminate existing connections and drop/recreate
        $dropCmd = @"
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = current_database()
  AND pid <> pg_backend_pid();
"@
        & psql --dbname="$DatabaseUrl" -c "$dropCmd" 2>$null

        # Restore from dump
        & psql --dbname="$DatabaseUrl" -f "$dbFile"
        if ($LASTEXITCODE -ne 0) {
            throw "psql restore failed with exit code $LASTEXITCODE"
        }
        Write-Host "[Restore] Database restore complete" -ForegroundColor Green
    }
    catch {
        Write-Error "[Restore] Database restore failed: $_"
        exit 1
    }
}
else {
    Write-Error "[Restore] Database dump file not found: $dbFile"
    exit 1
}

# 5. Restore uploaded files
$uploadsFile = "$restoreWorkDir\uploads.zip"
if (Test-Path $uploadsFile) {
    Write-Host "[Restore] Restoring uploaded files..." -ForegroundColor Yellow
    try {
        # Backup current uploads
        if ($UploadsDir -and (Test-Path $UploadsDir)) {
            $tempDir = Join-Path (Split-Path $BackupPath -Parent) "restore_temp_$restoreId"
            New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
            Move-Item -Path "$UploadsDir\*" -Destination $tempDir -Force -ErrorAction SilentlyContinue
        }

        # Extract backup uploads
        if ($UploadsDir) {
            New-Item -ItemType Directory -Path $UploadsDir -Force | Out-Null
            Expand-Archive -Path $uploadsFile -DestinationPath $UploadsDir -Force
            Write-Host "[Restore] Uploads restore complete" -ForegroundColor Green
        }
    }
    catch {
        Write-Warning "[Restore] Uploads restore failed: $_"
    }
}
else {
    Write-Warning "[Restore] No uploads archive found, skipping"
}

# 6. Run migrations (unless skipped)
if (-not $SkipMigrations) {
    Write-Host "[Restore] Running database migrations..." -ForegroundColor Yellow
    try {
        $webDir = Join-Path $PSScriptRoot "..\web"
        Push-Location $webDir
        & npx prisma migrate deploy
        Pop-Location
        Write-Host "[Restore] Migrations complete" -ForegroundColor Green
    }
    catch {
        Write-Warning "[Restore] Migrations failed: $_"
    }
}

Write-Host "[Restore] Restore finished successfully: $restoreId" -ForegroundColor Cyan
exit 0
