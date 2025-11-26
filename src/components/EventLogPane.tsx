import { TextAttributes } from "@opentui/core";
import { type MergeRequest } from "../mergerequests/mergerequest-schema";
import { Colors } from "../colors";
import { formatCompactTime } from "../utils/formatting";
import { extractTextFromJiraComment } from "../jira/jira-service";
import { useAtomValue } from "@effect-atom/atom-react";
import { allJiraIssuesAtom } from "../mergerequests/mergerequests-atom";

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

const getMrColor = (mrId: string): string => {
  // Generate consistent color per MR based on ID hash
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

  // MR created
  events.push({
    timestamp: mr.createdAt,
    type: 'mr_created',
    mrTitle,
    mrColor,
    repoPath,
    data: { author: mr.author }
  });

  // Approvals
  mr.approvedBy.forEach(approver => {
    // We don't have exact approval timestamp, use updatedAt as approximation
    events.push({
      timestamp: mr.updatedAt,
      type: 'approval',
      mrTitle,
      mrColor,
      repoPath,
      data: { approver: approver.username }
    });
  });

  // Discussions and comments
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

  // Pipeline - consolidate all jobs into one event
  if (mr.pipeline?.stage && mr.pipeline.stage.length > 0) {
    const allJobs = mr.pipeline.stage.flatMap(stage => stage.jobs);
    const failedJobs = allJobs.filter(job => job.status === 'FAILED');
    const hasFailures = failedJobs.length > 0;

    // Use the most recent job timestamp
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

  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);

  const jiraIssues = mr?.jiraIssueKeys.flatMap(k => {
    const i = jiraIssuesMap.get(k);
    return i ? [i] : [];
  }) || [];

  // Jira comments
  jiraIssues.forEach(issue => {
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
  // Remove dates in format YYYY-MM-DD
  return str.replace(/\d{4}-\d{2}-\d{2}/g, '').trim();
};

const formatEventLine = (event: Event): { prefix: string; typeLabel: string; suffix: string } => {
  const time = formatCompactTime(event.timestamp).padEnd(5, ' ').substring(0, 5);
  const typeLabel = getEventTypeLabel(event.type).padEnd(14, ' ').substring(0, 14);

  // Remove dates and pad MR title to fixed width (50 chars)
  const cleanedMrTitle = removeDatesFromString(event.mrTitle);
  const paddedMrTitle = cleanedMrTitle.padEnd(50, ' ').substring(0, 50);
  const repoName = (event.repoPath.split('/').pop() || event.repoPath).padEnd(15, ' ').substring(0, 15);

  // Prefix is colored by MR (without event type)
  const prefix = `${time} | ${repoName} | ${paddedMrTitle}`;

  // Suffix is colored by event type
  let suffix = '';

  switch (event.type) {
    case 'mr_created':
      const author = event.data.author.padEnd(15, ' ').substring(0, 15);
      suffix = ` | ${author}`;
      break;
    case 'approval':
      const approver = event.data.approver.padEnd(15, ' ').substring(0, 15);
      suffix = ` | ${approver}`;
      break;
    case 'discussion_created':
      const discussionAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const discussionPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      suffix = ` | ${discussionAuthor} | ${discussionPreview}${event.data.body.length > 60 ? '...' : ''}`;
      break;
    case 'discussion_resolved':
      const resolvedAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const resolvedPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      suffix = ` | ${resolvedAuthor} | ${resolvedPreview}${event.data.body.length > 60 ? '...' : ''}`;
      break;
    case 'comment':
      const commentAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const commentPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      suffix = ` | ${commentAuthor} | ${commentPreview}${event.data.body.length > 60 ? '...' : ''}`;
      break;
    case 'pipeline':
      if (event.data.hasFailures) {
        suffix = ` | FAILED: ${event.data.failedJobs.join(', ')}`;
      } else {
        suffix = ` | SUCCESS`;
      }
      break;
    case 'jira_comment':
      const jiraAuthor = event.data.author.padEnd(15, ' ').substring(0, 15);
      const jiraPreview = event.data.body.substring(0, 60).replace(/\n/g, ' ');
      suffix = ` | ${jiraAuthor} | ${jiraPreview}${event.data.body.length > 60 ? '...' : ''}`;
      break;
    default:
      suffix = '';
  }

  return { prefix, typeLabel, suffix };
};

interface EventLogPaneProps {
  mergeRequests: MergeRequest[];
  onClose: () => void;
}

export default function EventLogPane({ mergeRequests, onClose }: EventLogPaneProps) {
  const allEvents = mergeRequests.flatMap(mr => extractEvents(mr));
  const events = allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: Colors.BACKGROUND,
        zIndex: 9999,
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <box style={{ padding: 1, border: true, borderColor: Colors.INFO }}>
        <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Event Log - All Merge Requests
        </text>
      </box>

      {/* Event list */}
      <scrollbox
        style={{
          flexGrow: 1,
          contentOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          viewportOptions: {
            backgroundColor: Colors.BACKGROUND,
          },
          scrollbarOptions: {
            width: 1,
            trackOptions: {
              foregroundColor: Colors.NEUTRAL,
              backgroundColor: Colors.TRACK,
            },
          },
        }}
        focused={false}
      >
        {events.map((event, index) => {
          const formatted = formatEventLine(event);
          const isComment = event.type === 'comment';
          const isPipeline = event.type === 'pipeline';
          const eventTypeColor = isPipeline && event.data?.hasFailures
            ? Colors.ERROR
            : isPipeline
            ? Colors.SUCCESS
            : getEventTypeColor(event.type);

          return (
            <box key={index} style={{ flexDirection: "row", gap: 0 }}>
              {/* Prefix (time, repo, MR title) - colored by MR */}
              <text
                style={{
                  fg: event.mrColor,
                }}
                wrapMode='none'
              >
                {formatted.prefix}
              </text>
              {/* Event type label - colored by event type */}
              <text
                style={{
                  fg: eventTypeColor,
                  width: 15,
                }}
                wrapMode='none'
              >
                {` ${formatted.typeLabel}`}
              </text>
              {/* Suffix (event details) - colored by event type */}
              <text
                style={{
                  fg: eventTypeColor,
                  attributes: isComment ? TextAttributes.BOLD : undefined,
                }}
                wrapMode='none'
              >
                {formatted.suffix}
              </text>
            </box>
          );
        })}
      </scrollbox>

      {/* Footer */}
      <box style={{ padding: 1, border: true, borderColor: Colors.TRACK }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          Press ESC to close • {events.length} events
        </text>
      </box>
    </box>
  );
}
