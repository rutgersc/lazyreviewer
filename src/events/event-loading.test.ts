import { describe, test, expect } from "bun:test"
import { Effect, Schema } from "effect"
import { EventSchema } from "./events"
import * as fs from "fs"
import * as path from "path"

describe("Event Loading", () => {
  test("loadAllEvents successfully decodes all event files", async () => {
    const eventsDir = "storage/events"
    const files = fs.readdirSync(eventsDir)
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort()

    console.log(`Found ${jsonFiles.length} event files`)

    const results: { file: string; success: boolean; error?: string }[] = []

    for (const filename of jsonFiles) {
      const filePath = path.join(eventsDir, filename)
      const content = fs.readFileSync(filePath, 'utf-8')

      const program = Effect.gen(function* () {
        const jsonData = JSON.parse(content)
        yield* Schema.decodeUnknown(EventSchema)(jsonData)
        return { file: filename, success: true }
      }).pipe(
        Effect.catch((error) =>
          Effect.succeed({ file: filename, success: false, error: String(error) })
        )
      )

      const result = await Effect.runPromise(program)
      results.push(result)
    }

    const failures = results.filter(r => !r.success)
    if (failures.length > 0) {
      console.log(`\nFailed to decode ${failures.length} files:`)
      for (const f of failures) {
        console.log(`\n--- ${f.file} ---`)
        console.log(f.error)
      }
    }

    const successes = results.filter(r => r.success)
    console.log(`\nSuccessfully decoded ${successes.length}/${results.length} files`)

    expect(failures.length).toBe(0)
  })
})
