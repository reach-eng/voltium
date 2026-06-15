# Voltium Local Backup Script (Windows PowerShell)
# Usage: .\scripts\backup-local.ps1 -BackupDir "D:\VoltiumServer\data\backups\manual"
# Requires: PostgreSQL client tools (pg_dump) in PATH

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDir,

    [Parameter(Mandatory = $false)]
    [string]$DatabaseUrl = $env:DATABASE_URL,

    [Parameter(Mandatory = $false)]
    [string]$UploadsDir = $env:LOCAL_STORAGE_ROOT,

    [Parameter(Mandatory = $false)]
    [string]$SecondaryDir = $env:BACKUP_SECONDARY_ROOT
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupId = "backup_$timestamp"

Write-Host "[Backup] Starting backup: $backupId" -ForegroundColor Cyan

# Create backup directory
New-Item -ItemType Directory -Path "$BackupDir\$backupId" -Force | Out-Null
Write-Host "[Backup] Created: $BackupDir\$backupId" -ForegroundColor Green

# 1. Database dump
$dbFile = "$BackupDir\$backupId\database.sql"
Write-Host "[Backup] Dumping database..." -ForegroundColor Yellow
try {
    # pg_dump reads credentials from DATABASE_URL connection string
    & pg_dump --dbname="$DatabaseUrl" --file="$dbFile" --no-owner --no-acl
    Write-Host "[Backup] Database dump complete: $dbFile" -ForegroundColor Green
}
catch {
    Write-Error "[Backup] Database dump failed: $_"
    exit 1
}

# 2. Archive uploads
$uploadsFile = "$BackupDir\$backupId\uploads.zip"
if ($UploadsDir -and (Test-Path $UploadsDir)) {
    Write-Host "[Backup] Archiving uploads from: $UploadsDir" -ForegroundColor Yellow
    try {
        Compress-Archive -Path "$UploadsDir\*" -DestinationPath $uploadsFile -Force
        Write-Host "[Backup] Uploads archive complete: $uploadsFile" -ForegroundColor Green
    }
    catch {
        Write-Warning "[Backup] Uploads archive failed: $_"
    }
}
else {
    Write-Warning "[Backup] Uploads directory not found, skipping"
}

# 3. Create manifest
$manifest = @{
    backupId = $backupId
    timestamp = $timestamp
    createdAt = (Get-Date).ToString("o")
    database = "postgresql"
    uploadsIncluded = ($UploadsDir -and (Test-Path $UploadsDir))
} | ConvertTo-Json
$manifest | Out-File -FilePath "$BackupDir\$backupId\manifest.json" -Encoding utf8
Write-Host "[Backup] Manifest created" -ForegroundColor Green

# 4. Generate checksums
$checksums = @()
if (Test-Path $dbFile) {
    $hash = (Get-FileHash $dbFile -Algorithm SHA256).Hash.ToLower()
    $checksums += "$hash  database.sql"
}
if (Test-Path $uploadsFile) {
    $hash = (Get-FileHash $uploadsFile -Algorithm SHA256).Hash.ToLower()
    $checksums += "$hash  uploads.zip"
}
$checksums -join "`n" | Out-File -FilePath "$BackupDir\$backupId\checksums.sha256" -Encoding ascii
Write-Host "[Backup] Checksums generated" -ForegroundColor Green

# 5. Calculate size
$totalSize = 0
Get-ChildItem -Path "$BackupDir\$backupId" -Recurse -File | ForEach-Object { $totalSize += $_.Length }
Write-Host "[Backup] Backup complete: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Green

# 6. Copy to secondary location (optional)
if ($SecondaryDir) {
    Write-Host "[Backup] Copying to secondary: $SecondaryDir" -ForegroundColor Yellow
    try {
        $secondaryPath = "$SecondaryDir\manual\$backupId"
        New-Item -ItemType Directory -Path $secondaryPath -Force | Out-Null
        Copy-Item -Path "$BackupDir\$backupId\*" -Destination $secondaryPath -Recurse -Force
        Write-Host "[Backup] Secondary copy complete" -ForegroundColor Green
    }
    catch {
        Write-Warning "[Backup] Secondary copy failed: $_"
    }
}

Write-Host "[Backup] Backup finished successfully: $backupId" -ForegroundColor Cyan
exit 0
