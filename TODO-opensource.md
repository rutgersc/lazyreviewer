# Open-source cleanup

Company-specific content to remove before publishing.

## Internal project/repo names
- [ ] `src/onboarding/onboarding-defaults.ts` — replace `elab/*` repos, `raftdev/*` repos, `raftdev` workspace with examples
- [ ] `default-settings.json` — replace `elab/*` projects and company-specific job names with examples

## Jira key pattern
- [ ] `src/jira/jira-service.ts` — make `ELAB-\d+` pattern configurable, rename `extractElabTickets`
- [ ] `src/gitlab/gitlab-projections.ts` — update import/call of renamed function
- [ ] `src/bitbucket/bitbucket-projections.ts` — update import/call of renamed function
- [ ] `src/changetracking/mr-change-tracking-projection.ts:237` — remove `ELAB-18404` comment

## Comments with company references
- [ ] `src/components/ActivityLog.tsx:182-183` — remove `scisure.atlassian.net` / `ELAB-18165` comment

## Files to delete / gitignore
- [ ] Delete `jira.http`
- [ ] `.gitignore` — add `lazygitlab-settings*.json` (current names not covered)
