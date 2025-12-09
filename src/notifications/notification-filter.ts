import type {
  Change,
  NewMrChange,
  MergedMrChange,
  ClosedMrChange,
  ReopenedMrChange,
  DiffCommentChange,
  DiscussionCommentChange
} from '../changetracking/change-tracking-projection'
import type { JiraCommentChange, JiraStatusChangedChange } from '../changetracking/jira-change-tracking'

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
  /** The current user's username (for filtering out own actions) */
  currentUser: string
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

  // Helper to check if author is current user
  const isOwnAction = (author: string) => author === currentUser
  const isMrAuthoredByMe = (mr: { mrAuthor: string }) => mr.mrAuthor === currentUser

  switch (change.type) {
    case 'new-mr':
    case 'merged-mr':
    case 'closed-mr':
    case 'reopened-mr': {
      return { notify: true, change }
    }

    // System notes - never notify
    case 'system-note': {
      return skipNotification
    }

    // Diff comments
    case 'diff-comment': {
      // Never notify for own comments
      if (isOwnAction(change.author)) return skipNotification

      // Check if it's on my MR
      if (preferences.commentsOnMyMrs && isMrAuthoredByMe(change.mr)) {
        return { notify: true, change }
      }

      // Check if it's in a thread I participate in
      if (preferences.threadReplies && participatedDiscussionIds.has(change.discussionId)) {
        return { notify: true, change }
      }

      return skipNotification
    }

    // Discussion comments
    case 'discussion-comment': {
      if (isOwnAction(change.author)) return skipNotification

      if (preferences.commentsOnMyMrs && isMrAuthoredByMe(change.mr)) {
        return { notify: true, change }
      }

      // Check if it's in a thread I participate in
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
      if (isOwnAction(change.author)) return skipNotification
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
