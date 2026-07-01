# Incident Postmortem Template

**Date**: [YYYY-MM-DD]
**Authors**: [Names of people who wrote this document]
**Status**: [Draft / Under Review / Complete]
**Severity**: [SEV-1 / SEV-2 / SEV-3]

## Summary
Provide a brief, high-level summary of the incident. (e.g., "On October 4th, a database connection pool exhaustion caused the API to return 500 errors for 45 minutes, affecting 20% of active riders.")

## Timeline
Document the incident timeline in UTC. Include when the issue started, when it was detected, key actions taken, and when it was resolved.
- **08:00 UTC**: Incident began (Database CPU spiked to 100%)
- **08:05 UTC**: PagerDuty alert triggered for elevated 5xx errors
- **08:12 UTC**: Primary on-call acknowledged the alert
- **08:25 UTC**: Mitigation applied (increased PgBouncer pool limits)
- **08:45 UTC**: System returned to normal operations

## Impact
Describe the impact on users, internal teams, and the business.
- **User Impact**: E.g., Riders could not book vehicles or end rentals.
- **Duration**: How long did the impact last?
- **Scope**: How many users or what percentage of traffic was affected?

## Root Cause
Provide a detailed technical explanation of what caused the incident. Ask "Why?" multiple times to get to the true root cause (The 5 Whys method).
1. Why did the API return 5xx errors? Because it could not connect to the database.
2. Why couldn't it connect? Because the connection pool was exhausted.
3. Why was the pool exhausted? Because a poorly indexed query was causing long-running transactions.
4. Why was the query poorly indexed? Because the recent migration missed a compound index on the `status` and `createdAt` fields.

## Resolution and Recovery
Explain the steps taken to mitigate and resolve the incident.
- Increased the connection pool limit temporarily to restore service.
- Ran a hotfix migration to add the missing compound index to the database.

## Action Items
List specific, actionable tasks to prevent this from happening again. Assign an owner and a priority to each.
- [ ] Add the missing index to the Prisma schema. (Owner: @dev, Priority: High)
- [ ] Add a slow-query alert in Datadog. (Owner: @ops, Priority: Medium)
- [ ] Review all recent migrations for missing indexes. (Owner: @dba, Priority: Low)

## Lessons Learned
What went well? What could have gone better?
- **What went well**: The PagerDuty alert fired immediately, and the on-call engineer responded quickly.
- **What went wrong**: The lack of a slow-query alert meant we didn't catch the degrading performance before it caused an outage.
