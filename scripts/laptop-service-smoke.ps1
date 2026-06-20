<#
.SYNOPSIS
  Voltium laptop-service smoke test for post-deploy validation.
#>
param(
  [string]$BaseUrl = 'http://localhost:8081'
)
$ErrorActionPreference = 'Stop'
$checks = @(
  '/api/health?detailed=true',
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
Write-Host 'Laptop service smoke test completed.' -ForegroundColor Green
