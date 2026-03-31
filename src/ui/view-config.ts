import type { Change } from '../changetracking/change-tracking-projection'
import { isMrChange } from '../changetracking/mr-change-tracking-projection'
import { TextAttributes } from '@opentui/core'
import type { AppView } from '../settings/settings-atom'
import { type UserId, type AuthorIdentity, isCurrentUser } from '../userselection/userSelection'
import { Colors } from '../colors'

export type FocusRelevance = 'primary' | 'dimmed' | 'hidden'

type ChangeStyle = {
  readonly fg: string
  readonly dateFg: string
  readonly attributes: number
  readonly bg: string
}

type EventHeaderStyle = {
  readonly fg: string
  readonly attributes: number
}

type ModeIndicatorStyle = {
  readonly label: string
  readonly labelColor: string
  readonly borderColor: string
  readonly hintColor: string
}

export type ViewConfig = {
  readonly modeIndicator: ModeIndicatorStyle
  readonly classify: (change: Change, currentUser: UserId, myJiraIssueKeys: Set<string>) => FocusRelevance
  readonly changeStyle: {
    readonly primary: ChangeStyle
    readonly dimmed: ChangeStyle
  }
  readonly eventHeader: {
    readonly primary: EventHeaderStyle
    readonly dimmed: EventHeaderStyle
  }
}

const reviewClassify = (): FocusRelevance => 'primary'

const focusClassify = (change: Change, currentUser: UserId, myJiraIssueKeys: Set<string>): FocusRelevance => {
  const isMyMr = (mr: { mrAuthor: AuthorIdentity }) =>
    isCurrentUser(currentUser, mr.mrAuthor)

  if (isMrChange(change)) {
    switch (change.type) {
      case 'new-mr':
      case 'merged-mr':
      case 'closed-mr':
      case 'reopened-mr':
        return isMyMr(change.mr) ? 'primary' : 'dimmed'

      case 'system-note':
        if (!isMyMr(change.mr)) return 'hidden'
        return !isCurrentUser(currentUser, change.author) ? 'primary' : 'hidden'

      case 'system-notes-compacted':
        if (!isMyMr(change.mr)) return 'hidden'
        return !isCurrentUser(currentUser, change.authors[0]!) ? 'primary' : 'hidden'

      case 'diff-comment':
        if (!isMyMr(change.mr)) return 'hidden'
        return !isCurrentUser(currentUser, change.author) ? 'primary' : 'hidden'

      case 'discussion-comment':
        if (!isMyMr(change.mr)) return 'hidden'
        return !isCurrentUser(currentUser, change.author) ? 'primary' : 'hidden'
    }
  }

  switch (change.type) {
    case 'new-jira-issue':
      return myJiraIssueKeys.has(change.issue.issueKey) ? 'primary' : 'hidden'

    case 'jira-status-changed':
      return myJiraIssueKeys.has(change.issue.issueKey) ? 'primary' : 'hidden'

    case 'jira-comment':
      if (!myJiraIssueKeys.has(change.issue.issueKey)) return 'hidden'
      return !isCurrentUser(currentUser, change.author) ? 'primary' : 'hidden'
  }
}

// Getters so Colors.X resolves at access time (supports theme switching)
export const viewConfigs: Record<AppView, ViewConfig> = {
  get review(): ViewConfig {
    return {
      modeIndicator: {
        label: 'review mode',
        labelColor: Colors.SECONDARY,
        borderColor: Colors.TRACK,
        hintColor: Colors.TRACK,
      },
      classify: reviewClassify,
      changeStyle: {
        primary: { fg: 'USE_CHANGE_COLOR', dateFg: 'USE_AGE_COLOR', attributes: 0, bg: Colors.BACKGROUND_ALT },
        dimmed:  { fg: 'USE_CHANGE_COLOR', dateFg: 'USE_AGE_COLOR', attributes: 0, bg: Colors.BACKGROUND_ALT },
      },
      eventHeader: {
        primary: { fg: Colors.PRIMARY, attributes: 0 },
        dimmed:  { fg: Colors.PRIMARY, attributes: 0 },
      },
    }
  },
  get focus(): ViewConfig {
    return {
      modeIndicator: {
        label: 'focus mode',
        labelColor: Colors.SECONDARY,
        borderColor: Colors.TRACK,
        hintColor: Colors.TRACK,
      },
      classify: focusClassify,
      changeStyle: {
        primary: { fg: 'USE_CHANGE_COLOR', dateFg: 'USE_AGE_COLOR', attributes: 0, bg: Colors.BACKGROUND_ALT },
        dimmed:  { fg: Colors.DIM,           dateFg: Colors.DIM,       attributes: TextAttributes.DIM, bg: Colors.BACKGROUND_ALT },
      },
      eventHeader: {
        primary: { fg: Colors.PRIMARY, attributes: 0 },
        dimmed:  { fg: Colors.DIM, attributes: TextAttributes.DIM },
      },
    }
  },
}
