# Enforces branch protection on 'main' requiring specific jobs to pass
# Requires GitHub CLI (gh) to be installed and authenticated

# Status checks required before merging
$checks = @("test", "lint-and-typecheck", "secret-scan")

# Build the required_status_checks[contexts][] arguments dynamically
$contextArgs = @()
foreach ($check in $checks) {
    $contextArgs += "-f"
    $contextArgs += "required_status_checks[contexts][]=$check"
}

gh api -X PUT /repos/{owner}/{repo}/branches/main/protection `
  -f required_status_checks[strict]=true `
  @contextArgs `
  -f enforce_admins=true `
  -f required_pull_request_reviews[dismiss_stale_reviews]=true `
  -f required_pull_request_reviews[require_code_owner_reviews]=true `
  -f required_pull_request_reviews[required_approving_review_count]=1 `
  -f restrictions=null

Write-Host "Branch protection enforced on main with checks: $($checks -join ', ')"
