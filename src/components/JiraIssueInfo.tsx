import React from 'react';
import { TextAttributes } from '@opentui/core';
import type { JiraIssue } from '../jira/jira-schema';
import { extractTextFromJiraComment, type JiraComment } from '../jira/jira-service';
import { formatCompactTime } from '../utils/formatting';
import { Colors } from '../colors';

interface JiraIssueInfoProps {
  issue: JiraIssue;
  selectedCommentIndex: number;
  commentFocused: boolean;
}

export default function JiraIssueInfo({ issue, selectedCommentIndex, commentFocused }: JiraIssueInfoProps) {
  const renderComments = (comments: JiraComment[]) => {
    if (!comments || comments.length === 0) {
      return (
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
          wrapMode='word'
        >
          No comments
        </text>
      );
    }

    return (
      <box style={{ flexDirection: "column", gap: 0, width: "100%" }}>
        <text
          style={{ fg: '#bd93f9', attributes: TextAttributes.BOLD, marginBottom: 1 }}
          wrapMode='word'
        >
          {`Comments (${comments.length})`}
        </text>
        {comments.map((comment, index) => {
          const commentText = extractTextFromJiraComment(comment);
          const isSelected = commentFocused && index === selectedCommentIndex;

          return (
            <box
              key={comment.id}
              id={`jira-comment-${comment.id}`}
              style={{ flexDirection: "column", marginLeft: 2, width: "100%", backgroundColor: isSelected ? Colors.SELECTED : '#1a1a1a', padding: 1 }}
            >
              <box style={{ flexDirection: "row", gap: 0, width: "100%" }}>
                <text
                  style={{ fg: '#8be9fd', attributes: TextAttributes.BOLD }}
                  wrapMode='word'
                >
                  {comment.author.displayName}
                </text>
                <text
                  style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }}
                  wrapMode='word'
                >
                  {` ${formatCompactTime(new Date(comment.created))} (${new Date(comment.created).toLocaleDateString()} ${new Date(comment.created).toLocaleTimeString()}):`}
                </text>
              </box>
              <box style={{ marginLeft: 4 }}>
                <text
                  style={{ fg: '#f1fa8c' }}
                  wrapMode='word'
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
            wrapMode='word'
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