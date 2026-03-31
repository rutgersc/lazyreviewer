import { TextAttributes } from '@opentui/core';
import JiraIssueInfo from './JiraIssueInfo';
import { Colors } from '../colors';
import type { JiraIssue } from '../jira/jira-schema';
import { openUrl } from '../system/open-url';
import { Atom } from "effect/unstable/reactivity"
import { useAtom, useAtomValue } from "@effect/atom-react";

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useDoubleClick } from '../hooks/useDoubleClick';
import { useEffect, useRef } from 'react';
import { useJiraScroll } from '../hooks/useJiraScroll';
import { selectedMergeRequestJiraIssuesAtom } from './InfoPane';

interface JiraIssuesListProps {
}

type JiraListItem = {
  issue: JiraIssue;
  isParent: boolean;
  parentIssueIndex: number;
  subIndex: number;
};

export const selectedJiraIndexAtom = Atom.make<number>(0);
export const selectedJiraSubIndexAtom = Atom.make<number>(0);
export const selectedJiraCommentIndexAtom = Atom.make<number>(0);
export const jiraCommentFocusedAtom = Atom.make<boolean>(false);

export const scrollToJiraCommentIdInJiraIssuesListAtom = Atom.make<string | null>(null);

export default function JiraIssuesList({ }: JiraIssuesListProps) {
  const [selectedJiraIndex, setSelectedJiraIndex] = useAtom(selectedJiraIndexAtom);
  const [selectedJiraSubIndex, setSelectedJiraSubIndex] = useAtom(selectedJiraSubIndexAtom);
  const [commentFocused, setCommentFocused] = useAtom(jiraCommentFocusedAtom);
  const [selectedCommentIndex, setSelectedCommentIndex] = useAtom(selectedJiraCommentIndexAtom);
  const jiraIssues = useAtomValue(selectedMergeRequestJiraIssuesAtom);
  const registeredRef = useRef(false);

  // TODOR: do these scrolls serve the same purpose? can this be simplified?
  const { scrollBoxRef, scrollToId } = useAutoScroll({ lookahead: 2, scrollerId: 'infoPane' });
  const { registerHandler } = useJiraScroll();

  const [scrollToItemRequest, setScrollToItemRequest] = useAtom(scrollToJiraCommentIdInJiraIssuesListAtom);

  useEffect(() => {
    if (scrollToItemRequest !== null) {
      scrollToId(scrollToItemRequest);
      setScrollToItemRequest(null);
    }
  }, [scrollToItemRequest, scrollToId, setScrollToItemRequest]);

  const handleJiraClick = useDoubleClick<JiraListItem>({
    onSingleClick: (item) => {
      setSelectedJiraIndex(item.parentIssueIndex);
      setSelectedJiraSubIndex(item.subIndex);
      scrollToId(`jira-item-${item.parentIssueIndex}-${item.subIndex}`);
    },
    onDoubleClick: (item) => {
       const jiraBaseUrl = item.issue.self.split('/rest/')[0];
       const jiraUrl = `${jiraBaseUrl}/browse/${item.issue.key}`;
       openUrl(jiraUrl);
    }
  });

  if (!registeredRef.current) {
    registeredRef.current = true;
    const handler = ({ issueKey, commentId }: { issueKey: string; commentId?: string }) => {
      if (jiraIssues.length === 0) return;
      const issueIndex = jiraIssues.findIndex(i => i.key === issueKey);
      if (issueIndex < 0) return;
      setSelectedJiraIndex(issueIndex);
      setSelectedJiraSubIndex(0);
      const issue = jiraIssues[issueIndex];
      if (!issue) return;
      scrollToId(`jira-item-${issueIndex}-0`);
      if (commentId) {
        const commentIndex = issue.fields.comment.comments.findIndex(c => c.id === commentId);
        if (commentIndex >= 0) {
          setCommentFocused(true);
          setSelectedCommentIndex(commentIndex);
          scrollToId(`jira-comment-${commentId}`);
        }
      }
    };
    registerHandler(handler);
  }

  const jiraListItems: JiraListItem[] = [];
  jiraIssues.forEach((issue, issueIndex) => {
    jiraListItems.push({
      issue,
      isParent: false,
      parentIssueIndex: issueIndex,
      subIndex: 0
    });

    if (issue.fields.parent) {
      const parentAsIssue: JiraIssue = {
        key: issue.fields.parent.key,
        id: '',
        self: '',
        fields: {
          summary: issue.fields.parent.fields.summary,
          parent: undefined,
          status: { name: 'To Do', statusCategory: { name: '' } },
          assignee: null,
          priority: { name: '' },
          issuetype: issue.fields.parent.fields.issuetype,
          created: '',
          updated: '',
          comment: { total: 0, comments: [] }
        }
      };

      jiraListItems.push({
        issue: parentAsIssue,
        isParent: true,
        parentIssueIndex: issueIndex,
        subIndex: 1
      });
    }
  });

  if (jiraIssues.length === 0) {
    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          No Jira tickets
        </text>
      </box>
    );
  }

  const selectedListItem = jiraListItems.find(
    item => item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex
  );

  return (
    <scrollbox
      ref={scrollBoxRef}
      style={{
        flexGrow: 1,
        width: "100%",
        contentOptions: { backgroundColor: Colors.BACKGROUND },
        scrollbarOptions: {
          trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
        },
      }}
    >
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box style={{ flexDirection: "column", gap: 0 }}>
        {jiraListItems.map((item) => {
          const isSelected = item.parentIssueIndex === selectedJiraIndex && item.subIndex === selectedJiraSubIndex;

          return (
            <box
              key={`${item.issue.key}-${item.isParent ? 'parent' : 'main'}`}
              id={`jira-item-${item.parentIssueIndex}-${item.subIndex}`}
              onMouseDown={() => handleJiraClick(item)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
                marginLeft: item.isParent ? 2 : 0
              }}
            >
              {item.isParent && (
                <text
                  style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                  wrapMode='none'
                >
                  ↳
                </text>
              )}
              <text
                style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }}
                wrapMode='none'
              >
                {item.issue.key}
              </text>
              <text
                style={{ fg: Colors.WARNING, attributes: TextAttributes.DIM }}
                wrapMode='none'
              >
                {item.issue.fields.status.name}
              </text>
              <text
                style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
                wrapMode='none'
              >
                {item.issue.fields.issuetype.name}
              </text>
              <text
                style={{ fg: Colors.PRIMARY }}
                wrapMode='none'
              >
                {item.issue.fields.summary}
              </text>
            </box>
          );
        })}
      </box>

      <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
        ─────────────────────────────────────
      </text>

      {selectedListItem && <JiraIssueInfo issue={selectedListItem.issue} selectedCommentIndex={selectedCommentIndex} commentFocused={commentFocused} />}
    </box>
    </scrollbox>
  );
}
