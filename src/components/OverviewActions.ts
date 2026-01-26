import { Atom } from "@effect-atom/atom-react";
import type { Action } from "../actions/action-types";
import { parseKeyString } from "../actions/key-matcher";
import { selectedMrAtom, selectedDiscussionIndexAtom } from "../mergerequests/mergerequests-atom";
import { copyToClipboard } from "../system/clipboard";
import { formatDiscussionsForClipboard } from "../gitlab/display/gitlabDiscussionFormatter";
import { copyNotificationAtom, scrollToDiscussionRequestAtom } from "./Overview";

const getUnresolvedDiscussions = (registry: import("@effect-atom/atom-react").Registry.Registry) => {
  const selectedMr = registry.get(selectedMrAtom);
  return selectedMr?.discussions.filter(d => d.resolvable && !d.resolved) ?? [];
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
        const unresolvedDiscussions = getUnresolvedDiscussions(registry);
        const selectedDiscussionIndex = registry.get(selectedDiscussionIndexAtom);
        if (unresolvedDiscussions.length > 0) {
          const nextIndex = Math.min(selectedDiscussionIndex + 1, unresolvedDiscussions.length - 1);
          registry.set(selectedDiscussionIndexAtom, nextIndex);
          registry.set(scrollToDiscussionRequestAtom, nextIndex);
        }
      },
    },
    {
      id: 'overview:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        const unresolvedDiscussions = getUnresolvedDiscussions(registry);
        const selectedDiscussionIndex = registry.get(selectedDiscussionIndexAtom);
        if (unresolvedDiscussions.length > 0) {
          const prevIndex = Math.max(selectedDiscussionIndex - 1, 0);
          registry.set(selectedDiscussionIndexAtom, prevIndex);
          registry.set(scrollToDiscussionRequestAtom, prevIndex);
        }
      },
    },
    {
      id: 'overview:copy-url',
      keys: [parseKeyString('c')],
      displayKey: 'c',
      description: 'Copy discussion URL',
      handler: () => {
        const unresolvedDiscussions = getUnresolvedDiscussions(registry);
        const selectedDiscussionIndex = registry.get(selectedDiscussionIndexAtom);
        const selectedMr = registry.get(selectedMrAtom);
        const discussion = unresolvedDiscussions[selectedDiscussionIndex];
        if (discussion && selectedMr?.webUrl) {
          const discussionUrl = `${selectedMr.webUrl}#note_${discussion.id}`;
          copyToClipboard(discussionUrl);
        }
      },
    },
    {
      id: 'overview:copy-all',
      keys: [parseKeyString('i')],
      displayKey: 'i',
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
  ];

  return actions;
});
