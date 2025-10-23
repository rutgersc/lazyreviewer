# Job History Modal - Implementation Plan

## User Intent
When a pipeline job fails (e.g., "gitlab apitest"), the user wants to quickly see the history of that job across ALL recent pipeline runs (all MRs, all branches, especially the main "develop" branch) to determine:
- When the failure was introduced
- Whether the current MR caused the failure or if it was pre-existing on develop
- Whether other MRs have the same failure
- The trend of that job's status over time across the entire project

## Current State Analysis
- Jobs are displayed in `PipelineJobsList.tsx` within the pipeline tab
- Only the current (head) pipeline's jobs are shown
- User must manually navigate to GitLab to check historical job runs across branches
- Job data includes: `id`, `name`, `status`, `failureMessage`, `startedAt`, `webPath`

## Dependencies Overview
```
Phase 1: GraphQL Schema & Types
  ↓
Phase 2: Data Fetching Logic
  ↓
Phase 3: UI Component & Modal
  ↓
Phase 4: Keyboard Integration
  ↓
Phase 5: State Management & Store Integration
```

---

## Phase 1: GraphQL Schema & Types

### Task 1.1: Add project pipelines query to GraphQL schema
**Dependencies**: None
**Description**: Create new GraphQL query to fetch recent pipelines across the entire project with their jobs

**Details**:
- File: `src/graphql/project-pipelines.graphql` (new)
- Query name: `ProjectPipelines`
- Fetch last N pipelines (e.g., 50) for the entire project, ordered by createdAt DESC
- **Exact Query**:
  ```graphql
  query ProjectPipelines($projectPath: ID!, $first: Int!) {
    project(fullPath: $projectPath) {
      id
      pipelines(first: $first) {
        nodes {
          id
          iid
          ref
          createdAt
          status
          source
          stages {
            nodes {
              id
              name
              jobs {
                nodes {
                  id
                  webPath
                  name
                  status
                  failureMessage
                  startedAt
                }
              }
            }
          }
        }
      }
    }
  }
  ```
- **Key fields**:
  - `ref`: Branch name (e.g., "develop", "feature/foo")
  - `source`: Pipeline source ("push", "merge_request_event", etc.)
  - `createdAt`: When the pipeline was created
  - Nested `stages.nodes.jobs.nodes`: Same structure as existing `headPipeline` queries

### Task 1.2: Generate TypeScript types
**Dependencies**: Task 1.1
**Depends on**: GraphQL schema file must exist

**Details**:
- Run: `bun run codegen`
- Generated types will appear in `src/generated/gitlab-sdk.ts`
- Verify types: `ProjectPipelinesQuery`, `ProjectPipelinesQueryVariables`

### Task 1.3: Define JobHistoryEntry interface
**Dependencies**: Task 1.2
**Depends on**: Generated GraphQL types

**Details**:
- File: `src/gitlab/gitlabgraphql.ts`
- Interface:
  ```typescript
  export interface JobHistoryEntry {
    jobId: string;
    jobName: string;
    jobStatus: CiJobStatus;
    failureMessage: string | null;
    startedAt: string;
    pipelineId: string;
    pipelineIid: number;
    pipelineRef: string;  // branch name (e.g., "develop", "feature/foo")
    pipelineCreatedAt: string;
    pipelineSource: string;  // "push", "merge_request_event", etc.
    webPath: string | null;
    isDevelopBranch: boolean;  // derived: true if ref === "develop"
  }
  ```

---

## Phase 2: Data Fetching Logic

### Task 2.1: Implement fetchJobHistory function
**Dependencies**: Phase 1 complete
**Depends on**: GraphQL query defined, types generated

**Details**:
- File: `src/gitlab/gitlabgraphql.ts`
- Function signature:
  ```typescript
  export const fetchJobHistory = async (
    projectPath: string,
    jobName: string,
    limit: number = 50
  ): Promise<JobHistoryEntry[]>
  ```
- Use generated SDK: `sdk.ProjectPipelines({ projectPath, first: limit })`
- Iterate through all pipelines and their stages/jobs
- Filter jobs by exact name match
- For each matching job, create JobHistoryEntry with:
  - Job details (id, name, status, failureMessage, startedAt, webPath)
  - Pipeline context (iid, ref, createdAt, source)
  - `isDevelopBranch: pipeline.ref === 'develop'`
- Sort by pipeline.createdAt DESC
- Return flattened list of JobHistoryEntry

### Task 2.2: Add error handling
**Dependencies**: Task 2.1
**Depends on**: fetchJobHistory function exists

**Details**:
- Handle GraphQL errors (network, auth, not found)
- Return empty array on error (don't crash)
- Log errors to console
- Consider adding to ActivityLog for user visibility

---

## Phase 3: UI Component & Modal

### Task 3.1: Create JobHistoryModal component
**Dependencies**: Phase 1 complete
**Depends on**: JobHistoryEntry type defined

**Details**:
- File: `src/components/JobHistoryModal.tsx` (new)
- Props interface:
  ```typescript
  interface JobHistoryModalProps {
    isVisible: boolean;
    jobName: string;
    jobHistory: JobHistoryEntry[];
    isLoading: boolean;
    onClose: () => void;
  }
  ```
- Follow JiraModal pattern (centered overlay, zIndex 1000)
- Header: "Job History: {jobName}" with count "(N runs across all branches)"
- Loading state: Show spinner when `isLoading: true`

### Task 3.2: Implement job history list rendering
**Dependencies**: Task 3.1
**Depends on**: Component structure created

**Details**:
- Scrollable list with `<Box flexDirection="column">`
- Each entry shows:
  - **Branch/Ref** (prominent): Show `pipelineRef` - highlight "develop" with special indicator (★ or different color)
  - Pipeline IID (clickable link concept)
  - Job status icon (use `getJobStatusDisplay()`)
  - Started date/time (format with relative time, e.g., "2d ago")
  - Failure message preview (first 80 chars if present)
- Layout per row:
  ```
  [★] develop · #1234 · ✓ SUCCESS · 2d ago
      feature/fix-auth · #1233 · ✗ FAILED · 3d ago · Test timeout...
  ```
- Use Colors from `src/colors.ts` (Dracula palette)
- Selected item highlighted with SELECTED background
- Status colors: SUCCESS (green), ERROR (red), WARNING (orange)
- Develop branch: Use SECONDARY color (yellow) for ★ indicator

### Task 3.3: Add keyboard navigation
**Dependencies**: Task 3.2
**Depends on**: List rendering implemented

**Details**:
- Use `useKeyboard` hook
- Local state: `const [selectedIndex, setSelectedIndex] = React.useState(0)`
- Keys:
  - `j`, `down` → next item (selectedIndex + 1, clamp to length)
  - `k`, `up` → previous item (selectedIndex - 1, min 0)
  - `return` → open selected job in browser via webPath (if webPath exists, call system open)
  - `escape` → onClose()
- Auto-scroll to selected item (use ref or scrollIntoView)

### Task 3.4: Add footer with keyboard hints and summary
**Dependencies**: Task 3.1
**Depends on**: Component structure created

**Details**:
- Footer box with two sections:
  - **Summary stats**: "X total runs · Y on develop · Z failures"
  - **Keyboard hints**: "j/k: navigate • enter: open • esc: close"
- Use NEUTRAL color (#bd93f9) for hint text
- Position at bottom of modal

---

## Phase 4: Keyboard Integration

### Task 4.1: Add global keyboard shortcut
**Dependencies**: None
**Depends on**: Understanding of current shortcut system

**Details**:
- File: `src/App.tsx`
- Choose shortcut: `h` (for history) when in pipeline tab with job selected
- Alternative: `ctrl+h` for global access
- Priority: Check `activePane === ActivePane.InfoPane && infoPaneTab === 'pipeline'`
- Trigger: `setShowJobHistoryModal(true)` and initiate fetch

### Task 4.2: Add shortcut to PipelineJobsList keyboard handler
**Dependencies**: Task 4.1
**Depends on**: Global shortcut pattern understood

**Details**:
- File: `src/components/PipelineJobsList.tsx`
- Existing keys: j/k (navigation), i (logs)
- Add: `h` key → trigger job history modal for currently selected job
- Guard: Only trigger if a job is selected (`selectedPipelineJobIndex >= 0`)

### Task 4.3: Update HelpModal documentation
**Dependencies**: Tasks 4.1, 4.2
**Depends on**: Shortcuts implemented

**Details**:
- File: `src/components/HelpModal.tsx`
- Add to pipeline tab section:
  - `h` → "View job history (all branches)"
- Test that help modal shows new shortcut

---

## Phase 5: State Management & Store Integration

### Task 5.1: Add modal state to AppStore
**Dependencies**: None
**Depends on**: Store structure understanding

**Details**:
- File: `src/store/appStore.ts`
- Add state:
  ```typescript
  showJobHistoryModal: boolean;
  jobHistoryData: JobHistoryEntry[];
  jobHistoryLoading: boolean;
  selectedJobForHistory: string | null; // job name
  ```

### Task 5.2: Add modal actions to AppStore
**Dependencies**: Task 5.1, Phase 2 complete
**Depends on**: State fields exist, fetchJobHistory function exists

**Details**:
- Actions:
  ```typescript
  setShowJobHistoryModal: (show: boolean) => void;
  fetchJobHistoryForSelectedJob: async () => Promise<void>;
  ```
- `fetchJobHistoryForSelectedJob` logic:
  1. Get current MR's projectPath (from `mergeRequests[selectedMergeRequest]`)
  2. Get selected job name from `selectedPipelineJobIndex`
  3. Set `jobHistoryLoading: true`
  4. Call `fetchJobHistory(projectPath, jobName)` - NOTE: No MR iid needed!
  5. Set `jobHistoryData`, `jobHistoryLoading: false`
  6. Handle errors gracefully

### Task 5.3: Integrate modal in App.tsx
**Dependencies**: Task 5.2, Phase 3 complete
**Depends on**: Modal component exists, store actions exist

**Details**:
- File: `src\App.tsx`
- Add modal to render tree (alongside JiraModal, HelpModal, etc.):
  ```tsx
  <JobHistoryModal
    isVisible={showJobHistoryModal}
    jobName={selectedJobForHistory || ''}
    jobHistory={jobHistoryData}
    isLoading={jobHistoryLoading}
    onClose={() => setShowJobHistoryModal(false)}
  />
  ```
- Update escape key priority (add jobHistory check)

### Task 5.4: Wire up keyboard trigger
**Dependencies**: Task 5.3, Task 4.2
**Depends on**: Modal integrated, shortcut handler exists

**Details**:
- In `PipelineJobsList.tsx`, when `h` is pressed:
  ```typescript
  if (key.name === 'h') {
    const selectedJob = jobs[selectedPipelineJobIndex];
    if (selectedJob) {
      set({ selectedJobForHistory: selectedJob.name });
      await fetchJobHistoryForSelectedJob();
      set({ showJobHistoryModal: true });
    }
  }
  ```
- Use clear-delay-set pattern if updating large state

---

## Phase 6: Testing & Polish

### Task 6.1: Manual testing checklist
**Dependencies**: All previous phases complete
**Depends on**: Full feature implemented

**Details**:
- [ ] Navigate to pipeline tab
- [ ] Select a job
- [ ] Press `h` key
- [ ] Modal opens with loading state
- [ ] Job history loads and displays across ALL branches
- [ ] "develop" branch runs are highlighted with ★
- [ ] Navigate with j/k keys
- [ ] Press enter to open job in browser
- [ ] Press escape to close modal
- [ ] Test with job that has no history
- [ ] Test with job that has failures vs successes
- [ ] Verify failures on develop are visible
- [ ] Verify summary stats are correct
- [ ] Verify colors are high-contrast (no #6272a4)

### Task 6.2: Run type checking
**Dependencies**: Task 6.1
**Depends on**: Manual testing passed

**Details**:
- Run: `bun run typecheck`
- Fix any type errors
- Ensure no `any` types used
- Verify all interfaces properly typed

### Task 6.3: Accessibility review
**Dependencies**: Task 6.1
**Depends on**: Manual testing passed

**Details**:
- Review all text colors for readability
- Ensure status icons are visible
- Check selected state contrast
- Verify modal header is readable
- Test on actual terminal (not just IDE)

---

## Implementation Order Summary

1. **Phase 1** (types first - required for type-driven development)
2. **Phase 2** (data fetching - can test independently)
3. **Phase 3** (UI component - can develop with mock data)
4. **Phase 5** (state management - before keyboard to have store ready)
5. **Phase 4** (keyboard integration - final wiring)
6. **Phase 6** (testing & polish)

## Key Design Decisions

- **GraphQL query**: Fetch last 50 pipelines across entire project using `project.pipelines(first: 50)`
- **Branch visibility**: Show branch/ref for each run, highlight "develop" with ★
- **Keyboard shortcut**: `h` key in pipeline tab (mnemonic: History)
- **Modal pattern**: Follow existing JiraModal pattern for consistency
- **Color scheme**: Dracula palette from Colors constant (avoid low-contrast colors)
- **Error handling**: Graceful degradation (empty list, don't crash)
- **State pattern**: Clear-delay-set if needed for large data updates
- **No useEffect**: Trigger fetch directly in keyboard handler (avoid antipattern)

## Open Questions
- Should we filter to show only specific branches (develop + current MR branch)?
- Should we limit to last N days instead of last N pipelines?
- Do we want to show comparison/diff of test results between runs?

## Success Criteria
- User can press `h` on any job in pipeline tab
- Modal opens showing last 50 runs of that job across ALL branches/MRs
- "develop" branch runs are clearly visible and highlighted
- Status and failure messages are visible
- User can quickly see if failure exists on develop
- User can navigate with keyboard
- User can open any historical job in browser
- Feature follows all project guidelines (type-driven, no useEffect antipattern, high-contrast colors)
