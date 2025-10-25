import React from 'react';
import { TextAttributes } from '@opentui/core';
import type { JiraIssue } from '../schemas/mergeRequestSchema';

interface JiraModalProps {
  isVisible: boolean;
  jiraIssues: JiraIssue[];
  onClose: () => void;
}

export default function JiraModal({ isVisible, jiraIssues, onClose }: JiraModalProps) {
  if (!isVisible) return null;

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}
    >
      <box
        style={{
          width: '80%',
          height: '80%',
          border: true,
          borderColor: '#6272a4',
          backgroundColor: '#282a36',
          flexDirection: 'column'
        }}
      >
      {/* Header */}
      <box style={{ padding: 1, border: true, borderColor: '#6272a4', backgroundColor: '#44475a' }}>
        <text style={{ fg: '#f8f8f2', attributes: TextAttributes.BOLD }} wrapMode='none'>
          {`🎫 Jira Issues (${jiraIssues.length})`}
        </text>
      </box>

      {/* Content */}
      <box style={{ flexDirection: 'column', padding: 1, flexGrow: 1 }}>
        {jiraIssues.length === 0 ? (
          <text style={{ fg: '#6272a4', attributes: TextAttributes.DIM }} wrapMode='none'>
            No Jira issues found for this merge request.
          </text>
        ) : (
          <box style={{ flexDirection: 'column', gap: 1 }}>
            {jiraIssues.map((issue, index) => (
              <box key={issue.key} style={{ flexDirection: 'column', gap: 0 }}>
                {/* Issue key and summary */}
                <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                  <text style={{ fg: '#50fa7b', attributes: TextAttributes.BOLD }} wrapMode='none'>
                    {issue.key}
                  </text>
                  <text style={{ fg: '#f8f8f2' }} wrapMode='none'>
                    {issue.fields.summary}
                  </text>
                </box>

                {/* Issue type and status */}
                <box style={{ flexDirection: 'row', gap: 2, marginLeft: 2 }}>
                  <text style={{ fg: '#bd93f9', attributes: TextAttributes.DIM }} wrapMode='none'>
                    {`Type: ${issue.fields.issuetype.name}`}
                  </text>
                  <text style={{ fg: '#ffb86c', attributes: TextAttributes.DIM }} wrapMode='none'>
                    {`Status: ${issue.fields.status.name}`}
                  </text>
                </box>

                {/* URL */}
                <box style={{ marginLeft: 2 }}>
                  <text style={{ fg: '#8be9fd', attributes: TextAttributes.DIM }} wrapMode='none'>
                    {`URL: https://scisure.atlassian.net/browse/${issue.key}`}
                  </text>
                </box>

                {/* Separator line */}
                {index < jiraIssues.length - 1 && (
                  <box style={{ marginTop: 1, marginBottom: 1 }}>
                    <text style={{ fg: '#44475a' }} wrapMode='none'>
                      {'─'.repeat(50)}
                    </text>
                  </box>
                )}
              </box>
            ))}
          </box>
        )}
      </box>

      {/* Footer */}
      <box style={{ padding: 1, border: true, borderColor: '#6272a4', backgroundColor: '#44475a' }}>
        <text style={{ fg: '#6272a4', attributes: TextAttributes.DIM }} wrapMode='none'>
          Press ESC to close
        </text>
      </box>
      </box>
    </box>
  );
}