import type { Discussion, DiscussionNote, MergeRequest } from '../merge-request-schema';

const formatTimestamp = (date: Date): string =>
  date.toISOString().replace('T', ' ').substring(0, 19);

const formatNote = (note: DiscussionNote, isFirst: boolean): string => {
  const indent = isFirst ? '' : '  ';
  const prefix = isFirst ? 'Comment by' : 'Reply by';

  return `${indent}${prefix} ${note.author} (${formatTimestamp(note.createdAt)}):
${indent}  ${note.body.split('\n').join(`\n${indent}  `)}`;
};

const formatDiscussion = (discussion: Discussion, index: number): string => {
  const firstNote = discussion.notes[0];
  if (!firstNote) return '';

  const header = `Discussion #${index + 1}`;
  const separator = '='.repeat(header.length);

  let result = `${separator}\n${header}\n${separator}\n`;

  if (firstNote.position?.filePath) {
    result += `File: ${firstNote.position.filePath}`;
    if (firstNote.position.newLine !== null) {
      result += ` (line ${firstNote.position.newLine})`;
    } else if (firstNote.position.oldLine !== null) {
      result += ` (line ${firstNote.position.oldLine})`;
    }
    result += '\n';
  }

  result += '\n';
  result += discussion.notes.map((note, noteIndex) => formatNote(note, noteIndex === 0)).join('\n\n');

  return result;
};

export const formatDiscussionsForClipboard = (mergeRequest: MergeRequest): string => {
  const unresolvedDiscussions = (mergeRequest.discussions || [])
    .filter(d => d.resolvable && !d.resolved);

  if (unresolvedDiscussions.length === 0) {
    return 'No unresolved discussions';
  }

  const headerSeparator = '='.repeat(80);

  let result = `${headerSeparator}\n`;
  result += `UNRESOLVED DISCUSSIONS FOR MERGE REQUEST\n`;
  result += `${headerSeparator}\n\n`;
  result += `Title: ${mergeRequest.title}\n`;
  result += `Author: ${mergeRequest.author}\n`;
  if (mergeRequest.diffHeadSha) {
    result += `Commit: ${mergeRequest.diffHeadSha.substring(0, 8)}\n`;
  }
  result += `URL: ${mergeRequest.webUrl}\n`;
  result += `Total unresolved discussions: ${unresolvedDiscussions.length}\n`;
  result += `\n${headerSeparator}\n\n`;

  result += unresolvedDiscussions
    .map((discussion, index) => formatDiscussion(discussion, index))
    .join('\n\n');

  return result;
};
