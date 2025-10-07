import { TextAttributes } from "@opentui/core";
import { type MergeRequest } from "./MergeRequestPane";
import { Colors } from "../constants/colors";
import { formatCompactTime } from "../formatting";
import { extractTextFromJiraComment } from "../services/jiraService";

type EventType =
  | 'mr_created'
  | 'mr_updated'
  | 'approval'
  | 'discussion_created'
  | 'discussion_resolved'
  | 'comment'
  | 'pipeline'
  | 'jira_comment';

interface Event {
  timestamp: Date;
  type: EventType;
  mrTitle: string;
  mrColor: string;
  repoPath: string;
  data: any;
}

type ColumnType = 'time' | 'repo' | 'mrTitle' | 'eventType' | 'eventDetails';

interface ActivityLogProps {
  mergeRequest: MergeRequest;
  columns: ColumnType[];
}

const getMrColor = (mrId: string): string => {
  const colors = [Colors.INFO, Colors.SECONDARY, Colors.NEUTRAL, Colors.WARNING];
  const hash = mrId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? Colors.INFO;
};

const getEventTypeLabel = (type: EventType): string => {
  switch (type) {
    case 'mr_created': return 'MR_CREATED';
    case 'mr_updated': return 'MR_UPDATED';
    case 'approval': return 'APPROVAL';
    case 'discussion_created': return 'DISCUSSION';
    case 'discussion_resolved': return 'RESOLVED';
    case 'comment': return 'COMMENT';
    case 'pipeline': return 'PIPELINE';
    case 'jira_comment': return 'JIRA';
    default: return 'UNKNOWN';
  }
};

const extractEvents = (mr: MergeRequest): Event[] => {
  const events: Event[] = [];
  const mrTitle = mr.title.substring(0, 60) + (mr.title.length > 60 ? '...' : '');
  const mrColor = getMrColor(mr.id);
  const repoPath = mr.project.fullPath;

  events.push({
    timestamp: mr.createdAt,
    type: 'mr_created',
    mrTitle,
    mrColor,
    repoPath,
    data: { author: mr.author }
  });

  mr.approvedBy.forEach(approver => {
    events.push({
      timestamp: mr.updatedAt,
      type: 'approval',
      mrTitle,
      mrColor,
      repoPath,
      data: { approver: approver.username }
    });
  });

  mr.discussions.forEach(discussion => {
    discussion.notes.forEach(note => {
      if (note.resolvable && discussion.resolved) {
        events.push({
          timestamp: note.createdAt,
          type: 'discussion_resolved',
          mrTitle,
          mrColor,
          repoPath,
          data: { author: note.author, body: note.body }
        });
      } else if (note.resolvable) {
        events.push({
          timestamp: note.createdAt,
          type: 'discussion_created',
          mrTitle,
          mrColor,
          repoPath,
          data: { author: note.author, body: note.body }
        });
      } else {
        events.push({
          timestamp: note.createdAt,
          type: 'comment',
          mrTitle,
          mrColor,
          repoPath,
          data: { author: note.author, body: note.body }
        });
      }
    });
  });

  if (mr.pipeline?.stage && mr.pipeline.stage.length > 0) {
    const allJobs = mr.pipeline.stage.flatMap(stage => stage.jobs);
    const failedJobs = allJobs.filter(job => job.status === 'FAILED');
    const hasFailures = failedJobs.length > 0;

    const latestJob = allJobs.reduce((latest, job) => {
      if (!job.startedAt) return latest;
      if (!latest || new Date(job.startedAt) > new Date(latest.startedAt)) {
        return job;
      }
      return latest;
    }, allJobs[0]);

    if (latestJob?.startedAt) {
      events.push({
        timestamp: new Date(latestJob.startedAt),
        type: 'pipeline',
        mrTitle,
        mrColor,
        repoPath,
        data: {
          hasFailures,
          failedJobs: failedJobs.map(j => j.name)
        }
      });
    }
  }

  mr.jiraIssues.forEach(issue => {
    issue.fields.comment.comments.forEach(comment => {
      events.push({
        timestamp: new Date(comment.created),
        type: 'jira_comment',
        mrTitle,
        mrColor,
        repoPath,
        data: {
          author: comment.author.displayName,
          body: extractTextFromJiraComment(comment)
        }
      });
    });
  });

  return events;
};

const getEventTypeColor = (type: EventType): string => {
  switch (type) {
    case 'mr_created': return Colors.INFO;
    case 'mr_updated': return Colors.SECONDARY;
    case 'approval': return Colors.SUCCESS;
    case 'discussion_created': return Colors.WARNING;
    case 'discussion_resolved': return Colors.SUCCESS;
    case 'comment': return Colors.PRIMARY;
    case 'pipeline': return Colors.INFO;
    case 'jira_comment': return Colors.NEUTRAL;
    default: return Colors.PRIMARY;
  }
};

const removeDatesFromString = (str: string): string => {
  return str.replace(/\d{4}-\d{2}-\d{2}/g, '').trim();
};

const formatEventDetails = (event: Event): string => {
  switch (event.type) {
    case 'mr_created':
      const author = event.data.author.padEnd(15, ' ').substring(0, 15);
      return author;
    case 'approval':
      const approver = event.data.approver.padEnd(15, ' ').substring(0, 15);
      return approver;
    case 'discussion_created':
      const discussionAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const discussionPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      return `${discussionAuthor} | ${discussionPreview}${event.data.body.length > 60 ? '...' : ''}`;
    case 'discussion_resolved':
      const resolvedAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const resolvedPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      return `${resolvedAuthor} | ${resolvedPreview}${event.data.body.length > 60 ? '...' : ''}`;
    case 'comment':
      const commentAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const commentPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      return `${commentAuthor} | ${commentPreview}${event.data.body.length > 60 ? '...' : ''}`;
    case 'pipeline':
      if (event.data.hasFailures) {
        return `FAILED: ${event.data.failedJobs.join(', ')}`;
      } else {
        return 'SUCCESS';
      }
    case 'jira_comment':
      const jiraAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const jiraPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      return `${jiraAuthor} | ${jiraPreview}${event.data.body.length > 60 ? '...' : ''}`;
    default:
      return '';
  }
};

export default function ActivityLog({ mergeRequest, columns }: ActivityLogProps) {
  const events = extractEvents(mergeRequest).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <box style={{ flexDirection: "column", gap: 0 }}>
      {events.map((event, index) => {
        const isPipeline = event.type === 'pipeline';
        const isComment = event.type === 'comment';
        const eventTypeColor = isPipeline && event.data?.hasFailures
          ? Colors.ERROR
          : isPipeline
          ? Colors.SUCCESS
          : getEventTypeColor(event.type);

        const parts: { text: string; color: string; bold?: boolean }[] = [];

        columns.forEach((column, columnIndex) => {
          if (columnIndex > 0) {
            parts.push({ text: ' | ', color: Colors.NEUTRAL });
          }

          switch (column) {
            case 'time':
              const time = formatCompactTime(event.timestamp).padEnd(5, ' ').substring(0, 5);
              parts.push({ text: time, color: event.mrColor });
              break;
            case 'repo':
              const repoName = (event.repoPath.split('/').pop() || event.repoPath).padEnd(15, ' ').substring(0, 15);
              parts.push({ text: repoName, color: event.mrColor });
              break;
            case 'mrTitle':
              const cleanedMrTitle = removeDatesFromString(event.mrTitle);
              const paddedMrTitle = cleanedMrTitle.padEnd(50, ' ').substring(0, 50);
              parts.push({ text: paddedMrTitle, color: event.mrColor });
              break;
            case 'eventType':
              const typeLabel = getEventTypeLabel(event.type).padEnd(14, ' ').substring(0, 14);
              parts.push({ text: typeLabel, color: eventTypeColor });
              break;
            case 'eventDetails':
              const details = formatEventDetails(event);
              parts.push({ text: details, color: eventTypeColor, bold: isComment });
              break;
          }
        });

        return (
          <box key={index} style={{ flexDirection: "row", gap: 0 }}>
            {parts.map((part, partIndex) => (
              <text
                key={partIndex}
                style={{
                  fg: part.color,
                  attributes: part.bold ? TextAttributes.BOLD : undefined
                }}
                wrap={false}
              >
                {part.text}
              </text>
            ))}
          </box>
        );
      })}
    </box>
  );
}
