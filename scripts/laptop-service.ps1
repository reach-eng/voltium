<#
.SYNOPSIS
  Voltium laptop service manager: preflight, build, start, stop, restart, status, logs, boot setup, and health.

.DESCRIPTION
  This script is the operational entrypoint for the laptop-only Voltium production architecture.
  It intentionally uses native Windows services, local PostgreSQL, PM2, and optional Cloudflare Tunnel.
  It does not use Docker, managed cloud databases, cloud object storage, Upstash, or Sentry.

.EXAMPLES
  powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 preflight
  powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 build
  powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 start
  powershell -ExecutionPolicy Bypass -File scripts/laptop-service.ps1 status
#>

param(
  [Parameter(Position = 0)]
  [ValidateSet('preflight','init-folders','build','start','stop','restart','status','logs','install-startup','uninstall-startup','health','backup-now')]
  [string]$Action = 'status',

  [string]$ProjectRoot = '',
  [string]$ServerRoot = $env:VOLTIUM_SERVER_ROOT,
  [string]$PostgresServiceName = '',
  [string]$HealthUrl = 'http://localhost:8081/api/health?detailed=true'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

if ([string]::IsNullOrWhiteSpace($ServerRoot)) {
  $ServerRoot = 'D:/VoltiumServer'
}

$WebRoot = Join-Path $ProjectRoot 'web'
$DataRoot = Join-Path $ServerRoot 'data'
$UploadsRoot = Join-Path $DataRoot 'uploads'
$BackupsRoot = Join-Path $DataRoot 'backups'
$LogsRoot = Join-Path $DataRoot 'logs'
$RestoreTempRoot = Join-Path $DataRoot 'restore-temp'
$SecureRoot = Join-Path $ServerRoot 'secure'

function Write-Step($Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail($Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red }

function Require-Command($Name, $InstallHint) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Fail "$Name not found. $InstallHint"
    return $false
  }
  Write-Ok "$Name found: $($cmd.Source)"
  return $true
}

function Find-PostgresService {
  if (-not [string]::IsNullOrWhiteSpace($PostgresServiceName)) {
    return Get-Service -Name $PostgresServiceName -ErrorAction SilentlyContinue
  }
  $services = Get-Service | Where-Object { $_.Name -match 'postgres' -or $_.DisplayName -match 'PostgreSQL' } | Sort-Object Name
  return $services | Select-Object -First 1
}

function Init-Folders {
  Write-Step 'Creating laptop service folders'
  foreach ($path in @($ServerRoot, $DataRoot, $UploadsRoot, $BackupsRoot, $LogsRoot, $RestoreTempRoot, $SecureRoot)) {
    New-Item -ItemType Directory -Force -Path $path | Out-Null
    Write-Ok $path
  }
}

function Test-Postgres {
  Write-Step 'Checking PostgreSQL Windows service and port 5432'
  $svc = Find-PostgresService
  if (-not $svc) {
    Write-Fail 'No PostgreSQL Windows service found. Install PostgreSQL and ensure it is registered as a service.'
    return $false
  }
  if ($svc.Status -ne 'Running') {
    Write-Warn "PostgreSQL service $($svc.Name) is $($svc.Status). Attempting to start..."
    Start-Service $svc.Name
    Start-Sleep -Seconds 3
    $svc = Get-Service -Name $svc.Name
  }
  if ($svc.Status -eq 'Running') { Write-Ok "PostgreSQL service running: $($svc.Name)" } else { Write-Fail "PostgreSQL service not running: $($svc.Name)"; return $false }

  $port = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
  if ($port.TcpTestSucceeded) { Write-Ok 'PostgreSQL port localhost:5432 is listening' } else { Write-Fail 'PostgreSQL port localhost:5432 is not listening'; return $false }
  return $true
}

function Test-EnvFile {
  Write-Step 'Checking production environment file'
  $envFile = Join-Path $WebRoot '.env.production.local'
  if (-not (Test-Path $envFile)) {
    Write-Fail "Missing $envFile. Create it from .env.production.example and keep it outside exports."
    return $false
  }
  $content = Get-Content $envFile -Raw
  $required = @('NODE_ENV=production','APP_ENV=production','DATA_MODE=local_laptop','STORAGE_PROVIDER=local','DATABASE_URL=')
  $ok = $true
  foreach ($item in $required) {
    if ($content -notmatch [regex]::Escape($item)) { Write-Fail "Missing required env item: $item"; $ok = $false } else { Write-Ok "Env contains: $item" }
  }
  if ($content -match 'ENABLE_TEST_OTP=true') { Write-Fail 'ENABLE_TEST_OTP must be false in production'; $ok = $false }
  if ($content -match 'ENABLE_DEV_ADMIN_LOGIN=true') { Write-Fail 'ENABLE_DEV_ADMIN_LOGIN must be false in production'; $ok = $false }
  if ($content -match 'postgresql://[^@]+@(?!(localhost|127\.0\.0\.1|\[::1\]))') { Write-Fail 'DATABASE_URL must point to localhost/127.0.0.1/::1 for laptop-only production'; $ok = $false }
  return $ok
}

function Run-Preflight {
  $ok = $true
  Write-Step 'Running Voltium laptop service preflight'
  Init-Folders
  $ok = (Require-Command node 'Install Node.js 20 LTS and add it to PATH.') -and $ok
  $ok = (Require-Command npm 'Install Node.js 20 LTS and add npm to PATH.') -and $ok
  $ok = (Require-Command pm2 'Run: npm install -g pm2') -and $ok
  if ($env:DATABASE_OFFLINE -eq 'true') {
    Write-Warn 'DATABASE_OFFLINE is true. Bypassing PostgreSQL binary and connection checks.'
  } else {
    $ok = (Require-Command psql 'Install PostgreSQL client tools and add bin folder to PATH.') -and $ok
    $ok = (Require-Command pg_dump 'Install PostgreSQL client tools and add bin folder to PATH.') -and $ok
    $ok = (Test-Postgres) -and $ok
  }
  $ok = (Test-EnvFile) -and $ok
  if ($ok) { Write-Ok 'Laptop service preflight passed' } else { Write-Fail 'Laptop service preflight failed' }
  if (-not $ok) { exit 1 }
}

function Build-App {
  Run-Preflight
  Write-Step 'Installing dependencies and building web/worker'
  Push-Location $WebRoot
  try {
    npm ci
    npx prisma validate
    npx prisma generate
    if ($env:DATABASE_OFFLINE -eq 'true') {
      Write-Warn 'DATABASE_OFFLINE is true. Skipping prisma migrate deploy.'
    } else {
      npx prisma migrate deploy
    }
    npm run build
    npm run worker:build
  } finally {
    Pop-Location
  }
  Write-Ok 'Build completed'
}

function Start-Services {
  Run-Preflight
  Write-Step 'Starting PM2 services'
  Push-Location $ProjectRoot
  try {
    pm2 start ecosystem.config.js
    pm2 save
    pm2 status
  } finally {
    Pop-Location
  }
}

function Stop-Services {
  Write-Step 'Stopping PM2 services'
  pm2 stop voltium-web -s
  pm2 stop voltium-worker -s
  pm2 status
}

function Restart-Services {
  Write-Step 'Restarting PM2 services'
  pm2 restart voltium-web -s
  pm2 restart voltium-worker -s
  pm2 status
}

function Show-Status {
  Write-Step 'Laptop service status'
  if ($env:DATABASE_OFFLINE -eq 'true') {
    Write-Warn 'DATABASE_OFFLINE is true. Bypassing PostgreSQL service check.'
  } else {
    Test-Postgres | Out-Null
  }
  pm2 status
  Write-Host "`nService folders:" -ForegroundColor Cyan
  foreach ($path in @($UploadsRoot, $BackupsRoot, $LogsRoot, $RestoreTempRoot)) {
    if (Test-Path $path) { Write-Ok $path } else { Write-Fail $path }
  }
}

function Show-Logs {
  pm2 logs --lines 100
}

function Install-Startup {
  Write-Step 'Installing PM2 Windows startup integration'
  Require-Command pm2 'Run: npm install -g pm2' | Out-Null
  if (-not (Get-Command pm2-startup -ErrorAction SilentlyContinue)) {
    npm install -g pm2-windows-startup
  }
  pm2-startup install
  pm2 save
  Write-Ok 'PM2 startup installed. Verify with Windows Task Scheduler after reboot.'
}

function Uninstall-Startup {
  Write-Step 'Removing PM2 Windows startup integration'
  if (Get-Command pm2-startup -ErrorAction SilentlyContinue) {
    pm2-startup uninstall
  }
  Write-Ok 'PM2 startup removed'
}

function Check-HealthUrl {
  Write-Step "Checking HTTP health endpoint: $HealthUrl"
  try {
    $result = Invoke-RestMethod -Uri $HealthUrl -Method GET -TimeoutSec 15
    $result | ConvertTo-Json -Depth 8
    if ($result.status -eq 'healthy') { Write-Ok 'HTTP health is healthy' } else { Write-Warn "HTTP health status: $($result.status)" }
  } catch {
    Write-Fail "Health check failed: $($_.Exception.Message)"
    exit 1
  }
}

function Run-BackupNow {
  Write-Step 'Creating on-demand backup through local Admin API is preferred.'
  Write-Host 'Use Admin -> Data Management -> Backups -> Create Backup.' -ForegroundColor Yellow
  Write-Host 'CLI fallback: run scripts/backup-local.ps1 with explicit parameters only for emergency recovery.' -ForegroundColor Yellow
}

switch ($Action) {
  'init-folders' { Init-Folders }
  'preflight' { Run-Preflight }
  'build' { Build-App }
  'start' { Start-Services }
  'stop' { Stop-Services }
  'restart' { Restart-Services }
  'status' { Show-Status }
  'logs' { Show-Logs }
  'install-startup' { Install-Startup }
  'uninstall-startup' { Uninstall-Startup }
  'health' { Check-HealthUrl }
  'backup-now' { Run-BackupNow }
}
