import { TextAttributes, type ParsedKey } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useState } from 'react'
import { Colors } from '../colors'
import type { UserId } from '../userselection/userSelection'
import { users as predefinedUserSelections } from '../data/usersAndGroups'

interface IdentityStepProps {
  discoveredUsers: readonly UserId[]
  onNext: (userId: UserId) => void
  onBack: () => void
}

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

export default function IdentityStep({ discoveredUsers, onNext, onBack }: IdentityStepProps) {
  const [inputValue, setInputValue] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [inputFocused, setInputFocused] = useState(true)

  const handleSelectFromList = (idx: number) => {
    const user = discoveredUsers[idx]
    if (user) onNext(user)
  }

  const handleSubmitInput = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const existing = discoveredUsers.find(u =>
      u.userId === trimmed || u.gitlab === trimmed || u.bitbucket === trimmed
    )
    onNext(existing ?? resolveUserId(trimmed))
  }

  useKeyboard((key: ParsedKey) => {
    if (key.name === 'escape') {
      onBack()
      return
    }

    if (key.name === 'tab') {
      setInputFocused(prev => !prev)
      return
    }

    if (!inputFocused) {
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
          handleSelectFromList(highlightIndex)
          break
      }
    }
  })

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Step 3/3: Who Are You?
        </text>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          Tab: switch focus | j/k: nav list | Enter: confirm | Esc: back
        </text>
      </box>
      <text style={{ fg: Colors.NEUTRAL, paddingLeft: 1 }} wrapMode='none'>
        {'─'.repeat(100)}
      </text>

      <box style={{ paddingLeft: 1, paddingRight: 1, paddingTop: 1, flexDirection: 'column', gap: 0 }}>
        <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
          Type your username or select from the list below:
        </text>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>{'>'}</text>
          <input
            focused={inputFocused}
            style={{
              width: 40,
              textColor: Colors.PRIMARY,
              backgroundColor: inputFocused ? Colors.SELECTED : Colors.BACKGROUND,
            }}
            placeholder="username"
            onSubmit={handleSubmitInput as any}
            onInput={setInputValue}
          />
        </box>
      </box>

      <box style={{ paddingLeft: 1, paddingTop: 1 }}>
        <text style={{ fg: Colors.WARNING, attributes: TextAttributes.BOLD }} wrapMode='none'>
          Known Users ({discoveredUsers.length})
        </text>
      </box>

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
            const isHighlighted = !inputFocused && idx === highlightIndex
            return (
              <box
                key={user.userId}
                onMouseDown={() => {
                  setInputFocused(false)
                  setHighlightIndex(idx)
                  handleSelectFromList(idx)
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
