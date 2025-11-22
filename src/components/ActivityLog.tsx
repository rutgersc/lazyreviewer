import { TextAttributes, type ParsedKey } from "@opentui/core";
import { useKeyboard } from '@opentui/react';
import { type MergeRequest } from "../mergerequests/mergerequest-schema";
import { Colors } from "../colors";
import { formatCompactTime } from "../utils/formatting";
import { extractTextFromJiraComment } from "../jira/jira-service";
import type { PipelineJob } from "../gitlab/gitlab-graphql";
import { ActivePane } from '../userselection/userSelection';
import { openUrl } from '../system/open-url';
import { copyToClipboard } from '../system/clipboard';
import { useAtom, useAtomValue, useAtomSet, Result } from "@effect-atom/atom-react";
import { infoPaneTabAtom, selectedActivityIndexAtom, activeModalAtom, loadJobLogAtom, allJiraIssuesAtom } from "../store/appAtoms";
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useEffect } from 'react';

type EventType =
  | 'mr_created'
  | 'mr_updated'
  | 'approval'
  | 'discussion_created'
  | 'discussion_resolved'
  | 'comment'
  | 'pipeline'
  | 'jira_comment';

export interface Event {
  timestamp: Date;
  type: EventType;
  mrTitle: string;
  mrColor: string;
  repoPath: string;
  data: any;
  actionData?: {
    url?: string;
    job?: PipelineJob;
    discussionId?: string;
  };
}

type ColumnType = 'time' | 'repo' | 'mrTitle' | 'eventType' | 'eventDetails';

interface ActivityLogProps {
  activePane: ActivePane;
  mergeRequest: MergeRequest;
  columns: ColumnType[];
}

const getMrColor = (mrId: string): string => {
  const colors = [Colors.INFO, Colors.SECONDARY, Colors.NEUTRAL, Colors.WARNING];
  const hash = mrId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? Colors.INFO;
};

const getEventTypeLabel = (type: EventType, data?: any): string => {
  // Each label is padded to exactly 16 JavaScript characters for alignment
  switch (type) {
    case 'mr_created': return '📝 MrCreated    ';
    case 'mr_updated': return '📝 MrUpdated    ';
    case 'approval': return '✅ Approval     ';
    case 'discussion_created': return '💬 Discussion   ';
    case 'discussion_resolved': return '✅ Resolved     ';
    case 'comment': return '💭 MrComment    ';
    case 'pipeline':
      if (data?.hasFailures) return '❌ JobFailed    ';
      return '✅ JobSuccess   ';
    case 'jira_comment': return '🎫 JiraComment  ';
    default: return '❓ Unknown      ';
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
    data: { author: mr.author },
    actionData: { url: mr.webUrl }
  });

  mr.approvedBy.forEach(approver => {
    events.push({
      timestamp: mr.updatedAt,
      type: 'approval',
      mrTitle,
      mrColor,
      repoPath,
      data: { approver: approver.username },
      actionData: { url: mr.webUrl }
    });
  });

  mr.discussions.forEach(discussion => {
    discussion.notes.forEach(note => {
      const discussionUrl = `${mr.webUrl}#note_${discussion.id}`;
      if (note.resolvable && discussion.resolved) {
        events.push({
          timestamp: note.createdAt,
          type: 'discussion_resolved',
          mrTitle,
          mrColor,
          repoPath,
          data: { author: note.author, body: note.body },
          actionData: { url: discussionUrl, discussionId: discussion.id }
        });
      } else if (note.resolvable) {
        events.push({
          timestamp: note.createdAt,
          type: 'discussion_created',
          mrTitle,
          mrColor,
          repoPath,
          data: { author: note.author, body: note.body },
          actionData: { url: discussionUrl, discussionId: discussion.id }
        });
      } else {
        events.push({
          timestamp: note.createdAt,
          type: 'comment',
          mrTitle,
          mrColor,
          repoPath,
          data: { author: note.author, body: note.body },
          actionData: { url: discussionUrl, discussionId: discussion.id }
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
        },
        actionData: hasFailures ? { job: failedJobs[0] } : undefined
      });
    }
  }

  const jiraIssuesMap = useAtomValue(allJiraIssuesAtom);

  const jiraIssues = mr?.jiraIssueKeys.flatMap(k => {
    const i = jiraIssuesMap.get(k);
    return i ? [i] : [];
  }) || [];

  jiraIssues.forEach(issue => {
    issue.fields.comment.comments.forEach(comment => {
      // Convert Jira API URL to browse URL with focused comment
      // issue.self is like "https://scisure.atlassian.net/rest/api/3/issue/66048"
      // We want "https://scisure.atlassian.net/browse/ELAB-18165?focusedCommentId=149420"
      const jiraBaseUrl = issue.self.split('/rest/')[0];
      const jiraUrl = `${jiraBaseUrl}/browse/${issue.key}?focusedCommentId=${comment.id}`;
      events.push({
        timestamp: new Date(comment.created),
        type: 'jira_comment',
        mrTitle,
        mrColor,
        repoPath,
        data: {
          author: comment.author.displayName,
          body: extractTextFromJiraComment(comment)
        },
        actionData: { url: jiraUrl }
      });
    });
  });

  return events;
};

const getEventTypeColor = (type: EventType, data?: any): string => {
  // Color code by source
  if (type === 'jira_comment') {
    return '#bd93f9'; // Purple for Jira
  }
  if (type === 'pipeline') {
    return data?.hasFailures ? Colors.ERROR : Colors.SUCCESS;
  }
  // MR-related events
  return '#8be9fd'; // Cyan for MR events
};

const formatEventDetails = (event: Event): string => {
  switch (event.type) {
    case 'mr_created':
      const author = event.data.author.padEnd(6, ' ').substring(0, 6);
      return author;
    case 'approval':
      const approver = event.data.approver.padEnd(6, ' ').substring(0, 6);
      return approver;
    case 'discussion_created':
      const discussionAuthor = event.data.author.padEnd(6, ' ').substring(0, 6);
      const discussionPreview = event.data.body.replace(/\n/g, ' ');
      return `${discussionAuthor} | ${discussionPreview}`;
    case 'discussion_resolved':
      const resolvedAuthor = event.data.author.padEnd(6, ' ').substring(0, 6);
      const resolvedPreview = event.data.body.replace(/\n/g, ' ');
      return `${resolvedAuthor} | ${resolvedPreview}`;
    case 'comment':
      const commentAuthor = event.data.author.padEnd(6, ' ').substring(0, 6);
      const commentPreview = event.data.body.replace(/\n/g, ' ');
      return `${commentAuthor} | ${commentPreview}`;
    case 'pipeline':
      if (event.data.hasFailures) {
        return `${event.data.failedJobs.join(', ')}`;
      } else {
        return '';
      }
    case 'jira_comment':
      const jiraAuthor = event.data.author.padEnd(6, ' ').substring(0, 6);
      const jiraPreview = event.data.body.replace(/\n/g, ' ');
      return `${jiraAuthor} | ${jiraPreview}`;
    default:
      return '';
  }
};

export default function ActivityLog({ activePane, mergeRequest, columns }: ActivityLogProps) {
  const activeModal = useAtomValue(activeModalAtom);
  const infoPaneTab = useAtomValue(infoPaneTabAtom);
  const [selectedActivityIndex, setSelectedActivityIndex] = useAtom(selectedActivityIndexAtom);
  const runLoadJobLog = useAtomSet(loadJobLogAtom);
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2 });

  const events = extractEvents(mergeRequest).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  useKeyboard((key: ParsedKey) => {
    if (activePane !== ActivePane.InfoPane || infoPaneTab !== 'activity') return;
    if (activeModal !== 'none') return;
    if (events.length === 0) return;

    switch (key.name) {
      case 'j':
      case 'down':
        const next = Math.min(selectedActivityIndex + 1, events.length - 1);
        setSelectedActivityIndex(next);
        scrollToId(`activity-${next}`);
        break;
      case 'k':
      case 'up':
        const prev = Math.max(selectedActivityIndex - 1, 0);
        setSelectedActivityIndex(prev);
        scrollToId(`activity-${prev}`);
        break;
      case 'i':
      case 'return':
        const selectedEvent = events[selectedActivityIndex];
        if (selectedEvent && mergeRequest) {
          if (selectedEvent.type === 'pipeline' && selectedEvent.actionData?.job) {
            runLoadJobLog({ mergeRequest, job: selectedEvent.actionData.job });
          } else if (selectedEvent.actionData?.url) {
            openUrl(selectedEvent.actionData.url);
          }
        }
        break;
      case 'c':
        const event = events[selectedActivityIndex];
        if (event?.actionData?.url) {
          copyToClipboard(event.actionData.url);
        }
        break;
    }
  });

  return (
    <scrollbox
      ref={scrollBoxRef}
      style={{
        flexGrow: 1,
        width: "100%",
        contentOptions: { backgroundColor: '#282a36' },
        scrollbarOptions: {
          trackOptions: { foregroundColor: '#bd93f9', backgroundColor: '#44475a' },
        },
      }}
    >
    <box style={{ flexDirection: "column", gap: 0 }}>
      {events.map((event, index) => {
        const isSelected = index === selectedActivityIndex;
        const eventTypeColor = getEventTypeColor(event.type, event.data);

        // Build the display data
        const time = formatCompactTime(event.timestamp);
        const typeLabel = getEventTypeLabel(event.type, event.data);
        const details = formatEventDetails(event);

        return (
          <box
            key={index}
            id={`activity-${index}`}
            onMouseDown={() => {
                setSelectedActivityIndex(index);
                scrollToId(`activity-${index}`);
            }}
            style={{
              flexDirection: "row",
              gap: 0,
              backgroundColor: isSelected ? Colors.SELECTED : 'transparent'
            }}
          >
            {/* Time column - fixed width */}
            <text
              style={{ fg: event.mrColor }}
              wrapMode='none'
            >
              {time}
            </text>

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'> | </text>

            {/* Event type column - fixed width */}
            <text
              style={{ fg: eventTypeColor }}
              wrapMode='none'
            >
              {typeLabel}
            </text>

            {/* Separator */}
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'> | </text>

            {/* Event details - takes remaining space */}
            <text

              style={{ fg: Colors.PRIMARY, width: "80%" }}
              wrapMode='none'
            >
              {details}
            </text>

          </box>
        );
      })}
    </box>
    </scrollbox>
  );
}

