import type { JiraIssue } from '../jira/jira-schema';
import { Colors } from '../colors';

export type StatusInfo = { text: string; color: string; dimColor?: string };

export const mapStatus = (statusName: string): StatusInfo => {
  const s = statusName.toLowerCase();
  if (s.includes('merged')) return { text: 'MGD', color: Colors.SUCCESS, dimColor: '#69a373' };
  if (s.includes('done')) return { text: 'DONE', color: Colors.SUCCESS, dimColor: '#69a373' };
  if (s.includes('reject')) return { text: 'REJ', color: Colors.ERROR, dimColor: '#a36969' };
  if (s.includes('merge')) return { text: 'MREQ', color: Colors.SUCCESS };
  if (s.includes('test in progress')) return { text: 'TIP', color: Colors.SECONDARY };
  if (s.includes('testing')) return { text: 'TEST', color: Colors.WARNING };
  if (s.includes('test') || s.includes('qa')) return { text: 'TEST', color: Colors.WARNING };
  if (s.includes('review')) return { text: 'REV', color: Colors.WARNING };
  if (s.includes('progress')) return { text: 'WIP', color: Colors.INFO };
  if (s === 'todo' || s === 'to do') return { text: 'TODO', color: Colors.PRIMARY };
  return { text: statusName.slice(0, 6).toUpperCase(), color: Colors.ERROR };
};

export type PriorityInfo = { color: string };

export const mapPriority = (priorityName: string): PriorityInfo => {
  const p = priorityName.toLowerCase();
  if (p.includes('high') || p.includes('critical') || p.includes('blocker')) return { color: '#ff5555' };
  if (p.includes('medium') || p.includes('normal')) return { color: '#ffb86c' };
  if (p.includes('low') || p.includes('minor') || p.includes('trivial')) return { color: '#6272a4' };
  return { color: '#6272a4' };
};

const EPIC_COLORS = ['#ff5555', '#50fa7b', '#8be9fd', '#bd93f9', '#f1fa8c', '#ffb86c', '#ff79c6'];

export const generateEpicColor = (key: string): string => {
  let hash = 0;
  for (const char of key) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  return EPIC_COLORS[Math.abs(hash) % EPIC_COLORS.length]!;
};

export type BoardStory = {
  issue: JiraIssue;
  displayItems: JiraIssue[];
  epicColor: string;
};

const isEpic = (issue: { fields: { issuetype: { name: string } } }) =>
  issue.fields.issuetype.name.toLowerCase() === 'epic';

const getEpicKey = (issue: JiraIssue): string | null => {
  const parent = issue.fields.parent;
  if (!parent) return null;
  return isEpic(parent) ? parent.key : null;
};

const isSubtask = (issue: JiraIssue): boolean => {
  const parent = issue.fields.parent;
  return parent !== undefined && !isEpic(parent);
};

export const transformToBoard = (issues: readonly JiraIssue[]): BoardStory[] => {
  const subtasksByParent = new Map<string, JiraIssue[]>();
  const parents: JiraIssue[] = [];

  issues.forEach((issue) => {
    if (isSubtask(issue)) {
      const parentKey = issue.fields.parent!.key;
      subtasksByParent.set(parentKey, [...(subtasksByParent.get(parentKey) ?? []), issue]);
    } else {
      parents.push(issue);
    }
  });

  return parents.map(p => {
    const epicKey = getEpicKey(p);
    return {
      issue: p,
      displayItems: [p, ...(subtasksByParent.get(p.key) ?? [])],
      epicColor: epicKey ? generateEpicColor(epicKey) : '#44475a',
    };
  });
};

export type FlatBoardItem = {
  storyIndex: number;
  itemIndex: number;
  story: BoardStory;
  item: JiraIssue;
  isStoryWithoutSubtasks: boolean;
};

export const flattenBoard = (stories: BoardStory[], collapsed: boolean): FlatBoardItem[] =>
  stories.flatMap((story, storyIndex) => {
    const items = collapsed ? [story.displayItems[0]!] : story.displayItems;
    return items.map((item, itemIndex) => ({
      storyIndex,
      itemIndex,
      story,
      item,
      isStoryWithoutSubtasks: story.displayItems.length === 1,
    }));
  });

const priorityOrder = (name: string): number => {
  const p = name.toLowerCase();
  if (p.includes('blocker') || p.includes('critical')) return 0;
  if (p.includes('high')) return 1;
  if (p.includes('medium') || p.includes('normal')) return 2;
  if (p.includes('low')) return 3;
  if (p.includes('minor') || p.includes('trivial')) return 4;
  return 5;
};

export const sortStories = (stories: BoardStory[], order: 'default' | 'epic' | 'priority'): BoardStory[] => {
  if (order === 'default') return stories;

  return [...stories].sort((a, b) => {
    if (order === 'epic') {
      const epicA = a.issue.fields.parent?.fields.summary ?? 'zzz';
      const epicB = b.issue.fields.parent?.fields.summary ?? 'zzz';
      return epicA.localeCompare(epicB);
    }
    if (order === 'priority') {
      return priorityOrder(a.issue.fields.priority.name) - priorityOrder(b.issue.fields.priority.name);
    }
    return 0;
  });
};
