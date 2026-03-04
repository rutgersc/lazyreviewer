import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState, useEffect } from 'react'
import { Effect, Runtime } from 'effect'
import { Colors } from '../colors'
import { getAppRuntime } from '../appLayerRuntime'
import type { DiscoveredRepo, DiscoveredUser } from './onboarding-types'
import type { UserSelectionEntry, UserId } from '../userselection/userSelection'
import { PREMADE_SELECTIONS, getSelectionMembers } from './onboarding-defaults'
import { fetchMrsForRepos, mergeWithPredefinedUsers } from './onboarding-effects'
import { users as predefinedUserSelections } from '../data/usersAndGroups'

interface UserDiscoveryStepProps {
  repos: readonly DiscoveredRepo[]
  onNext: (selections: UserSelectionEntry[], discoveredUsers: UserId[], selectedSelectionId: string) => void
  onBack: () => void
}

export default function UserDiscoveryStep({ repos, onNext, onBack }: UserDiscoveryStepProps) {
  const [mergedUsers, setMergedUsers] = useState<UserId[]>([])
  const [selections] = useState<UserSelectionEntry[]>(PREMADE_SELECTIONS)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setProgress(`Fetching MRs... 0/${repos.length} repos`)
        const runtime = await getAppRuntime()
        const discovered: DiscoveredUser[] = await Runtime.runPromise(runtime)(
          fetchMrsForRepos(repos, (done, total, repoPath) => {
            setProgress(`Fetching MRs... ${done}/${total} repos (${repoPath})`)
          })
        )

        if (cancelled) return

        setProgress('')

        const predefinedIds = predefinedUserSelections
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
    const sel = selections[highlightIndex]
    if (sel) {
      onNext(selections, mergedUsers, sel.userSelectionEntryId)
    }
  }

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'j':
      case 'down':
        setHighlightIndex(i => Math.min(selections.length - 1, i + 1))
        break
      case 'k':
      case 'up':
        setHighlightIndex(i => Math.max(0, i - 1))
        break
      case 'space':
      case 'return':
        handleProceed()
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
          Step 2/3: Choose your team — their merge requests will be shown by default
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          j/k: nav | Enter/space: select | Esc: back
        </text>
      </box>
      <text style={{ fg: Colors.NEUTRAL, paddingLeft: 1 }} wrapMode='none'>
        {'─'.repeat(100)}
      </text>

      {loading && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            {progress || 'Discovering users from merge requests...'}
          </text>
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
        <box style={{ flexDirection: 'row', flexGrow: 1 }}>
          {/* Left: premade selections */}
          <box style={{ flexDirection: 'column', width: '50%', border: true, borderColor: Colors.TRACK }}>
            <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD, paddingLeft: 1 }} wrapMode='none'>
              User Selections
            </text>
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
                {selections.map((sel, idx) => {
                  const isHighlighted = idx === highlightIndex
                  return (
                    <box
                      key={sel.userSelectionEntryId}
                      onMouseDown={() => { setHighlightIndex(idx) }}
                      style={{
                        flexDirection: 'row',
                        backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                        paddingLeft: 1,
                        gap: 1,
                      }}
                    >
                      <text style={{ fg: isHighlighted ? Colors.SUCCESS : Colors.PRIMARY }} wrapMode='none'>
                        {isHighlighted ? '> ' : '  '}{sel.name}
                      </text>
                      <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                        ({getSelectionMembers(sel)})
                      </text>
                    </box>
                  )
                })}
              </box>
            </scrollbox>
          </box>

          {/* Right: discovered users */}
          <box style={{ flexDirection: 'column', width: '50%' }}>
            <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD, paddingLeft: 1 }} wrapMode='none'>
              Discovered Users ({mergedUsers.length})
            </text>
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
                  <text style={{ fg: Colors.SUPPORTING, paddingLeft: 2 }} wrapMode='none'>
                    No users discovered (no open MRs?)
                  </text>
                )}
              </box>
            </scrollbox>
          </box>
        </box>
      )}

      <box style={{ paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          {selections[highlightIndex]
            ? `Selected: ${selections[highlightIndex].name}`
            : 'No selection'}
        </text>
      </box>
    </box>
  )
}
