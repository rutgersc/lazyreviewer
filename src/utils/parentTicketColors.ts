import type { MergeRequest } from '../components/MergeRequestPane';

// Color palette for parent ticket groupings (using high-contrast Dracula theme colors)
const PARENT_COLORS = [
  '#bd93f9', // purple
  '#50fa7b', // green
  '#8be9fd', // cyan
  '#ffb86c', // orange
  '#ff5555', // red
  '#f1fa8c', // yellow
  '#ff79c6', // pink (additional Dracula color)
] as const;

/**
 * Generate a consistent color for a parent ticket key
 * Uses a simple hash to ensure the same parent always gets the same color
 */
function getColorForParentTicket(parentKey: string): string {
  let hash = 0;
  for (let i = 0; i < parentKey.length; i++) {
    hash = ((hash << 5) - hash + parentKey.charCodeAt(i)) & 0xffffffff;
  }
  const colorIndex = Math.abs(hash) % PARENT_COLORS.length;
  return PARENT_COLORS[colorIndex] || PARENT_COLORS[0]; // Fallback to first color
}

/**
 * Get the parent ticket key from a merge request's Jira issues
 */
function getParentTicketKey(mr: MergeRequest): string | null {
  return mr.jiraIssues[0]?.fields.parent?.key || null;
}

/**
 * Generate color mapping for all merge requests based on their parent tickets
 * Returns a map from MR ID to background color
 */
export function generateParentTicketColorMap(mergeRequests: MergeRequest[]): Map<string, string> {
  const colorMap = new Map<string, string>();

  for (const mr of mergeRequests) {
    const parentKey = getParentTicketKey(mr);
    if (parentKey) {
      const color = getColorForParentTicket(parentKey);
      colorMap.set(mr.id, color);
    }
  }

  return colorMap;
}

