# Extract Provider-Agnostic Domain Types

## Problem

`GitlabMergeRequestSchema` in `src/gitlab/gitlab-schema.ts` serves as the universal internal type for the whole app. `MergeRequestSchema` in `src/mergerequests/mergerequest-schema.ts` is a trivial pass-through (`...GitlabMergeRequestSchema.fields`). Raw GitLab GraphQL enums (`MergeRequestState`, `CiJobStatus`, `DetailedMergeStatus`) from generated code leak into ~25 files across UI components and business logic. Bitbucket projections explicitly map TO `GitlabMergeRequest`.

## Setup

- Create worktree on branch `feature/provider-agnostic-types` from `master`

## Phase 1: Create Domain Types (additive only, no existing files changed)

Create `src/domain/` directory with these files:

### `src/domain/identifiers.ts`
- `MrGid`, `MrIid` branded types (moved from `gitlab-schema.ts`)

### `src/domain/merge-request-state.ts`
- `MergeRequestStateSchema` = `Schema.Literal('all', 'closed', 'locked', 'merged', 'opened')`
- `MergeRequestState` type
- Values are identical to GitLab's but independently defined

### `src/domain/ci-status.ts`
- `CiJobStatusSchema` = `Schema.Literal('CANCELED', 'CANCELING', 'CREATED', 'FAILED', 'MANUAL', 'PENDING', 'PREPARING', 'RUNNING', 'SCHEDULED', 'SKIPPED', 'SUCCESS', 'WAITING_FOR_CALLBACK', 'WAITING_FOR_RESOURCE')`
- `CiJobStatus` type

### `src/domain/merge-status.ts`
- `DetailedMergeStatusSchema` with all status values as a superset
- Providers that don't support this (Bitbucket) return `null` for the field

### `src/domain/merge-request-schema.ts`
- `PipelineJobSchema`, `PipelineStageSchema` (using `CiJobStatusSchema` from `./ci-status`)
- `DiscussionNoteSchema`, `DiscussionSchema`
- `MergeRequestSchema` (replaces `GitlabMergeRequestSchema` as the canonical type)
- `JobHistoryEntry` interface
- All derived types: `PipelineJob`, `PipelineStage`, `DiscussionNote`, `Discussion`, `MergeRequest`
- `NoteType` discriminated union (`SystemNote`, `DiscussionComment`, `DiffComment`)

### `src/domain/index.ts`
- Barrel re-export of everything above

### `src/domain/display/jobStatus.ts`
- Moved from `src/gitlab/display/jobStatus.ts`
- `getJobStatusDisplay(status: CiJobStatus)` - imports `CiJobStatus` from `../ci-status`

### `src/domain/display/pipelineJobFiltering.ts`
- Moved from `src/gitlab/display/pipelineJobFiltering.ts`
- Imports `PipelineJob`, `PipelineStage` from `../merge-request-schema`

### `src/domain/display/discussionFormatter.ts`
- Moved from `src/gitlab/display/gitlabDiscussionFormatter.ts`
- Renamed without "gitlab" prefix
- Imports `Discussion`, `DiscussionNote` from `../merge-request-schema`

## Phase 2: Backward-Compatibility Re-exports

Make old locations re-export from domain so every existing import still compiles.

### `src/gitlab/gitlab-schema.ts`
- Replace all schema definitions with re-exports from `../domain/`
- Keep `GitlabMergeRequestSchema` as alias for `MergeRequestSchema`
- Keep `GitlabMergeRequest` as alias for `MergeRequest`

### `src/mergerequests/mergerequest-schema.ts`
- Replace with `export { MergeRequestSchema, type MergeRequest } from "../domain/merge-request-schema"`

### `src/gitlab/gitlab-graphql.ts`
- Update type re-exports (lines ~16-22) to source from domain

### `src/gitlab/display/jobStatus.ts`
- Re-export from `../../domain/display/jobStatus`

### `src/gitlab/display/pipelineJobFiltering.ts`
- Re-export from `../../domain/display/pipelineJobFiltering`

### `src/gitlab/display/gitlabDiscussionFormatter.ts`
- Re-export from `../../domain/display/discussionFormatter`

**Verify**: `tsc` should pass with zero changes to any consumer file.

## Phase 3: Migrate All Consumers (incremental, file by file)

### 3.1 Migrate `MergeRequestState` imports (~10 files)
Change `from "../graphql/generated/gitlab-base-types"` to `from "../domain/merge-request-state"`:

| File | Current Import Path |
|------|-------------------|
| `src/App.tsx` | `./graphql/generated/gitlab-base-types` |
| `src/components/MergeRequestPane.tsx` | `../graphql/generated/gitlab-base-types` |
| `src/components/MrStateTabs.tsx` | `../graphql/generated/gitlab-base-types` |
| `src/userselection/userSelection.ts` | `../graphql/generated/gitlab-base-types` |
| `src/mergerequests/mergerequests-atom.ts` | `../graphql/generated/gitlab-base-types` |
| `src/mergerequests/decide-fetch-mrs.ts` | `../graphql/generated/gitlab-base-types` |
| `src/mergerequests/mergerequests-effects.ts` | `../graphql/generated/gitlab-base-types` |
| `src/mergerequests/mergerequest-compaction-projection.ts` | `../graphql/generated/gitlab-base-types` |
| `src/gitlab/gitlab-pipeline-job-monitor-backgroundworker.ts` | `../graphql/generated/gitlab-base-types` |
| `src/gitlab/gitlab-graphql.ts` | `../graphql/generated/gitlab-base-types` |

**Note**: `src/events/gitlab-events.ts` imports both the type AND the schema from generated code. The `MergeRequestStateSchema` import used for event serialization should **stay** pointing at the generated GitLab schema (events store raw provider data). Only the `type MergeRequestState` can switch to domain.

### 3.2 Migrate `CiJobStatus` imports (~4 files)
Change `from "../../graphql/generated/gitlab-base-types"` to `from "../../domain/ci-status"`:

| File | Notes |
|------|-------|
| `src/gitlab/display/jobStatus.ts` | Already moved in Phase 1 |
| `src/gitlab/display/pipelineJobFiltering.ts` | Already moved in Phase 1 |
| `src/gitlab/gitlab-pipeline-job-monitor-backgroundworker.ts` | Also imports `MergeRequestState` |

### 3.3 Migrate `MrGid`/`MrIid` imports (~8 files)
Change `from "../gitlab/gitlab-schema"` to `from "../domain/identifiers"`:

| File |
|------|
| `src/bitbucket/bitbucket-projections.ts` |
| `src/gitlab/gitlab-projections.ts` |
| `src/gitlab/gitlab-pipeline-job-monitor-backgroundworker.ts` |
| `src/settings/settings.ts` |
| `src/settings/settings-atom.ts` |
| `src/mergerequests/mergerequests-atom.ts` |
| `src/mergerequests/decide-fetch-mrs.ts` |
| `src/mergerequests/all-mergerequests-projection.ts` |

### 3.4 Migrate `PipelineJob`/`PipelineStage`/`Discussion`/`DiscussionNote`/`JobHistoryEntry` imports (~10 files)
Change `from "../gitlab/gitlab-schema"` or `from "../gitlab/gitlab-graphql"` to `from "../domain/merge-request-schema"`:

| File | Types Used |
|------|-----------|
| `src/components/MergeRequestPane.tsx` | `PipelineStage`, `PipelineJob` |
| `src/components/MergeRequestInfo.tsx` | `Discussion`, `DiscussionNote` |
| `src/components/InfoPane.tsx` | `PipelineJob`, `PipelineStage` |
| `src/components/PipelineJobsList.tsx` | `PipelineJob`, `PipelineStage` |
| `src/components/ActivityLog.tsx` | `PipelineJob` |
| `src/components/JobHistoryModal.tsx` | `JobHistoryEntry` |
| `src/mergerequests/open-pipelinejob-log-atom.ts` | `PipelineJob` |
| `src/changetracking/mr-change-tracking-projection.ts` | `DiscussionNote`, `GitlabMergeRequest` |
| `src/settings/settings.ts` | `PipelineJobSchema` |

### 3.5 Migrate `GitlabMergeRequest` → `MergeRequest` (~6 files)

| File | Change |
|------|--------|
| `src/gitlab/gitlab-projections.ts` | Return type `GitlabMergeRequest` → `MergeRequest` |
| `src/gitlab/gitlab-graphql.ts` | Re-export `MergeRequest` instead of `GitlabMergeRequest` |
| `src/bitbucket/bitbucket-projections.ts` | Return type and function name |
| `src/bitbucket/bitbucketapi.ts` | Return type |
| `src/mergerequests/mergerequests-effects.ts` | Type references |
| `src/changetracking/mr-change-tracking-projection.ts` | Type references |

### 3.6 Update display utility imports in consumers
Update files that imported from `../gitlab/display/` to import from `../domain/display/`:

| File | Old Import | New Import |
|------|-----------|------------|
| `src/components/MergeRequestPane.tsx` | `../gitlab/display/jobStatus` | `../domain/display/jobStatus` |
| `src/components/MergeRequestPane.tsx` | `../gitlab/display/pipelineJobFiltering` | `../domain/display/pipelineJobFiltering` |
| `src/components/JobHistoryModal.tsx` | `../gitlab/display/jobStatus` | `../domain/display/jobStatus` |
| `src/components/PipelineJobsList.tsx` | `../gitlab/display/pipelineJobFiltering` | `../domain/display/pipelineJobFiltering` |
| `src/components/MergeRequestInfo.tsx` | `../gitlab/display/gitlabDiscussionFormatter` | `../domain/display/discussionFormatter` |

## Phase 4: Rename Provider-Specific References

- `mapBitbucketToGitlabMergeRequest` → `mapBitbucketToMergeRequest` in `bitbucket-projections.ts` and all callers
- `projectGitlabMrsCompactedEvent` return type cleanup
- `projectBitbucketMrsCompactedEvent` return type cleanup

## Phase 5: Clean Up Dead Code

- Remove type definitions from `src/gitlab/gitlab-schema.ts` (only re-exports remain)
- Remove re-export shim from `src/gitlab/gitlab-graphql.ts` once no consumer uses that path
- Remove old display files in `src/gitlab/display/` (replaced by re-exports to domain)
- Remove `GitlabMergeRequest` type alias everywhere once all consumers use `MergeRequest`

## What Does NOT Change

- **Events layer**: Events store raw provider API data. `gitlab-events.ts` keeps importing `MRsQuerySchema` etc. from generated GraphQL code for serialization.
- **GraphQL generated files**: `src/graphql/generated/`, `src/graphql/*.generated.ts`, `src/graphql/schemas/` - these are codegen output and stay as-is.
- **Projection functions**: Stay in `src/gitlab/gitlab-projections.ts` and `src/bitbucket/bitbucket-projections.ts` as adapter code. Only imports/return types change.
- **Jira types**: Already independent of GitLab. Deferred to a separate refactor.
- **Bitbucket schema**: `src/bitbucket/bitbucket-schema.ts` stays as-is (defines raw Bitbucket API shapes for the adapter layer).

## Verification

After each phase:
1. Run `tsc --noEmit` to verify type checking passes
2. After Phase 2 specifically, verify zero consumer changes are needed (re-exports maintain compatibility)
3. After all phases: `grep -r "from.*graphql/generated/gitlab-base-types" src/ --include="*.ts" --include="*.tsx"` should only match files in `src/graphql/`, `src/events/gitlab-events.ts`, and `src/gitlab/gitlab-schema.ts`
4. `grep -r "GitlabMergeRequest" src/ --include="*.ts" --include="*.tsx"` should only match the re-export shim in `src/gitlab/gitlab-schema.ts`
5. Run the app to verify it works end-to-end
