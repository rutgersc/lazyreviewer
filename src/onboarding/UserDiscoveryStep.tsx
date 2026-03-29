import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState, useEffect } from 'react'
import { Effect } from 'effect'
import { Colors } from '../colors'
import { runWithAppServices } from '../appLayerRuntime'
import type { DiscoveredRepo, DiscoveredUser } from './onboarding-types'
import type { RepoFetchStatus } from './onboarding-effects'
import type { UserSelectionEntry, UserId } from '../userselection/userSelection'
import { fetchMrsForRepos, mergeWithPredefinedUsers } from './onboarding-effects'
import { settingsUsersToUserSelections } from '../userselection/userSelection'
import { DEFAULT_USERS } from '../data/default-users-and-groups'

interface UserDiscoveryStepProps {
  repos: readonly DiscoveredRepo[]
  onNext: (selections: UserSelectionEntry[], discoveredUsers: UserId[], selectedSelectionId: string) => void
  onBack: () => void
}

export default function UserDiscoveryStep({ repos, onNext, onBack }: UserDiscoveryStepProps) {
  const [mergedUsers, setMergedUsers] = useState<UserId[]>([])
  const [loading, setLoading] = useState(true)
  const [repoStatuses, setRepoStatuses] = useState<ReadonlyMap<string, RepoFetchStatus>>(
    () => new Map(repos.map(r => [r.fullPath, 'pending' as const]))
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const discovered: DiscoveredUser[] = await runWithAppServices(
          fetchMrsForRepos(repos, (repoPath, status) => {
            if (!cancelled) setRepoStatuses(prev => new Map([...prev, [repoPath, status]]))
          })
        )

        if (cancelled) return

        const predefinedIds = settingsUsersToUserSelections(DEFAULT_USERS)
          .filter((u): u is { type: 'user'; id: UserId } => u.type === 'user')
          .map(u => u.id)
        const merged = mergeWithPredefinedUsers(discovered, predefinedIds)
        setMergedUsers([...merged])
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [repos])

  const handleProceed = () => {
    onNext([], mergedUsers, '')
  }

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'space':
      case 'return':
        if (!loading) handleProceed()
        break
      case 'escape':
        onBack()
        break
    }
  })

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Step 3/4: Discovering users from merge requests
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          Enter: next | Esc: back
        </text>
      </box>
      <text style={{ fg: Colors.NEUTRAL, paddingLeft: 1 }} wrapMode='none'>
        {'─'.repeat(100)}
      </text>

      {loading && (
        <box style={{ flexDirection: 'column', paddingLeft: 2, paddingTop: 1 }}>
          <text style={{ fg: Colors.INFO, attributes: TextAttributes.BOLD }} wrapMode='none'>
            Fetching merge requests...
          </text>
          {[...repoStatuses.entries()].map(([repoPath, status]) => {
            const label = status === 'done' ? '✓ done' : status === 'error' ? '✗ error' : status === 'fetching' ? '⟳ fetching' : '· pending'
            const color = status === 'done' ? Colors.SUCCESS : status === 'error' ? Colors.ERROR : status === 'fetching' ? Colors.WARNING : Colors.SUPPORTING
            return (
              <text key={repoPath} style={{ fg: color, paddingLeft: 1 }} wrapMode='none'>
                {label}  {repoPath}
              </text>
            )
          })}
        </box>
      )}

      {error && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.ERROR }} wrapMode='none'>
            Error: {error}
          </text>
        </box>
      )}

      {!loading && !error && (
        <scrollbox
          style={{
            flexGrow: 1,
            contentOptions: { backgroundColor: Colors.BACKGROUND },
            scrollbarOptions: {
              trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
            },
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            <box style={{ paddingLeft: 1 }}>
              <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD }} wrapMode='none'>
                Discovered Users ({mergedUsers.length})
              </text>
            </box>
            {mergedUsers.map(user => (
              <box key={user.userId} style={{ paddingLeft: 2, flexDirection: 'row', gap: 1 }}>
                <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
                  {user.userId}
                </text>
                {user.gitlab && (
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    gitlab: {user.gitlab}
                  </text>
                )}
                {user.bitbucket && (
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    bb: {user.bitbucket}
                  </text>
                )}
              </box>
            ))}
            {mergedUsers.length === 0 && (
              <box style={{ paddingLeft: 2 }}>
                <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                  No users discovered (no open MRs?)
                </text>
              </box>
            )}
          </box>
        </scrollbox>
      )}

      {!loading && !error && (
        <box
          onMouseDown={handleProceed}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            zIndex: 10,
            backgroundColor: Colors.BACKGROUND,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingRight: 1,
          }}
        >
          <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
            [ Continue → ]
          </text>
        </box>
      )}
    </box>
  )
}
