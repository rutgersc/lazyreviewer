import type { Change, SystemNoteChange } from './change-tracking-projection';
import type { SystemNoteType } from './mr-change-tracking-projection';
import { authorIdentityKey } from '../userselection/userSelection';

const groupableTypes: ReadonlySet<SystemNoteType> = new Set([
  'commits-added',
  'approved',
  'mentioned-in-mr'
]);

const isGroupableChange = (change: Change): change is SystemNoteChange =>
  change.type === 'system-note' && groupableTypes.has(change.systemNoteType);

const createGroupByKey = (changes: SystemNoteChange[]): Map<string, SystemNoteChange[]> => {
  const getGroupKey = (change: SystemNoteChange): string =>
  `${change.mr.mrId}|${change.systemNoteType}|${authorIdentityKey(change.author)}`;

  return changes.reduce((acc, change) => {
    const key = getGroupKey(change);
    const existing = acc.get(key);
    if (existing) {
      existing.push(change);
    } else {
      acc.set(key, [change]);
    }
    return acc;
  }, new Map<string, SystemNoteChange[]>());
};

const combineChangesIntoGroup = (group: SystemNoteChange[]): Change | undefined => {
  if (group.length === 0) return undefined;
  if (group.length === 1) return group[0];

  const firstChange = group[0];
  if (!firstChange) return undefined;

  const earliestChange = group.reduce((prev, curr) =>
    curr.changedAt < prev.changedAt ? curr : prev
  );
  const latestChange = group.reduce((prev, curr) =>
    curr.changedAt > prev.changedAt ? curr : prev
  );

  return {
    type: 'system-notes-compacted',
    systemNoteType: firstChange.systemNoteType,
    mr: firstChange.mr,
    count: group.length,
    noteIds: group.map(c => c.noteId),
    authors: [firstChange.author],
    authorDisplayNames: [firstChange.authorDisplayName],
    changedAt: earliestChange.changedAt,
    earliestChangedAt: latestChange.changedAt
  };
};

export function groupChanges(changes: Change[]): Change[] {
  const groupableChanges = changes.filter(isGroupableChange);
  const nonGroupableChanges = changes.filter(c => !isGroupableChange(c));

  const groupByKey = createGroupByKey(groupableChanges);
  const compacted = [...groupByKey.values()]
    .map(combineChangesIntoGroup)
    .filter((c): c is Change => c !== undefined);

  return [...nonGroupableChanges, ...compacted]
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
}
