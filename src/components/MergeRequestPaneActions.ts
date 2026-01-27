import { Atom, Registry } from "@effect-atom/atom-react";
import { Effect } from "effect";
import type { Action } from "../actions/action-types";
import { parseKeyString } from "../actions/key-matcher";
import { activePaneAtom, activeModalAtom, type ActiveModal } from "../ui/navigation-atom";
import { ActivePane } from "../userselection/userSelection";
import { unwrappedMergeRequestsAtom, selectedMrIndexAtom, filterMrStateAtom, refetchSelectedMrAtom } from "../mergerequests/mergerequests-atom";
import { toggleIgnoreMergeRequestAtom, toggleSeenMergeRequestAtom, toggleMonitorMergeRequestAtom } from "../settings/settings-atom";
import { copyToClipboard } from "../system/clipboard";
import { openUrl } from "../system/open-url";
import { copyNotificationRequestAtom, scrollToItemRequestAtom } from "./MergeRequestPane";

const getSelectedMr = (registry: Registry.Registry) => {
  const mergeRequests = registry.get(unwrappedMergeRequestsAtom);
  const selectedIndex = registry.get(selectedMrIndexAtom);
  return mergeRequests[selectedIndex];
};

export const mrActionsAtom = Atom.make((get) => {
  const mergeRequestsLength = get(unwrappedMergeRequestsAtom).length;
  const registry = get.registry;

  const actions: Action[] = [
    {
      id: 'mr:focus-info',
      keys: [parseKeyString('return')],
      displayKey: 'Enter',
      description: 'Focus info pane',
      handler: () => registry.set(activePaneAtom, ActivePane.InfoPane),
    },
    {
      id: 'mr:back',
      keys: [parseKeyString('escape')],
      displayKey: 'Esc',
      description: 'Return to facts pane',
      handler: () => registry.set(activePaneAtom, ActivePane.Facts),
    },
    {
      id: 'mr:sort',
      keys: [parseKeyString('f')],
      displayKey: 'f',
      description: 'Sort MRs',
      handler: () => registry.set(activeModalAtom, 'mrSort'),
    },
    {
      id: 'mr:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate list',
      handler: () => {
        if (mergeRequestsLength > 0) {
          const selectedIndex = registry.get(selectedMrIndexAtom);
          const newIndex = selectedIndex < mergeRequestsLength - 1 ? selectedIndex + 1 : 0;
          registry.set(selectedMrIndexAtom, newIndex);
          registry.set(scrollToItemRequestAtom, newIndex);
        }
      },
    },
    {
      id: 'mr:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        if (mergeRequestsLength > 0) {
          const selectedIndex = registry.get(selectedMrIndexAtom);
          const newIndex = selectedIndex > 0 ? selectedIndex - 1 : mergeRequestsLength - 1;
          registry.set(selectedMrIndexAtom, newIndex);
          registry.set(scrollToItemRequestAtom, newIndex);
        }
      },
    },
    {
      id: 'mr:copy-branch',
      keys: [parseKeyString('c')],
      displayKey: 'c',
      description: 'Copy branch name',
      handler: () => {
        const mr = getSelectedMr(registry);
        if (mr) {
          const sourceBranch = mr.sourcebranch;
          copyToClipboard(sourceBranch).then((success) => {
            if (success) {
              registry.set(copyNotificationRequestAtom, `Copied: ${sourceBranch}`);
              setTimeout(() => {
                return registry.set(copyNotificationRequestAtom, null);
              }, 2000);
            } else {
              registry.set(copyNotificationRequestAtom, 'Copy failed!');
              setTimeout(() => registry.set(copyNotificationRequestAtom, null), 2000);
            }
          });
        }
      },
    },
    {
      id: 'mr:open-browser',
      keys: [parseKeyString('x')],
      displayKey: 'x',
      description: 'Open MR in browser',
      handler: () => {
        const mr = getSelectedMr(registry);
        if (mr) {
          openUrl(mr.webUrl);
        }
      },
    },
    {
      id: 'mr:git-switch',
      keys: [parseKeyString('g')],
      displayKey: 'g',
      description: 'Git switch to branch',
      handler: () => registry.set(activeModalAtom, 'gitSwitch'),
    },
    {
      id: 'mr:jira',
      keys: [parseKeyString('t')],
      displayKey: 't',
      description: 'Show Jira tickets',
      handler: () => registry.set(activeModalAtom, 'jira'),
    },
    {
      id: 'mr:toggle-monitor',
      keys: [parseKeyString('m')],
      displayKey: 'm',
      description: 'Toggle monitor MR',
      handler: () => {
        const mr = getSelectedMr(registry);
        if (mr) {
          registry.set(toggleMonitorMergeRequestAtom, mr.id);
        }
      },
    },
    {
      id: 'mr:view-monitored',
      keys: [parseKeyString('shift+m'), parseKeyString('w')],
      displayKey: 'w',
      description: 'View monitored MRs',
      handler: () => registry.set(activeModalAtom, 'monitoredMrs'),
    },
    {
      id: 'mr:retarget',
      keys: [parseKeyString('r')],
      displayKey: 'r',
      description: 'Retarget MR to branch',
      handler: () => registry.set(activeModalAtom, 'retarget'),
    },
    {
      id: 'mr:toggle-ignore',
      keys: [parseKeyString('backspace')],
      displayKey: 'Backspace',
      description: 'Toggle ignore MR',
      handler: () => {
        const mr = getSelectedMr(registry);
        if (mr) {
          registry.set(toggleIgnoreMergeRequestAtom, mr.id);
        }
      },
    },
    {
      id: 'mr:refresh-single',
      keys: [parseKeyString('p')],
      displayKey: 'p',
      description: 'Refresh single MR',
      handler: () => {
        const mr = getSelectedMr(registry);
        if (mr) {
          registry.set(copyNotificationRequestAtom, `Refreshing MR...`);
          registry.set(refetchSelectedMrAtom, undefined);
          Effect.runPromiseExit(
            Registry.getResult(registry, refetchSelectedMrAtom, { suspendOnWaiting: true })
          ).then((exit) => {
            if (exit._tag === 'Success' && exit.value) {
              registry.set(copyNotificationRequestAtom, `MR refreshed: ${exit.value.title}`);
            } else {
              registry.set(copyNotificationRequestAtom, 'MR refresh failed!');
            }
            setTimeout(() => registry.set(copyNotificationRequestAtom, null), 3000);
          }).catch((error: unknown) => {
            registry.set(copyNotificationRequestAtom, 'MR refresh error!');
            console.error('[SingleMR] Error:', error);
            setTimeout(() => registry.set(copyNotificationRequestAtom, null), 3000);
          });
        }
      },
    },
    {
      id: 'mr:toggle-seen',
      keys: [parseKeyString('a')],
      displayKey: 'a',
      description: 'Toggle seen status',
      handler: () => {
        const mr = getSelectedMr(registry);
        if (mr) {
          registry.set(toggleSeenMergeRequestAtom, mr.id);
        }
      },
    },
    {
      id: 'mr:filter-opened',
      keys: [parseKeyString('1')],
      displayKey: '1-5',
      description: 'Filter by state',
      handler: () => registry.set(filterMrStateAtom, 'opened'),
    },
    {
      id: 'mr:filter-merged',
      keys: [parseKeyString('2')],
      displayKey: '',
      description: '',
      handler: () => registry.set(filterMrStateAtom, 'merged'),
    },
    {
      id: 'mr:filter-closed',
      keys: [parseKeyString('3')],
      displayKey: '',
      description: '',
      handler: () => registry.set(filterMrStateAtom, 'closed'),
    },
    {
      id: 'mr:filter-locked',
      keys: [parseKeyString('4')],
      displayKey: '',
      description: '',
      handler: () => registry.set(filterMrStateAtom, 'locked'),
    },
    {
      id: 'mr:filter-all',
      keys: [parseKeyString('5')],
      displayKey: '',
      description: '',
      handler: () => registry.set(filterMrStateAtom, 'all'),
    },
  ];

  return actions;
});
