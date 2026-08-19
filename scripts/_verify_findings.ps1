$base = 'D:\voltium\web\prisma\migrations'
function Dump($name, $patterns) {
  $path = Join-Path $base (Join-Path $name 'migration.sql')
  if (-not (Test-Path $path)) { Write-Output "## $name : NOT PRESENT"; return }
  $content = Get-Content $path -Raw
  $lines = ($content -split "`n").Count
  Write-Output "## $name ($lines lines)"
  foreach ($p in $patterns) {
    $count = ([regex]::Matches($content, $p)).Count
    Write-Output ("   [" + $p + "] = " + $count)
  }
  Write-Output ""
}

Write-Output "=== lifecycle backfill (idempotent rewrite, 2026-08-07) ==="
Dump '20260807000001_idempotent_lifecycle_stage_backfill' @('"riders"','"Rider"','lifecycleStage','ON CONFLICT','DO \$')

Write-Output "=== corrected check-constraints (2026-08-07) ==="
Dump '20260807000000_add_check_constraints_corrected' @('"riders"','"Rider"','CHECK','IF EXISTS')

Write-Output "=== rental period tracking (2026-08-04, backs the fixed rent job) ==="
Dump '20260804001000_rental_lease_period_tracking' @('nextRentDueAt','periodNo','lastPaidAt','rental_lease')

Write-Output "=== drop: admin legacy permissions ==="
Dump '20260806000000_drop_admin_legacy_permissions' @('"admins"','admin_has_permissions','DROP COLUMN','RAISE EXCEPTION','IF EXISTS')

Write-Output "=== drop: rider legacy string columns ==="
Dump '20260806010000_drop_rider_legacy_string_columns' @('"riders"','"Rider"','pickupHubId','DROP COLUMN','RAISE EXCEPTION')

Write-Output "=== drop: rider legacy lifecycle status ==="
Dump '20260806020000_drop_rider_legacy_lifecycle_status' @('lifecycleStatus','lifecycleStage','DROP COLUMN','RAISE EXCEPTION')
