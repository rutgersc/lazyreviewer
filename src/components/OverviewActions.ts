import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { Effect } from "effect";
import type { Action } from "../actions/action-types";
import { parseKeyString } from "../actions/key-matcher";
import { selectedMrAtom } from "../mergerequests/mergerequests-atom";
import { copyToClipboard } from "../system/clipboard";
import { formatDiscussionsForClipboard } from "../domain/display/discussionFormatter";
import { copyNotificationAtom } from "./Overview";
import { openUrl } from "../system/open-url";
import { overviewCursorIndexAtom, unresolvedExpandedAtom, resolvedExpandedAtom, jiraCommentsExpandedAtom, scrollToDiscussionRequestAtom, overviewSelectableItemsAtom, getScrollId, toggleJiraCommentsExpanded, jiraUrlForItem } from "./overview-selection";
import { selectedMergeRequestJiraIssuesAtom } from "../mergerequests/mergerequests-atom";
import type { SelectableItem } from "./overview-selection";
import { getPipelineJobsFromMr } from "./PipelineJobsList";
import { loadJobLogAtom, jobLogDownloadSignalAtom } from "../mergerequests/open-pipelinejob-log-atom";
import { failedJobPickerItemsAtom, failedJobPickerMrAtom } from "./FailedJobPickerModal";
import { activeModalAtom } from "../ui/navigation-atom";

const getSelectableContext = (registry: AtomRegistry.AtomRegistry) => {
  const selectedMr = registry.get(selectedMrAtom);
  const discussions = selectedMr?.discussions ?? [];
  const unresolvedDiscussions = discussions.filter(d => d.resolvable && !d.resolved);
  const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved);
  const items = registry.get(overviewSelectableItemsAtom);
  const cursor = registry.get(overviewCursorIndexAtom);
  const clampedCursor = Math.min(cursor, Math.max(0, items.length - 1));
  const jiraIssues = registry.get(selectedMergeRequestJiraIssuesAtom);
  return { selectedMr, unresolvedDiscussions, resolvedDiscussions, jiraIssues, items, cursor: clampedCursor };
};

type SelectableContext = ReturnType<typeof getSelectableContext>;

const urlForItem = (item: SelectableItem, ctx: SelectableContext): string | null => {
  if (item.type === 'unresolved-discussion' || item.type === 'resolved-discussion') {
    if (!ctx.selectedMr?.webUrl) return null;
    const discussions = item.type === 'unresolved-discussion' ? ctx.unresolvedDiscussions : ctx.resolvedDiscussions;
    const discussion = discussions[item.index];
    return discussion ? `${ctx.selectedMr.webUrl}#note_${discussion.id}` : null;
  }

  return jiraUrlForItem(item, ctx.jiraIssues);
};

export const overviewActionsAtom = Atom.make((get) => {
  const registry = get.registry;

  const actions: Action[] = [
    {
      id: 'overview:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate overview',
      handler: () => {
        const { items, cursor } = getSelectableContext(registry);
        if (items.length === 0) return;
        const nextCursor = Math.min(cursor + 1, items.length - 1);
        registry.set(overviewCursorIndexAtom, nextCursor);
        const item = items[nextCursor];
        if (item) {
          registry.set(scrollToDiscussionRequestAtom, getScrollId(item));
        }
      },
    },
    {
      id: 'overview:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        const { items, cursor } = getSelectableContext(registry);
        if (items.length === 0) return;
        const prevCursor = Math.max(cursor - 1, 0);
        registry.set(overviewCursorIndexAtom, prevCursor);
        const item = items[prevCursor];
        if (item) {
          registry.set(scrollToDiscussionRequestAtom, getScrollId(item));
        }
      },
    },
    {
      id: 'overview:toggle',
      keys: [parseKeyString('enter'), parseKeyString('space')],
      displayKey: 'enter',
      description: 'Toggle section / Open item',
      handler: () => {
        const context = getSelectableContext(registry);
        const item = context.items[context.cursor];
        if (!item) return;

        if (item.type === 'unresolved-header') {
          registry.set(unresolvedExpandedAtom, !registry.get(unresolvedExpandedAtom));
          return;
        }
        if (item.type === 'resolved-header') {
          registry.set(resolvedExpandedAtom, !registry.get(resolvedExpandedAtom));
          return;
        }
        if (item.type === 'jira-comments-header') {
          registry.set(jiraCommentsExpandedAtom, toggleJiraCommentsExpanded(registry.get(jiraCommentsExpandedAtom), item.issueKey));
          return;
        }

        const url = urlForItem(item, context);
        if (url) openUrl(url);
      },
    },
    {
      id: 'overview:copy-url',
      keys: [parseKeyString('c')],
      displayKey: 'c',
      description: 'Copy item URL',
      handler: () => {
        const context = getSelectableContext(registry);
        const item = context.items[context.cursor];
        if (!item) return;

        const url = urlForItem(item, context);
        if (url) copyToClipboard(url);
      },
    },
    {
      id: 'overview:copy-all',
      keys: [parseKeyString('y')],
      displayKey: 'y',
      description: 'Copy discussions to clipboard',
      handler: () => {
        const selectedMr = registry.get(selectedMrAtom);
        if (selectedMr) {
          const formattedDiscussions = formatDiscussionsForClipboard(selectedMr);
          copyToClipboard(formattedDiscussions).then((success) => {
            if (success) {
              registry.set(copyNotificationAtom, 'Copied discussions!');
              setTimeout(() => registry.set(copyNotificationAtom, null), 2000);
            } else {
              registry.set(copyNotificationAtom, 'Copy failed!');
              setTimeout(() => registry.set(copyNotificationAtom, null), 2000);
            }
          });
        }
      },
    },
    {
      id: 'overview:inspect-failed-job',
      keys: [parseKeyString('i')],
      displayKey: 'i',
      description: 'Inspect failed job log',
      handler: () => {
        const mr = registry.get(selectedMrAtom);
        if (!mr) return;
        const failedJobs = getPipelineJobsFromMr(mr).filter(({ job }) => job.status === 'FAILED' && !job.allowFailure);
        if (failedJobs.length === 0) return;

        if (failedJobs.length === 1) {
          registry.set(loadJobLogAtom, { mergeRequest: mr, job: failedJobs[0]!.job });
          Effect.runPromiseExit(
            AtomRegistry.getResult(registry, loadJobLogAtom, { suspendOnWaiting: true })
          ).then(() => {
            registry.set(jobLogDownloadSignalAtom, registry.get(jobLogDownloadSignalAtom) + 1);
          });
          return;
        }

        registry.set(failedJobPickerItemsAtom, failedJobs);
        registry.set(failedJobPickerMrAtom, mr);
        registry.set(activeModalAtom, 'failedJobPicker');
      },
    },
  ];

  return actions;
});
