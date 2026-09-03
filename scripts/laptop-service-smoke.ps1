<#
.SYNOPSIS
  Voltium laptop-service smoke test for post-deploy validation.
#>
param(
  [string]$BaseUrl = 'http://localhost:8081'
)
$ErrorActionPreference = 'Stop'
# P0: /api/health/db|storage|worker are admin-or-cron gated (401 without a
# session). The smoke test is unauthenticated by design, so it asserts
# liveness on the public summary endpoint and treats 401 on the gated
# sub-routes as "gated (expected)", not failure.
$checks = @(
  '/api/health'
)
$gatedChecks = @(
  '/api/health/db',
  '/api/health/storage',
  '/api/health/worker'
)
foreach ($path in $checks) {
  $url = "$BaseUrl$path"
  Write-Host "Checking $url" -ForegroundColor Cyan
  try {
    $res = Invoke-RestMethod -Uri $url -TimeoutSec 15
    $status = $res.status
    if ($status -eq 'healthy') {
      Write-Host "[OK] $path => $status" -ForegroundColor Green
    } else {
      Write-Host "[WARN] $path => $status" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "[FAIL] $path => $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}
foreach ($path in $gatedChecks) {
  $url = "$BaseUrl$path"
  Write-Host "Checking $url (gated, 401 expected without session)" -ForegroundColor Cyan
  try {
    $null = Invoke-WebRequest -Uri $url -TimeoutSec 15 -UseBasicParsing
    Write-Host "[WARN] $path => reachable without auth (gate missing?)" -ForegroundColor Yellow
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) {
      Write-Host "[OK] $path => 401 gated (expected)" -ForegroundColor Green
    } else {
      Write-Host "[FAIL] $path => HTTP $code" -ForegroundColor Red
      exit 1
    }
  }
}
Write-Host 'Laptop service smoke test completed.' -ForegroundColor Green
