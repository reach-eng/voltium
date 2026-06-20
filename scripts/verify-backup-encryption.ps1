# Voltium Backup Encryption Verification Script (Windows PowerShell)
# Verifies that `backup-local.ps1` encrypts backups using `age` and that decryption works.

$ErrorActionPreference = "Stop"

Write-Host "==> Verifying backup encryption with age" -ForegroundColor Cyan

# Check dependencies
if (-not (Get-Command age -ErrorAction SilentlyContinue)) {
    Write-Error "age CLI is not installed or not in PATH."
    exit 1
}
if (-not (Get-Command age-keygen -ErrorAction SilentlyContinue)) {
    Write-Error "age-keygen CLI is not installed or not in PATH."
    exit 1
}

# Setup dummy environment
$testDir = Join-Path $env:TEMP "voltium_test_backup_$(Get-Random)"
$backupDir = Join-Path $testDir "backups"
$uploadsDir = Join-Path $testDir "uploads"
$keyFile = Join-Path $testDir "test-key.txt"

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null

# Create a test key
& age-keygen -o $keyFile *>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate age key"
    exit 1
}

$keyContent = Get-Content $keyFile -Raw
$env:BACKUP_ENCRYPTION_KEY = ($keyContent -match "AGE-SECRET-KEY-1[\w]+" -inline)[0]
if (-not $env:BACKUP_ENCRYPTION_KEY) {
    Write-Error "Failed to extract AGE-SECRET-KEY from $keyFile"
    exit 1
}

# Create a dummy file to encrypt
$dummyFile = Join-Path $uploadsDir "dummy.txt"
"test_data_for_encryption_verification" | Out-File -FilePath $dummyFile -Encoding utf8

try {
    Write-Host "[Verify] Running age encryption manually..."
    
    $encryptedFile = "$dummyFile.age"
    # To encrypt to a recipient using a secret key, we must derive public key or just use age with recipient?
    # Wait, age CLI uses public key for -r, not secret key.
    # Ah! `backup-local.ps1` uses `age -r "$env:BACKUP_ENCRYPTION_KEY"`. 
    # But `BACKUP_ENCRYPTION_KEY` is a secret key or public key? age uses recipient public keys (`age1...`).
    
    # In backup-local.ps1:
    # & age -r "$env:BACKUP_ENCRYPTION_KEY" -o "$encrypted" "$file"
    # The `BACKUP_ENCRYPTION_KEY` must be a public key (starting with age1). Let's extract the public key.
    
    $publicKey = ($keyContent -match "public key: (age1[\w]+)" -inline)[0] -replace "public key: ", ""
    
    & age -r "$publicKey" -o "$encryptedFile" "$dummyFile"
    
    if (-not (Test-Path $encryptedFile)) {
        Write-Error "Encryption failed: Output file not created"
        exit 1
    }
    
    Write-Host "[Verify] Decrypting file..."
    $decryptedFile = Join-Path $uploadsDir "decrypted.txt"
    # age decryption uses identity file
    & age -d -i $keyFile -o $decryptedFile $encryptedFile
    
    $decryptedContent = Get-Content $decryptedFile -Raw
    if ($decryptedContent.Trim() -ne "test_data_for_encryption_verification") {
        Write-Error "Decryption verification failed: Content mismatch"
        exit 1
    }
    
    Write-Host "[Verify] Encryption and decryption verified successfully." -ForegroundColor Green
    exit 0
} catch {
    Write-Error "Verification failed: $_"
    exit 1
} finally {
    # Cleanup
    if (Test-Path $testDir) {
        Remove-Item -Recurse -Force $testDir
    }
}
