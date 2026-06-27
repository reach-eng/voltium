$ErrorActionPreference = "Stop"

$actualTestCount = (Get-ChildItem -Path D:\voltium\flutter\integration_test\e2e_individual -Filter "*_test.dart").Count
$agentsMdContent = Get-Content D:\voltium\AGENTS.md -Raw

if ($agentsMdContent -notmatch "### Flutter E2E Tests \($actualTestCount/$actualTestCount PASSING\)") {
    Write-Error "AGENTS.md test count does not match the actual number of tests ($actualTestCount)!"
}

Write-Host "Doc drift check passed!"
