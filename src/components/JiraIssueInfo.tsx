import React from 'react';
import { TextAttributes } from '@opentui/core';
import type { JiraIssue, JiraComment } from '../services/jiraService';
import { extractTextFromJiraComment } from '../services/jiraService';
import { formatCompactTime } from '../formatting';

interface JiraIssueInfoProps {
  issue: JiraIssue;
}

export default function JiraIssueInfo({ issue }: JiraIssueInfoProps) {
  const renderComments = (comments: JiraComment[]) => {
    if (!comments || comments.length === 0) {
      return (
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
          wrap={true}
        >
          No comments
        </text>
      );
    }

    return (
      <box style={{ flexDirection: "column", gap: 1, width: "100%" }}>
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD, marginBottom: 1 }}
          wrap={true}
        >
          {`Comments (${comments.length})`}
        </text>
        {comments.map((comment) => {
          const commentText = extractTextFromJiraComment(comment);

          return (
            <box key={comment.id} style={{ flexDirection: "column", marginLeft: 2, marginBottom: 1, width: "100%", backgroundColor: '#1a1a1a', padding: 1 }}>
              <box style={{ flexDirection: "row", gap: 0, width: "100%" }}>
                <text
                  style={{ fg: '#8be9fd', attributes: TextAttributes.BOLD }}
                  wrap={true}
                >
                  {comment.author.displayName}
                </text>
                <text
                  style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
                  wrap={true}
                >
                  {` ${formatCompactTime(new Date(comment.created))} (${new Date(comment.created).toLocaleDateString()} ${new Date(comment.created).toLocaleTimeString()}):`}
                </text>
              </box>
              <box style={{ marginLeft: 4 }}>
                <text
                  style={{ fg: '#f1fa8c' }}
                  wrap={true}
                >
                  {commentText}
                </text>
              </box>
            </box>
          );
        })}
      </box>
    );
  };

  return (
    <box style={{ flexDirection: "column", gap: 1, width: "100%" }}>
      <text
        style={{ fg: '#f8f8f2', attributes: TextAttributes.BOLD, marginBottom: 0 }}
        wrap={true}
      >
        Jira Issue Details
      </text>

      <box style={{ flexDirection: "column", marginBottom: 1, width: "100%" }}>
        <text
          style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD }}
          wrap={true}
        >
          {`${issue.key}: ${issue.fields.summary}`}
        </text>
        <text
          style={{ fg: '#ffb86c', marginBottom: 1 }}
          wrap={true}
        >
          {`Status: ${issue.fields.status.name}`}
        </text>
        <text
          style={{ fg: '#bd93f9', marginBottom: 1 }}
          wrap={true}
        >
          {`Type: ${issue.fields.issuetype.name}`}
        </text>
        {issue.fields.parent && (
          <text
            style={{ fg: '#f1fa8c', marginBottom: 1 }}
            wrap={true}
          >
            {`${issue.fields.parent.fields.issuetype.name}: ${issue.fields.parent.key} - ${issue.fields.parent.fields.summary}`}
          </text>
        )}
        {issue.fields.assignee && (
          <text
            style={{ fg: '#8be9fd', marginBottom: 1 }}
            wrap={true}
          >
            {`Assignee: ${issue.fields.assignee.displayName}`}
          </text>
        )}
      </box>

      <box style={{ marginBottom: 1, width: "100%" }}>
        {renderComments(issue.fields.comment.comments || [])}
      </box>
    </box>
  );
}