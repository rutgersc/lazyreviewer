import type { Change } from '../changetracking/change-tracking-projection'
import { isMrChange } from '../changetracking/mr-change-tracking-projection'
import { TextAttributes } from '@opentui/core'
import type { AppView } from '../settings/settings-atom'
import { type UserId, type Provider, isAuthorOf, isJiraAuthor } from '../userselection/userSelection'

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
  const isMeAuthor = (provider: Provider, author: string) =>
    isAuthorOf(currentUser, provider, author)
  const isMeMrAuthor = (mr: { mrAuthor: string; provider: Provider }) =>
    isAuthorOf(currentUser, mr.provider, mr.mrAuthor)

  if (isMrChange(change)) {
    switch (change.type) {
      case 'new-mr':
      case 'merged-mr':
      case 'closed-mr':
      case 'reopened-mr':
        return isMeMrAuthor(change.mr) ? 'primary' : 'dimmed'

      case 'system-note':
        if (!isMeMrAuthor(change.mr)) return 'hidden'
        return !isMeAuthor(change.mr.provider, change.author) ? 'primary' : 'hidden'

      case 'system-notes-compacted':
        if (!isMeMrAuthor(change.mr)) return 'hidden'
        return !isMeAuthor(change.mr.provider, change.authors[0]!) ? 'primary' : 'hidden'

      case 'diff-comment':
        if (!isMeMrAuthor(change.mr)) return 'hidden'
        return !isMeAuthor(change.mr.provider, change.author) ? 'primary' : 'hidden'

      case 'discussion-comment':
        if (!isMeMrAuthor(change.mr)) return 'hidden'
        return !isMeAuthor(change.mr.provider, change.author) ? 'primary' : 'hidden'
    }
  }

  // Jira changes
  switch (change.type) {
    case 'new-jira-issue':
      return myJiraIssueKeys.has(change.issue.issueKey) ? 'primary' : 'hidden'

    case 'jira-status-changed':
      return myJiraIssueKeys.has(change.issue.issueKey) ? 'primary' : 'hidden'

    case 'jira-comment':
      if (!myJiraIssueKeys.has(change.issue.issueKey)) return 'hidden'
      return !isJiraAuthor(currentUser, change.author) ? 'primary' : 'hidden'
  }
}

export const viewConfigs: Record<AppView, ViewConfig> = {
  review: {
    modeIndicator: {
      label: 'review mode',
      labelColor: '#6272a4',
      borderColor: '#44475a',
      hintColor: '#44475a',
    },
    classify: reviewClassify,
    changeStyle: {
      primary: { fg: 'USE_CHANGE_COLOR', dateFg: 'USE_AGE_COLOR', attributes: 0, bg: '#1e1f29' },
      dimmed:  { fg: 'USE_CHANGE_COLOR', dateFg: 'USE_AGE_COLOR', attributes: 0, bg: '#1e1f29' },
    },
    eventHeader: {
      primary: { fg: '#f8f8f2', attributes: 0 },
      dimmed:  { fg: '#f8f8f2', attributes: 0 },
    },
  },
  focus: {
    modeIndicator: {
      label: 'focus mode',
      labelColor: '#f1fa8c',
      borderColor: '#44475a',
      hintColor: '#44475a',
    },
    classify: focusClassify,
    changeStyle: {
      primary: { fg: 'USE_CHANGE_COLOR', dateFg: 'USE_AGE_COLOR', attributes: 0, bg: '#1e1f29' },
      dimmed:  { fg: '#6272a4',           dateFg: '#6272a4',       attributes: TextAttributes.DIM, bg: '#1e1f29' },
    },
    eventHeader: {
      primary: { fg: '#f8f8f2', attributes: 0 },
      dimmed:  { fg: '#6272a4', attributes: TextAttributes.DIM },
    },
  },
}
