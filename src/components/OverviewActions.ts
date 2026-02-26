import { Atom, Registry, type Registry as RegistryNs } from "@effect-atom/atom-react";
import { Effect } from "effect";
import type { Action } from "../actions/action-types";
import { parseKeyString } from "../actions/key-matcher";
import { selectedMrAtom } from "../mergerequests/mergerequests-atom";
import { copyToClipboard } from "../system/clipboard";
import { formatDiscussionsForClipboard } from "../domain/display/discussionFormatter";
import { copyNotificationAtom } from "./Overview";
import { openUrl } from "../system/open-url";
import { overviewCursorIndexAtom, unresolvedExpandedAtom, resolvedExpandedAtom, scrollToDiscussionRequestAtom, overviewSelectableItemsAtom, getScrollId } from "./overview-selection";
import { getPipelineJobsFromMr } from "./PipelineJobsList";
import { loadJobLogAtom, jobLogDownloadSignalAtom } from "../mergerequests/open-pipelinejob-log-atom";
import { failedJobPickerItemsAtom, failedJobPickerMrAtom } from "./FailedJobPickerModal";
import { activeModalAtom } from "../ui/navigation-atom";

const getSelectableContext = (registry: RegistryNs.Registry) => {
  const selectedMr = registry.get(selectedMrAtom);
  const discussions = selectedMr?.discussions ?? [];
  const unresolvedDiscussions = discussions.filter(d => d.resolvable && !d.resolved);
  const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved);
  const items = registry.get(overviewSelectableItemsAtom);
  const cursor = registry.get(overviewCursorIndexAtom);
  const clampedCursor = Math.min(cursor, Math.max(0, items.length - 1));
  return { selectedMr, unresolvedDiscussions, resolvedDiscussions, items, cursor: clampedCursor };
};

export const overviewActionsAtom = Atom.make((get) => {
  const registry = get.registry;

  const actions: Action[] = [
    {
      id: 'overview:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate discussions',
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
      description: 'Toggle section / Open discussion',
      handler: () => {
        const { items, cursor, selectedMr, unresolvedDiscussions, resolvedDiscussions } = getSelectableContext(registry);
        const item = items[cursor];
        if (!item) return;

        if (item.type === 'unresolved-header') {
          const current = registry.get(unresolvedExpandedAtom);
          registry.set(unresolvedExpandedAtom, !current);
        } else if (item.type === 'resolved-header') {
          const current = registry.get(resolvedExpandedAtom);
          registry.set(resolvedExpandedAtom, !current);
        } else if (selectedMr?.webUrl) {
          let discussion;
          if (item.type === 'unresolved-discussion') {
            discussion = unresolvedDiscussions[item.index];
          } else if (item.type === 'resolved-discussion') {
            discussion = resolvedDiscussions[item.index];
          }
          if (discussion) {
            openUrl(`${selectedMr.webUrl}#note_${discussion.id}`);
          }
        }
      },
    },
    {
      id: 'overview:copy-url',
      keys: [parseKeyString('c')],
      displayKey: 'c',
      description: 'Copy discussion URL',
      handler: () => {
        const { items, cursor, selectedMr, unresolvedDiscussions, resolvedDiscussions } = getSelectableContext(registry);
        const item = items[cursor];
        if (!item || !selectedMr?.webUrl) return;

        let discussion;
        if (item.type === 'unresolved-discussion') {
          discussion = unresolvedDiscussions[item.index];
        } else if (item.type === 'resolved-discussion') {
          discussion = resolvedDiscussions[item.index];
        }
        if (discussion) {
          const discussionUrl = `${selectedMr.webUrl}#note_${discussion.id}`;
          copyToClipboard(discussionUrl);
        }
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
        const failedJobs = getPipelineJobsFromMr(mr).filter(({ job }) => job.status === 'FAILED');
        if (failedJobs.length === 0) return;

        if (failedJobs.length === 1) {
          registry.set(loadJobLogAtom, { mergeRequest: mr, job: failedJobs[0]!.job });
          Effect.runPromiseExit(
            Registry.getResult(registry, loadJobLogAtom, { suspendOnWaiting: true })
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
