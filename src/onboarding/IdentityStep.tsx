import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState } from 'react'
import { Colors } from '../colors'
import type { UserId } from '../userselection/userSelection'
import { settingsUsersToUserSelections } from '../userselection/userSelection'
import { DEFAULT_USERS } from '../data/default-users-and-groups'

interface IdentityStepProps {
  discoveredUsers: readonly UserId[]
  onNext: (userId: UserId) => void
  onBack: () => void
}

const predefinedUserSelections = settingsUsersToUserSelections(DEFAULT_USERS)

const resolveUserId = (username: string): UserId => {
  const predefined = predefinedUserSelections
    .filter((u): u is { type: 'user'; id: UserId } => u.type === 'user')
    .find(u =>
      u.id.userId === username ||
      u.id.gitlab === username ||
      u.id.bitbucket === username
    )
  return predefined?.id ?? { type: 'userId', userId: username }
}

type FocusedField = 'list' | 'gitlab' | 'bitbucket'

export default function IdentityStep({ discoveredUsers, onNext, onBack }: IdentityStepProps) {
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [focusedField, setFocusedField] = useState<FocusedField>(discoveredUsers.length === 0 ? 'gitlab' : 'list')
  const [gitlabInput, setGitlabInput] = useState('')
  const [bitbucketInput, setBitbucketInput] = useState('')

  const submitManual = () => {
    const gl = gitlabInput.trim()
    const bb = bitbucketInput.trim()
    if (!gl && !bb) return

    const existing = discoveredUsers.find(u =>
      (gl && (u.gitlab === gl || u.userId === gl)) ||
      (bb && (u.bitbucket === bb || u.userId === bb))
    )
    if (existing) {
      onNext({
        ...existing,
        ...(gl && { gitlab: gl }),
        ...(bb && { bitbucket: bb }),
      })
      return
    }

    const predefined = resolveUserId(gl || bb)
    onNext({
      ...predefined,
      userId: gl || bb,
      ...(gl && { gitlab: gl }),
      ...(bb && { bitbucket: bb }),
    })
  }

  const handleGitlabSubmit = (value: string) => {
    setGitlabInput(value)
    setFocusedField('bitbucket')
  }

  const handleBitbucketSubmit = (value: string) => {
    setBitbucketInput(value)
    const gl = gitlabInput.trim()
    const bb = value.trim()
    if (gl || bb) submitManual()
  }

  const cycleFocus = () => {
    if (discoveredUsers.length === 0) {
      setFocusedField(prev => prev === 'gitlab' ? 'bitbucket' : 'gitlab')
    } else {
      setFocusedField(prev =>
        prev === 'list' ? 'gitlab' : prev === 'gitlab' ? 'bitbucket' : 'list'
      )
    }
  }

  useKeyboard((key: ParsedKey) => {
    if (key.name === 'escape') {
      onBack()
      return
    }

    if (key.name === 'tab') {
      cycleFocus()
      return
    }

    if (focusedField === 'list') {
      switch (key.name) {
        case 'j':
        case 'down':
          setHighlightIndex(i => Math.min(discoveredUsers.length - 1, i + 1))
          break
        case 'k':
        case 'up':
          setHighlightIndex(i => Math.max(0, i - 1))
          break
        case 'return':
        case 'space': {
          const user = discoveredUsers[highlightIndex]
          if (user) onNext(user)
          break
        }
      }
    }
  })

  const inputOnList = focusedField === 'list'

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Step 4/4: Who Are You?
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          Tab: switch fields | Enter: confirm | Esc: back
        </text>
      </box>
      <text style={{ fg: Colors.NEUTRAL, paddingLeft: 1 }} wrapMode='none'>
        {'─'.repeat(100)}
      </text>

      <box style={{ paddingLeft: 1, paddingRight: 1, paddingTop: 1, flexDirection: 'column' }}>
        <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
          Enter your username for each provider:
        </text>
        <box style={{ flexDirection: 'row', gap: 1, paddingTop: 1 }}>
          <text style={{ fg: focusedField === 'gitlab' ? Colors.INFO : Colors.SUPPORTING }} wrapMode='none'>
            GitLab:
          </text>
          <input
            focused={focusedField === 'gitlab'}
            style={{
              width: 30,
              textColor: Colors.PRIMARY,
              backgroundColor: focusedField === 'gitlab' ? Colors.SELECTED : Colors.BACKGROUND,
            }}
            placeholder="gitlab username"
            onSubmit={handleGitlabSubmit as any}
          />
        </box>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: focusedField === 'bitbucket' ? Colors.INFO : Colors.SUPPORTING }} wrapMode='none'>
            Bitbucket:
          </text>
          <input
            focused={focusedField === 'bitbucket'}
            style={{
              width: 30,
              textColor: Colors.PRIMARY,
              backgroundColor: focusedField === 'bitbucket' ? Colors.SELECTED : Colors.BACKGROUND,
            }}
            placeholder="bitbucket username"
            onSubmit={handleBitbucketSubmit as any}
          />
        </box>
      </box>

      {discoveredUsers.length > 0 && (
        <box style={{ paddingLeft: 1, paddingTop: 1 }}>
          <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD }} wrapMode='none'>
            {inputOnList ? 'Discovered users' : 'Or select from discovered users (Tab)'}  ({discoveredUsers.length})
          </text>
        </box>
      )}

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
          {discoveredUsers.map((user, idx) => {
            const isHighlighted = inputOnList && idx === highlightIndex
            return (
              <box
                key={user.userId}
                onMouseDown={() => {
                  setFocusedField('list')
                  if (idx === highlightIndex) {
                    onNext(user)
                  } else {
                    setHighlightIndex(idx)
                  }
                }}
                style={{
                  flexDirection: 'row',
                  backgroundColor: isHighlighted ? Colors.SELECTED : 'transparent',
                  paddingLeft: 2,
                  gap: 1,
                }}
              >
                <text style={{ fg: isHighlighted ? Colors.SUCCESS : Colors.PRIMARY }} wrapMode='none'>
                  {isHighlighted ? '> ' : '  '}{user.userId}
                </text>
                {user.gitlab && (
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    (gitlab: {user.gitlab})
                  </text>
                )}
                {user.bitbucket && (
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    (bb: {user.bitbucket})
                  </text>
                )}
              </box>
            )
          })}
        </box>
      </scrollbox>

    </box>
  )
}
