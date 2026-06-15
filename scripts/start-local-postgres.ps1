#!/usr/bin/env pwsh
# scripts/start-local-postgres.ps1
#
# Starts a local PostgreSQL instance without Docker.
# Uses the default PostgreSQL installation path.
#
# Prerequisites:
#   - PostgreSQL binaries (pg_ctl, psql, createdb) on PATH.
#   - Run as Administrator if registering a Windows Service.
#
# Usage:
#   pwsh -File scripts/start-local-postgres.ps1
#   pwsh -File scripts/start-local-postgres.ps1 -Action stop
#   pwsh -File scripts/start-local-postgres.ps1 -Action status

param(
    [ValidateSet('start','stop','status','init')]
    [string]$Action = 'start',
    [string]$DataDir  = "$env:USERPROFILE\voltium_pgdata",
    [string]$LogFile  = "$env:USERPROFILE\voltium_pglog.log",
    [string]$Port     = '5432'
)

$ErrorActionPreference = 'Stop'

function Check-PgCtl {
    try { $null = Get-Command pg_ctl -ErrorAction Stop }
    catch {
        Write-Error "pg_ctl not found on PATH. Install PostgreSQL and add its bin/ to PATH."
        exit 1
    }
}

function Init-Cluster {
    if (Test-Path $DataDir) {
        Write-Host "Data directory already exists: $DataDir" -ForegroundColor Yellow
        return
    }
    Write-Host "Initialising PostgreSQL cluster in: $DataDir" -ForegroundColor Cyan
    pg_ctl initdb -D "$DataDir" -o "--encoding=UTF8 --locale=C"
    # Allow local connections without password for development
    Add-Content "$DataDir\pg_hba.conf" "host all all 127.0.0.1/32 trust"
    Write-Host "Cluster initialised." -ForegroundColor Green
}

function Start-Cluster {
    $running = pg_ctl status -D "$DataDir" 2>&1
    if ($running -match 'server is running') {
        Write-Host "PostgreSQL is already running." -ForegroundColor Yellow
        return
    }
    Write-Host "Starting PostgreSQL on port $Port..." -ForegroundColor Cyan
    pg_ctl start -D "$DataDir" -l "$LogFile" -o "-p $Port"
    Start-Sleep -Seconds 2
    Write-Host "PostgreSQL started. Log: $LogFile" -ForegroundColor Green
}

function Stop-Cluster {
    Write-Host "Stopping PostgreSQL..." -ForegroundColor Cyan
    pg_ctl stop -D "$DataDir" -m fast
    Write-Host "PostgreSQL stopped." -ForegroundColor Green
}

function Status-Cluster {
    pg_ctl status -D "$DataDir"
}

Check-PgCtl

switch ($Action) {
    'init'   { Init-Cluster }
    'start'  { Init-Cluster; Start-Cluster }
    'stop'   { Stop-Cluster }
    'status' { Status-Cluster }
}
