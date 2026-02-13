import type {
  Change,
  NewMrChange,
  MergedMrChange,
  ClosedMrChange,
  ReopenedMrChange,
  DiffCommentChange,
  DiscussionCommentChange
} from '../changetracking/change-tracking-projection'
import type { JiraCommentChange, JiraStatusChangedChange } from '../changetracking/jira-change-tracking-projection'
import { type UserId, type AuthorIdentity, isCurrentUser } from '../userselection/userSelection'

export type NotifiableChange = Extract<
  Change,
  | NewMrChange
  | MergedMrChange
  | ClosedMrChange
  | ReopenedMrChange
  | DiffCommentChange
  | DiscussionCommentChange
  | JiraCommentChange
  | JiraStatusChangedChange
>;

/**
 * Reasons why a change should trigger a notification.
 * This helps with debugging and potential future UI display.
 */
export type NotificationReason =
  | 'new-mr'
  | 'mr-state-change'
  | 'comment-on-my-mr'
  | 'reply-in-my-thread'
  | 'jira-comment-on-related-ticket'

/**
 * Configurable notification preferences.
 * Each category can be toggled on/off.
 */
export interface NotificationPreferences {
  /** Notify on comments (diff + discussion) on MRs I authored */
  commentsOnMyMrs: boolean
  /** Notify on replies in threads I started or participated in */
  threadReplies: boolean
  /** Notify on comments on JIRA tickets related to relevant MRs */
  jiraComments: boolean
}

export const defaultNotificationPreferences: NotificationPreferences = {
  commentsOnMyMrs: true,
  threadReplies: true,
  jiraComments: true
}

/**
 * Context needed to determine if a change should trigger a notification.
 * All the "who am I" and "what do I participate in" data.
 */
export interface NotificationContext {
  /** The current user identity (for filtering out own actions) */
  currentUser: UserId
  /** Set of discussion IDs where the current user has commented */
  participatedDiscussionIds: Set<string>
  /** Set of JIRA issue keys that are related to MRs the user cares about */
  relatedJiraIssueKeys: Set<string>
  /** User's notification preferences */
  preferences: NotificationPreferences
}

export type NotificationFilterResult =
  | { notify: true; change: NotifiableChange }
  | { notify: false }

const skipNotification: NotificationFilterResult = { notify: false }

export function determineNotification(
  change: Change,
  context: NotificationContext
): NotificationFilterResult {
  const { currentUser, participatedDiscussionIds, relatedJiraIssueKeys, preferences } = context

  const isOwnAction = (author: AuthorIdentity) => isCurrentUser(currentUser, author)
  const isMrAuthoredByMe = (mr: { mrAuthor: AuthorIdentity }) => isCurrentUser(currentUser, mr.mrAuthor)

  switch (change.type) {
    case 'new-mr':
    case 'merged-mr':
    case 'closed-mr':
    case 'reopened-mr': {
      return { notify: true, change }
    }

    // System notes - never notify
    case 'system-note':
    case 'system-notes-compacted': {
      return skipNotification
    }

    case 'diff-comment': {
      if (isOwnAction(change.author)) return skipNotification

      if (preferences.commentsOnMyMrs && isMrAuthoredByMe(change.mr)) {
        return { notify: true, change }
      }

      if (preferences.threadReplies && participatedDiscussionIds.has(change.discussionId)) {
        return { notify: true, change }
      }

      return skipNotification
    }

    case 'discussion-comment': {
      if (isOwnAction(change.author)) return skipNotification

      if (preferences.commentsOnMyMrs && isMrAuthoredByMe(change.mr)) {
        return { notify: true, change }
      }

      if (preferences.threadReplies && participatedDiscussionIds.has(change.discussionId)) {
        return { notify: true, change }
      }

      return skipNotification
    }

    // JIRA events
    case 'new-jira-issue':
      return skipNotification;

    case 'jira-status-changed': {
      return { notify: true, change }
    }

    case 'jira-comment': {
      if (!preferences.jiraComments) return skipNotification
      if (isCurrentUser(currentUser, change.author)) return skipNotification
      if (relatedJiraIssueKeys.has(change.issue.issueKey)) {
        return { notify: true, change }
      }
      return skipNotification
    }

    default: {
      // Exhaustive check
      const _exhaustive: never = change
      return skipNotification
    }
  }
}
