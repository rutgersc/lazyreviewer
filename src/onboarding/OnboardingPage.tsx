import { useState } from 'react'
import type { ParsedKey } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'
import { useAtomSet } from '@effect-atom/atom-react'
import { Colors } from '../colors'
import type { OnboardingStep, DiscoveredRepo } from './onboarding-types'
import type { UserId, UserSelectionEntry } from '../userselection/userSelection'
import { repoSelectionAtom, selectedUserSelectionEntryIdAtom, setCurrentUserAtom } from '../settings/settings-atom'
import { userSelectionsAtom } from '../userselection/userselection-atom'
import RepoSelectionStep from './RepoSelectionStep'
import UserDiscoveryStep from './UserDiscoveryStep'
import IdentityStep from './IdentityStep'

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('repos')
  const [selectedRepos, setSelectedReposLocal] = useState<DiscoveredRepo[]>([])
  const [discoveredUsers, setDiscoveredUsers] = useState<UserId[]>([])
  const [selections, setSelections] = useState<UserSelectionEntry[]>([])
  const [selectedSelectionId, setSelectedSelectionId] = useState<string>('')
  const [completed, setCompleted] = useState(false)

  const setRepoSelection = useAtomSet(repoSelectionAtom)
  const setCurrentUser = useAtomSet(setCurrentUserAtom)
  const setSelectedUserSelectionEntryId = useAtomSet(selectedUserSelectionEntryIdAtom)
  const setUserSelections = useAtomSet(userSelectionsAtom)
  const renderer = useRenderer()

  useKeyboard((key: ParsedKey) => {
    if (key.name === 'z') renderer.console.toggle()
  })

  const handleReposDone = (repos: DiscoveredRepo[]) => {
    setSelectedReposLocal(repos)
    setStep('users')
  }

  const handleUsersDone = (sels: UserSelectionEntry[], users: UserId[], selId: string) => {
    setSelections(sels)
    setDiscoveredUsers(users)
    setSelectedSelectionId(selId)
    setStep('identity')
  }

  const handleIdentityDone = (userId: UserId) => {
    try {
      const repoPaths = selectedRepos.map(r => r.fullPath)
      setRepoSelection(repoPaths)
      setCurrentUser(userId.userId)
      setUserSelections(selections)
      setSelectedUserSelectionEntryId(selectedSelectionId)
      setCompleted(true)
    } catch (e) {
      console.error(`[onboarding] error completing:`, e)
    }
  }

  if (completed) return null

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: Colors.BACKGROUND,
        flexDirection: 'column',
        zIndex: 1500,
      }}
    >
      {step === 'repos' && (
        <RepoSelectionStep
          onNext={handleReposDone}
          onBack={() => {}}
        />
      )}

      {step === 'users' && (
        <UserDiscoveryStep
          repos={selectedRepos}
          onNext={handleUsersDone}
          onBack={() => setStep('repos')}
        />
      )}

      {step === 'identity' && (
        <IdentityStep
          discoveredUsers={discoveredUsers}
          onNext={handleIdentityDone}
          onBack={() => setStep('users')}
        />
      )}
    </box>
  )
}
