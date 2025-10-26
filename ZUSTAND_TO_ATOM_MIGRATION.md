# Zustand → Effect-Atom Migration Plan

## Git Workflow & Quality Standards

**CRITICAL RULES:**
1. ✅ **Commit after each logical change** - Keep commits atomic and focused
2. ✅ **Type checking MUST pass** - Run `bun run typecheck` before every commit
3. ✅ **NO type workarounds** - NEVER use `any` or `as` type assertions to fix errors
4. ✅ **Remove migrated state from Zustand** - After migrating to atoms, remove the old state from appStore.ts
5. ✅ **Commit naming**: `[Migration Phase X.Y] Brief description`
   - Example: `[Migration Phase 1.1] Migrate activePane to activePaneAtom`
   - Example: `[Migration Phase 2.3] Migrate selectedDiscussionIndex to atom`

**Commit Workflow:**
```bash
# After completing a task:
bun run typecheck          # MUST pass - no errors allowed
git add .
git commit -m "[Migration Phase X.Y] Description"
```

---

## Current State Analysis

**Already in Atoms:**
- ✅ mergeRequests (via mergeRequestsAtom)
- ✅ selectedMergeRequest (via selectedMrIndexAtom)
- ✅ filterMrState (via filterMrStateAtom)
- ✅ userSelections (via userSelectionsAtom)
- ✅ selectedUserSelectionEntry (via selectedUserSelectionEntryAtom)

---

## Migration Phases (Ordered by Independence)

### **Phase 1: Simple UI Navigation State** (0 dependencies)
**Group: UI Navigation**
- [ ] 1.1: `activePane` → `activePaneAtom`
- [ ] 1.2: `activeModal` → `activeModalAtom`
- [ ] 1.3: `infoPaneTab` → `infoPaneTabAtom`
- [ ] 1.4: `cycleInfoPaneTab` action → writable atom with custom setter
- [ ] 1.5: Remove migrated state from Zustand store

**Files to Update:**
- `src/App.tsx` (activePane, activeModal, cycleInfoPaneTab)
- `src/components/InfoPane.tsx` (infoPaneTab, activeModal)
- `src/components/MergeRequestPane.tsx` (activePane, activeModal)
- `src/components/UserSelectionPane.tsx` (activePane, activeModal)

---

### **Phase 2: Selection Index State** (0 dependencies)
**Group: Detail Pane Selections**
- [x] 2.1: `selectedJiraIndex` → `selectedJiraIndexAtom`
- [x] 2.2: `selectedJiraSubIndex` → `selectedJiraSubIndexAtom`
- [x] 2.3: `selectedDiscussionIndex` → `selectedDiscussionIndexAtom`
- [x] 2.4: `selectedActivityIndex` → `selectedActivityIndexAtom`
- [x] 2.5: `selectedPipelineJobIndex` → `selectedPipelineJobIndexAtom`
- [x] 2.6: Remove migrated state from Zustand store

**Files to Update:**
- `src/components/InfoPane.tsx` (all selection indices)
- `src/components/JiraIssuesList.tsx` (selectedJiraIndex, selectedJiraSubIndex)
- `src/components/ActivityLog.tsx` (selectedActivityIndex)
- `src/components/PipelineJobsList.tsx` (selectedPipelineJobIndex)

---

### **Phase 3: Static/Simple Data** (0 dependencies)
**Group: User Configuration**
- [ ] 3.1: `groups` → `groupsAtom` (static)
- [ ] 3.2: `users` → `usersAtom` (static)
- [ ] 3.3: `currentUser` → `currentUserAtom` with Atom.kvs persistence
- [ ] 3.4: Remove migrated state from Zustand store

**Files to Update:**
- `src/store/appStore.ts` (extractSelectionData uses groups)
- Components that reference currentUser

**Notes:**
- Use `Atom.kvs` for currentUser to persist to settings file
- groups/users are static data, can be simple atoms

---

### **Phase 4: Persisted Sets with Settings Integration** (depends on settings.ts)
**Group: MR Filtering**
- [ ] 4.1: Create Settings Effect service
- [ ] 4.2: `ignoredMergeRequests` → `ignoredMergeRequestsAtom` with settings sync
- [ ] 4.3: `toggleIgnoreMergeRequest` → `toggleIgnoreMergeRequestAtom` function atom
- [ ] 4.4: `seenMergeRequests` → `seenMergeRequestsAtom` with settings sync
- [ ] 4.5: `toggleSeenMergeRequest` → `toggleSeenMergeRequestAtom` function atom
- [ ] 4.6: Remove migrated state from Zustand store

**Files to Update:**
- Create `src/services/settingsService.ts` (Effect service)
- `src/components/MergeRequestPane.tsx` (ignoredMergeRequests, seenMergeRequests, toggle actions)

**Implementation Notes:**
- Create Effect service for settings read/write
- Use `atomRuntime.fn()` for toggle actions that update both atom + settings file
- Use `Atom.kvs` with custom schema for Set<string>

---

### **Phase 5: Branch Differences** (depends on mergeRequestsAtom ✅)
**Group: Git Branch State**
- [ ] 5.1: Create `branchDifferencesAtom` as derived atom
- [ ] 5.2: Update components to use atom
- [ ] 5.3: Remove migrated state from Zustand store

**Files to Update:**
- `src/components/MergeRequestPane.tsx` (branchDifferences)
- `src/hooks/useRepositoryBranches.ts` (might need refactoring)

**Implementation Notes:**
- Create effect-based atom that calls `fetchBranchDifferences(mrs)` whenever MRs change
- Use `atomRuntime.atom()` with Effect for async computation

---

### **Phase 6: Job History State** (depends on Phase 2)
**Group: Pipeline Job History**
- [ ] 6.1: `jobHistoryData` → `fetchJobHistoryAtom` function atom
- [ ] 6.2: Remove `jobHistoryLoading` - use `Result.isWaiting()` instead
- [ ] 6.3: Update JobHistoryModal to use new atom
- [ ] 6.4: Remove migrated state from Zustand store

**Files to Update:**
- `src/components/JobHistoryModal.tsx`
- `src/components/PipelineJobsList.tsx` (triggers fetch)

**Implementation Notes:**
- Use `atomRuntime.fn()` for fetch action
- Return `Result<JobHistoryEntry[], E>` to get automatic loading state
- Derive selected job from selectedMr + selectedPipelineJobIndex

---

### **Phase 7: Pipeline Refetch** (depends on existing atoms ✅)
**Group: Pipeline Actions**
- [ ] 7.1: `refetchSelectedMrPipeline` → `refetchSelectedMrPipelineAtom` function atom
- [ ] 7.2: Remove migrated state from Zustand store

**Files to Update:**
- Components that trigger pipeline refetch

**Implementation Notes:**
- Use `atomRuntime.fn()` similar to `refreshMergeRequestsAtom`
- Gets selected MR from atoms, calls refetch effect, updates cache

---

### **Phase 8: Git State** (0 dependencies)
**Group: Git Branch State**
- [ ] 8.1: `lastTargetBranch` → `lastTargetBranchAtom` with Atom.kvs persistence
- [ ] 8.2: Remove migrated state from Zustand store

**Files to Update:**
- `src/components/RetargetModal.tsx`

**Implementation Notes:**
- Use `Atom.kvs` to persist to store file

---

### **Phase 9: Cleanup & Finalization**
- [ ] 9.1: Remove deprecated `fetchMrs` and `loadMrs`
- [ ] 9.2: Remove `setAtomRegistry` bridge
- [ ] 9.3: Remove Zustand from package.json
- [ ] 9.4: Delete `src/store/appStore.ts`
- [ ] 9.5: Remove file-based persistence (debug/store.json)

---

## Dependencies Between Phases

```
Phase 1 (UI State)          → No dependencies ✅
Phase 2 (Selection Indices) → No dependencies ✅
Phase 3 (Static Data)       → No dependencies ✅
Phase 4 (Persisted Sets)    → No dependencies ✅
Phase 5 (Branch Diff)       → Requires: mergeRequestsAtom ✅
Phase 6 (Job History)       → Requires: Phase 2 ✅
Phase 7 (Pipeline Refetch)  → Requires: existing atoms ✅
Phase 8 (Git State)         → No dependencies ✅
Phase 9 (Cleanup)           → Requires: All phases 1-8 complete
```

---

## Recommended Execution Order

1. **Parallel Start:** Phase 1, 2, 3, 4, 8 (independent)
2. **Then:** Phase 5 (depends on mergeRequestsAtom)
3. **Then:** Phase 6 (depends on Phase 2)
4. **Then:** Phase 7 (depends on existing atoms)
5. **Finally:** Phase 9 (cleanup)

---

## Success Criteria Per Task

- ✅ Type checking passes (`bun run typecheck`)
- ✅ No `any` or `as` type assertions used
- ✅ Application runs without errors
- ✅ Git commit created with proper naming
- ✅ No regressions in functionality

---

## Progress Tracking

**Completed Phases:** 1/9 (Phase 2 complete)

Last Updated: 2025-01-26
