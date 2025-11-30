import { Atom } from '@effect-atom/atom-react'
import { Effect, Stream } from 'effect'
import { appAtomRuntime } from '../appLayerRuntime'
import { EventStorage } from '../events/events'
import { initialChangeTrackingState } from './change-tracking-state'
import type { ChangeTrackingState } from './change-tracking-state'
import { projectChangeTracking } from './change-tracking-projection'
import { formatChange } from './change-formatters'
import type { ChangeEvent } from '../events/change-tracking-events'

interface ChangeTrackingAccumulator {
  state: ChangeTrackingState
  allChanges: ChangeEvent[]
}

export const changeTrackingAtom = appAtomRuntime.atom(
  (get) => {
    return Stream.unwrap(
      Effect.gen(function* () {
        const baseStream = yield* EventStorage.eventsStream

        return baseStream.pipe(
          Stream.scan(
            { state: initialChangeTrackingState, allChanges: [] as ChangeEvent[] },
            (acc: ChangeTrackingAccumulator, event) => {
              const result = projectChangeTracking(acc.state, event)

              if (result.changes.length > 0) {
                // Console log each change
                result.changes.forEach(change => {
                  console.log(formatChange(change, get))
                })
              }

              return {
                state: result.newState,
                allChanges: [...acc.allChanges, ...result.changes]
              }
            }
          )
        )
      })
    )
  },
  { initialValue: { state: initialChangeTrackingState, allChanges: [] as ChangeEvent[] } }
).pipe(Atom.keepAlive)
