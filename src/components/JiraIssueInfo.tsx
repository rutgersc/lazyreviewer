import React from 'react';
import { TextAttributes } from '@opentui/core';
import type { JiraIssue } from '../schemas/mergeRequestSchema';
import { extractTextFromJiraComment, type JiraComment } from '../jira/jiraService';
import { formatCompactTime } from '../utils/formatting';

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
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD, marginBottom: 1 }}
          wrap={true}
        >
          {`Comments (${comments.length})`}
        </text>
        {comments.map((comment) => {
          const commentText = extractTextFromJiraComment(comment);

          return (
            <box key={comment.id} style={{ flexDirection: "column", marginLeft: 2, width: "100%", backgroundColor: '#1a1a1a', padding: 1 }}>
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
      <box style={{ flexDirection: "column", marginBottom: 1, width: "100%" }}>
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