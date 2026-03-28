import { parseKeyString } from '../actions/key-matcher';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';
import { Atom } from "effect/unstable/reactivity";
import { selectedMergeRequestJiraIssuesAtom } from './InfoPane';
import { jiraCommentFocusedAtom, scrollToJiraCommentIdInJiraIssuesListAtom as scrollToJiraCommentIdInJiraIssuesListAtom, selectedJiraCommentIndexAtom, selectedJiraIndexAtom, selectedJiraSubIndexAtom } from './JiraIssuesList';

export const jiraIssuesListActionsAtom = Atom.make((get) => {
  const registry = get.registry;

  const jiraIssues = get(selectedMergeRequestJiraIssuesAtom);
  const selectedJiraIndex = get(selectedJiraIndexAtom);
  const selectedJiraSubIndex = get(selectedJiraSubIndexAtom);
  const selectedCommentIndex = get(selectedJiraCommentIndexAtom);

  if (jiraIssues.length === 0) return [];

    const commentFocused = get(jiraCommentFocusedAtom);

    const selectedIssue = jiraIssues[selectedJiraIndex];
    const hasParent = selectedIssue?.fields.parent !== undefined;
    const maxSubIndex = hasParent ? 1 : 0;
    const comments = selectedIssue?.fields.comment.comments ?? [];

    if (commentFocused) {
      return [
        {
          id: 'jira:comment-nav-down',
          keys: [parseKeyString('j'), parseKeyString('down')],
          displayKey: 'j/k, ↑/↓',
          description: 'Navigate comments',
          handler: () => {
            if (selectedCommentIndex < comments.length - 1) {
              const newIndex = selectedCommentIndex + 1;
              registry.set(selectedJiraCommentIndexAtom, newIndex);
              const comment = comments[newIndex];
              if (comment) {
                registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, `jira-comment-${comment.id}`);
              }
            }
          },
        },
        {
          id: 'jira:comment-nav-up',
          keys: [parseKeyString('k'), parseKeyString('up')],
          displayKey: '',
          description: '',
          handler: () => {
            if (selectedCommentIndex > 0) {
              const newIndex = selectedCommentIndex - 1;
              registry.set(selectedJiraCommentIndexAtom, newIndex);
              const comment = comments[newIndex];
              if (comment) {
                registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, `jira-comment-${comment.id}`);
              }
            }
          },
        },
        {
          id: 'jira:exit-comments',
          keys: [parseKeyString('escape')],
          displayKey: 'Esc',
          description: 'Exit comment mode',
          handler: () => {
            registry.set(jiraCommentFocusedAtom, false);
            registry.set(selectedJiraCommentIndexAtom, 0);
          },
        },
        {
          id: 'jira:open-browser',
          keys: [parseKeyString('i')],
          displayKey: 'i',
          description: 'Open issue in browser',
          handler: () => {
            if (selectedIssue) {
              const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
              const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
              openUrl(jiraUrl);
            }
          },
        },
        {
          id: 'jira:copy-url',
          keys: [parseKeyString('c')],
          displayKey: 'c',
          description: 'Copy issue URL',
          handler: () => {
            if (selectedIssue) {
              const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
              const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
              copyToClipboard(jiraUrl);
            }
          },
        },
      ];
    }

    // Issue-level navigation mode actions
    return [
    {
      id: 'jira:nav-down',
      keys: [parseKeyString('j'), parseKeyString('down')],
      displayKey: 'j/k, ↑/↓',
      description: 'Navigate Jira issues',
      handler: () => {
        if (selectedJiraSubIndex < maxSubIndex) {
          const newSub = selectedJiraSubIndex + 1;
          registry.set(selectedJiraSubIndexAtom, newSub);
          registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, (`jira-item-${selectedJiraIndex}-${newSub}`));
        } else if (selectedJiraIndex < jiraIssues.length - 1) {
          const newIndex = selectedJiraIndex + 1;
          registry.set(selectedJiraIndexAtom, newIndex);
          registry.set(selectedJiraSubIndexAtom, 0);
          registry.set(selectedJiraCommentIndexAtom, 0);
          registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, `jira-item-${newIndex}-0`);
        }
      },
    },
    {
      id: 'jira:nav-up',
      keys: [parseKeyString('k'), parseKeyString('up')],
      displayKey: '',
      description: '',
      handler: () => {
        if (selectedJiraSubIndex > 0) {
          const newSub = selectedJiraSubIndex - 1;
          registry.set(selectedJiraSubIndexAtom, newSub);
          registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, `jira-item-${selectedJiraIndex}-${newSub}`);
        } else if (selectedJiraIndex > 0) {
          const newIndex = selectedJiraIndex - 1;
          registry.set(selectedJiraIndexAtom, newIndex);
          const prevIssue = jiraIssues[newIndex];
          const prevMaxSub = prevIssue?.fields.parent ? 1 : 0;
          registry.set(selectedJiraSubIndexAtom, prevMaxSub);
          registry.set(selectedJiraCommentIndexAtom, 0);
          registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, `jira-item-${newIndex}-${prevMaxSub}`);
        }
      },
    },
    {
      id: 'jira:enter-comments',
      keys: [parseKeyString('return')],
      displayKey: 'Enter',
      description: 'Enter comment focus mode',
      handler: () => {
        if (comments.length > 0) {
          registry.set(jiraCommentFocusedAtom, true);
          registry.set(selectedJiraCommentIndexAtom, 0);
          const comment = comments[0];
          if (comment) {
            registry.set(scrollToJiraCommentIdInJiraIssuesListAtom, `jira-comment-${comment.id}`);
          }
        }
      },
    },
    {
      id: 'jira:open-browser',
      keys: [parseKeyString('i')],
      displayKey: 'i',
      description: 'Open issue in browser',
      handler: () => {
        if (selectedIssue) {
          const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
          const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
          openUrl(jiraUrl);
        }
      },
    },
    {
      id: 'jira:copy-url',
      keys: [parseKeyString('c')],
      displayKey: 'c',
      description: 'Copy issue URL',
      handler: () => {
        if (selectedIssue) {
          const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
          const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
          copyToClipboard(jiraUrl);
        }
      },
    },
    {
      id: 'jira:reset',
      keys: [parseKeyString('escape')],
      displayKey: 'Esc',
      description: 'Reset selection',
      handler: () => {
        registry.set(selectedJiraIndexAtom, 0);
        registry.set(selectedJiraSubIndexAtom, 0);
      },
    },
  ];
})