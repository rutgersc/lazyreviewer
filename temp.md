# Unified Action System Implementation Plan

## Problem
Actions are defined twice:
1. In `useKeyboard` callbacks (switch statements matching `ParsedKey`)
2. In `HelpModal`'s `buildPaneKeys`/`buildGlobalKeys` for display

## Solution Overview
- Actions defined inline in component using in-scope state (no deps interface)
- Component writes actions to `paneActionsAtom` when active
- App.tsx reads `paneActionsAtom`, handles single useKeyboard
- App.tsx passes actions to HelpModal as props

---

## Core Types

```typescript
// src/actions/action-types.ts
interface KeyMatcher {
  name: string;        // 'c', 'return', 'escape', etc.
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

interface Action {
  id: string;
  keys: KeyMatcher[];           // For matching ParsedKey
  displayKey: string;           // For HelpModal: 'j/k, ↑/↓'
  description: string;
  handler: () => void | Promise<void>;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App.tsx                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Define global actions inline                       │ │
│  │  2. Read paneActionsAtom (set by active component)     │ │
│  │  3. Single useKeyboard for ALL actions                 │ │
│  │  4. Pass paneActions + globalActions to HelpModal      │ │
│  └────────────────────────────────────────────────────────┘ │
│                  reads ▲                │                   │
│                        │                ▼                   │
│              ┌─────────┴───────┐  ┌───────────────────────┐ │
│              │ paneActionsAtom │  │ <HelpModal            │ │
│              └─────────────────┘  │   paneActions={...}   │ │
│                  sets ▲           │   globalActions={...} │ │
│                       │           │ />                    │ │
└───────────────────────│───────────┴───────────────────────┘
                        │
┌───────────────────────│───────────────────────────────────┐
│  MergeRequestPane.tsx │                                    │
│  ┌────────────────────┴─────────────────────────────────┐ │
│  │  const actions = useMemo(() => [...], [deps])        │ │
│  │  useEffect(() => { if (isActive) setActions(actions) }) │
│  │  // NO useKeyboard - App.tsx handles it              │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Create `src/actions/action-types.ts`** - Action, KeyMatcher interfaces
2. **Create `src/actions/key-matcher.ts`** - parseKeyString, matchesKey, matchesAnyKey
3. **Create `src/actions/actions-atom.ts`** - `paneActionsAtom: atom<Action[]>([])`

### Phase 2: Update Components
4. **Update each component** to define actions inline and set atom:
   - `MergeRequestPane.tsx` - define actions in useMemo, set `paneActionsAtom` when active
   - `Overview.tsx` - same pattern
   - `JiraIssuesList.tsx` - same pattern
   - `PipelineJobsList.tsx` - same pattern
   - `UserSelectionPane.tsx` - same pattern
   - Remove `useKeyboard` from all these components

### Phase 3: Centralize in App.tsx
5. **Update App.tsx**:
   - Define global actions inline
   - Read `paneActionsAtom` for pane-specific actions
   - Single `useKeyboard` handler that matches all actions
   - Pass actions to HelpModal as props

### Phase 4: Update HelpModal
6. **Update HelpModal.tsx**:
   - Accept `paneActions` and `globalActions` as props
   - Remove `buildPaneKeys`, `buildGlobalKeys`, `HelpModalActions` interface

---

## Component Pattern (Inline)

```typescript
// src/components/MergeRequestPane.tsx
import type { Action } from '../actions/action-types';
import { parseKeyString } from '../actions/key-matcher';
import { paneActionsAtom } from '../actions/actions-atom';

export default function MergeRequestPane() {
  // Existing state - all in scope
  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const [selectedIndex, setSelectedMRIndex] = useAtom(selectedMrIndexAtom);
  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const [activeModal, setActiveModal] = useAtom(activeModalAtom);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const { scrollToItem } = useAutoScroll({ lookahead: 2 });

  const setPaneActions = useAtomSet(paneActionsAtom);
  const isActive = activePane === ActivePane.MergeRequests;

  // Actions defined inline - uses in-scope state, no deps interface
  const actions: Action[] = useMemo(() => [
    {
      id: 'mr:focus-info',
      keys: [parseKeyString('return')],
      displayKey: 'Enter',
      description: 'Focus info pane',
      handler: () => setActivePane(ActivePane.InfoPane),
    },
    {
      id: 'mr:filter',
      keys: [parseKeyString('f')],
      displayKey: 'f',
      description: 'Filter MRs by state',
      handler: () => setActiveModal('mrFilter'),
    },
    {
      id: 'mr:copy-branch',
      keys: [parseKeyString('c')],
      displayKey: 'c',
      description: 'Copy branch name',
      handler: async () => {
        const mr = mergeRequests[selectedIndex];
        if (mr) {
          await copyToClipboard(mr.sourcebranch);
          setCopyNotification(`Copied: ${mr.sourcebranch}`);
          setTimeout(() => setCopyNotification(null), 2000);
        }
      },
    },
    {
      id: 'mr:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate list',
      handler: () => {
        const newIndex = Math.min(selectedIndex + 1, mergeRequests.length - 1);
        setSelectedMRIndex(newIndex);
        scrollToItem(newIndex);
      },
    },
    // ... more actions
  ], [mergeRequests, selectedIndex]);

  // Set atom when this pane is active
  useEffect(() => {
    if (isActive) {
      setPaneActions(actions);
    }
  }, [isActive, actions, setPaneActions]);

  // NO useKeyboard - App.tsx handles keyboard

  return (
    <box>
      {/* ... existing JSX unchanged ... */}
    </box>
  );
}
```

---

## App.tsx Pattern

```typescript
// src/App.tsx
import { paneActionsAtom } from './actions/actions-atom';
import { matchesAnyKey, parseKeyString } from './actions/key-matcher';

export default function App() {
  // Existing state
  const [activePane, setActivePane] = useAtom(activePaneAtom);
  const [activeModal, setActiveModal] = useAtom(activeModalAtom);
  // ... other existing state

  // Read pane actions from atom (set by active component)
  const paneActions = useAtomValue(paneActionsAtom);

  // Global actions defined inline in App.tsx
  const globalActions: Action[] = useMemo(() => [
    {
      id: 'global:quit',
      keys: [parseKeyString('q'), parseKeyString('ctrl+c')],
      displayKey: 'q, Ctrl+C',
      description: 'Quit application',
      handler: () => process.exit(),
    },
    {
      id: 'global:refresh',
      keys: [parseKeyString('s')],
      displayKey: 's',
      description: 'Refresh merge requests',
      handler: () => refreshMergeRequests(),
    },
    {
      id: 'global:help',
      keys: [parseKeyString('?')],
      displayKey: '?',
      description: 'Show this help',
      handler: () => setActiveModal('help'),
    },
    // ... more global actions
  ], []);

  // Single keyboard handler for ALL actions
  useKeyboard((key: ParsedKey) => {
    if (key.name === 'escape' && activeModal !== 'none') {
      setActiveModal('none');
      return;
    }
    if (activeModal !== 'none') return;

    // Check pane actions first, then global
    const allActions = [...paneActions, ...globalActions];
    for (const action of allActions) {
      if (matchesAnyKey(key, action.keys)) {
        action.handler();
        return;
      }
    }
  });

  return (
    <box>
      {/* ... existing layout ... */}
      <HelpModal
        isVisible={activeModal === 'help'}
        paneActions={paneActions}
        globalActions={globalActions}
      />
    </box>
  );
}
```

---

## HelpModal Props

```typescript
// src/components/HelpModal.tsx
interface HelpModalProps {
  isVisible: boolean;
  paneActions: Action[];
  globalActions: Action[];
}

export default function HelpModal({ isVisible, paneActions, globalActions }: HelpModalProps) {
  // Convert to KeyBindings for display
  const paneKeys = paneActions.map(a => ({
    key: a.displayKey,
    description: a.description,
    action: a.handler,
  }));

  const globalKeys = globalActions.map(a => ({
    key: a.displayKey,
    description: a.description,
    action: a.handler,
  }));

  // ... existing render logic using paneKeys and globalKeys
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/actions/action-types.ts` | **New** - Action, KeyMatcher interfaces |
| `src/actions/key-matcher.ts` | **New** - parseKeyString, matchesKey, matchesAnyKey |
| `src/actions/actions-atom.ts` | **New** - `paneActionsAtom` |
| `src/components/MergeRequestPane.tsx` | Define actions inline, set atom when active, remove useKeyboard |
| `src/components/Overview.tsx` | Same pattern, remove useKeyboard |
| `src/components/JiraIssuesList.tsx` | Same pattern, remove useKeyboard |
| `src/components/PipelineJobsList.tsx` | Same pattern, remove useKeyboard |
| `src/components/UserSelectionPane.tsx` | Same pattern, remove useKeyboard |
| `src/App.tsx` | Define global actions, read paneActionsAtom, single useKeyboard, pass to HelpModal |
| `src/components/HelpModal.tsx` | Accept `paneActions`/`globalActions` props, remove builders |

---

## Key Design Benefits

1. **Single Source of Truth**: Actions defined once per component
2. **Inline Definition**: Actions use in-scope state, no deps interface
3. **Minimal Atom**: Just one `paneActionsAtom` for child→parent communication
4. **Centralized Keyboard**: Single useKeyboard in App.tsx handles all
5. **Prop Drilling to HelpModal**: Explicit data flow from App → HelpModal
