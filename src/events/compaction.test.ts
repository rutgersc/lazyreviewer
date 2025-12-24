import { describe, test, expect } from "bun:test"
import { Effect } from "effect"
import { appLayer } from "../appLayerRuntime"
import { EventStorage } from "./events"
import { AllMrsState, allMrsProjection } from "../mergerequests/all-mergerequests-projection"
import { projectEventsToCompactedState, compactedStateToEvent } from "./project-to-compacted-state"

describe("Event Compaction", () => {
  test("allMrsProjection produces identical state from all events vs single compacted event", async () => {
    const program = Effect.gen(function* () {
      // 1. Load all events using EventStorage
      const allEvents = yield* EventStorage.loadAllEvents
      console.log(`Loaded ${allEvents.length} events from storage`)

      // 2. Project all events through allMrsProjection to get final state
      const mrRelevantEvents = allEvents.filter(allMrsProjection.isRelevantEvent)
      console.log(`Found ${mrRelevantEvents.length} MR-relevant events`)

      const stateFromAllEvents = mrRelevantEvents.reduce(
        (state, event) => allMrsProjection.project(state, event),
        allMrsProjection.initialState
      )

      console.log(`State from all events: ${stateFromAllEvents.mrsByGid.size} MRs, ${stateFromAllEvents.jiraIssuesByKey.size} Jira issues`)

      // 3. Create a compacted event from all events
      const compactedState = projectEventsToCompactedState(allEvents)
      const compactedEvent = compactedStateToEvent(compactedState)

      console.log(`Compacted event contains: ${compactedEvent.mrs.length} MRs, ${compactedEvent.jiraIssues.length} Jira issues`)

      // 4. Project the single compacted event through allMrsProjection
      const stateFromCompactedEvent = allMrsProjection.project(
        allMrsProjection.initialState,
        compactedEvent
      )

      console.log(`State from compacted event: ${stateFromCompactedEvent.mrsByGid.size} MRs, ${stateFromCompactedEvent.jiraIssuesByKey.size} Jira issues`)

      return {
        stateFromAllEvents,
        stateFromCompactedEvent
      }
    })

    const { stateFromAllEvents, stateFromCompactedEvent } = await Effect.runPromise(
      program.pipe(Effect.provide(appLayer))
    )

    // 5. Compare the two states
    // Compare MR counts
    expect(stateFromCompactedEvent.mrsByGid.size).toBe(stateFromAllEvents.mrsByGid.size)

    // Compare Jira issue counts
    expect(stateFromCompactedEvent.jiraIssuesByKey.size).toBe(stateFromAllEvents.jiraIssuesByKey.size)

    // Compare each MR by ID
    const allEventsMrIds = new Set(stateFromAllEvents.mrsByGid.keys())
    const compactedEventMrIds = new Set(stateFromCompactedEvent.mrsByGid.keys())

    // Check that all MR IDs are the same
    expect(compactedEventMrIds.size).toBe(allEventsMrIds.size)
    for (const mrId of allEventsMrIds) {
      expect(compactedEventMrIds.has(mrId)).toBe(true)
    }

    // Compare each MR's core fields
    for (const [mrId, expectedMr] of stateFromAllEvents.mrsByGid) {
      const actualMr = stateFromCompactedEvent.mrsByGid.get(mrId)
      expect(actualMr).toBeDefined()

      if (actualMr) {
        expect(actualMr.id).toBe(expectedMr.id)
        expect(actualMr.iid).toBe(expectedMr.iid)
        expect(actualMr.title).toBe(expectedMr.title)
        expect(actualMr.state).toBe(expectedMr.state)
        expect(actualMr.author).toBe(expectedMr.author)
        expect(actualMr.webUrl).toBe(expectedMr.webUrl)
        expect(actualMr.sourcebranch).toBe(expectedMr.sourcebranch)
        expect(actualMr.targetbranch).toBe(expectedMr.targetbranch)
        expect(actualMr.project.fullPath).toBe(expectedMr.project.fullPath)
      }
    }

    // Compare Jira issues
    const allEventsJiraKeys = new Set(stateFromAllEvents.jiraIssuesByKey.keys())
    const compactedEventJiraKeys = new Set(stateFromCompactedEvent.jiraIssuesByKey.keys())

    expect(compactedEventJiraKeys.size).toBe(allEventsJiraKeys.size)
    for (const jiraKey of allEventsJiraKeys) {
      expect(compactedEventJiraKeys.has(jiraKey)).toBe(true)

      const expectedIssue = stateFromAllEvents.jiraIssuesByKey.get(jiraKey)
      const actualIssue = stateFromCompactedEvent.jiraIssuesByKey.get(jiraKey)

      expect(actualIssue).toBeDefined()
      if (expectedIssue && actualIssue) {
        expect(actualIssue.key).toBe(expectedIssue.key)
        expect(actualIssue.fields.summary).toBe(expectedIssue.fields.summary)
        expect(actualIssue.fields.status.name).toBe(expectedIssue.fields.status.name)
      }
    }

    console.log("✓ All MRs and Jira issues match between all events and compacted event projections")
  })
})
