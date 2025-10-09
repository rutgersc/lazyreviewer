import type { ParsedKey } from '@opentui/core';
import type { JiraIssue } from '../services/jiraService';
import { openUrl } from '../utils/url';
import { copyToClipboard } from '../utils/clipboard';

interface JiraKeyHandlerParams {
  key: ParsedKey;
  jiraIssues: JiraIssue[];
  selectedJiraIndex: number;
  selectedJiraSubIndex: number;
  setSelectedJiraIndex: (index: number) => void;
  setSelectedJiraSubIndex: (index: number) => void;
}

export const handleJiraKeys = ({
  key,
  jiraIssues,
  selectedJiraIndex,
  selectedJiraSubIndex,
  setSelectedJiraIndex,
  setSelectedJiraSubIndex
}: JiraKeyHandlerParams): boolean => {
  if (jiraIssues.length === 0) return false;

  const selectedIssue = jiraIssues[selectedJiraIndex];
  const hasParent = selectedIssue?.fields.parent !== undefined;
  const maxSubIndex = hasParent ? 1 : 0;

  switch (key.name) {
    case 'j':
    case 'down':
      if (selectedJiraSubIndex < maxSubIndex) {
        setSelectedJiraSubIndex(selectedJiraSubIndex + 1);
      } else if (selectedJiraIndex < jiraIssues.length - 1) {
        setSelectedJiraIndex(selectedJiraIndex + 1);
      }
      return true;
    case 'k':
    case 'up':
      if (selectedJiraSubIndex > 0) {
        setSelectedJiraSubIndex(selectedJiraSubIndex - 1);
      } else if (selectedJiraIndex > 0) {
        setSelectedJiraIndex(selectedJiraIndex - 1);
      }
      return true;
    case 'i':
    case 'return':
      if (selectedIssue) {
        const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
        const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
        openUrl(jiraUrl);
      }
      return true;
    case 'c':
      if (selectedIssue) {
        const jiraBaseUrl = selectedIssue.self.split('/rest/')[0];
        const jiraUrl = `${jiraBaseUrl}/browse/${selectedIssue.key}`;
        copyToClipboard(jiraUrl);
      }
      return true;
    default:
      return false;
  }
};
