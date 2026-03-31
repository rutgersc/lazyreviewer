import { readdirSync, readFileSync, writeFileSync, renameSync } from "fs"
import { join } from "path"
import { generateEventId } from "../src/events/event-id"

const EVENTS_DIR = "storage/events"

const parseOldFilename = (filename: string) => {
  // Old format: {number}_{timestamp}_{event-type}.json
  const match = filename.match(/^(\d+)_(.+?)_(.+)\.json$/)
  if (!match) return null
  return { number: match[1], rest: `${match[2]}_${match[3]}` }
}

const parseNewFilename = (filename: string) => {
  // New format: {number}_{eventId}.json where eventId = timestamp_type_random
  const match = filename.match(/^(\d+)_(.+)\.json$/)
  if (!match || !match[1] || !match[2]) return null
  const eventId = match[2]
  // Check if eventId ends with random chars (8 hex chars)
  const hasRandomSuffix = /_[a-f0-9]{8}$/.test(eventId)
  return hasRandomSuffix ? { number: match[1], eventId } : null
}

const migrateEvents = () => {
  const files = readdirSync(EVENTS_DIR)
  let migratedCount = 0
  let renamedCount = 0
  let skippedCount = 0

  for (const filename of files) {
    if (!filename.endsWith(".json")) continue

    const filePath = join(EVENTS_DIR, filename)
    const content = readFileSync(filePath, "utf-8")
    const event = JSON.parse(content)

    let eventId = event.eventId
    let needsUpdate = false

    // Add eventId if missing
    if (!eventId) {
      eventId = generateEventId(event.timestamp, event.type)
      event.eventId = eventId
      needsUpdate = true
      console.log(`Added eventId: ${eventId}`)
    }

    // Check if filename needs to be renamed
    const newFilename = `${parseOldFilename(filename)?.number ?? parseNewFilename(filename)?.number}_${eventId}.json`
    const needsRename = filename !== newFilename

    if (needsUpdate) {
      writeFileSync(filePath, JSON.stringify(event, null, 2))
      migratedCount++
    }

    if (needsRename) {
      const newFilePath = join(EVENTS_DIR, newFilename)
      renameSync(filePath, newFilePath)
      console.log(`Renamed: ${filename} -> ${newFilename}`)
      renamedCount++
    }

    if (!needsUpdate && !needsRename) {
      console.log(`Skipping ${filename} - already migrated`)
      skippedCount++
    }
  }

  console.log(`\nMigration complete: ${migratedCount} eventIds added, ${renamedCount} files renamed, ${skippedCount} skipped`)
}

migrateEvents()
