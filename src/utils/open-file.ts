import { Effect } from "effect"
import { Command, CommandExecutor } from "@effect/platform"

export const openFileInEditor = (filePath: string) => Effect.gen(function* () {
  const platform = process.platform

  let command: Command.Command

  if (platform === 'win32') {
    // Windows - use start
    command = Command.make('cmd', '/c', 'start', '', filePath)
  } else if (platform === 'darwin') {
    // macOS - use open
    command = Command.make('open', filePath)
  } else {
    // Linux - use xdg-open
    command = Command.make('xdg-open', filePath)
  }

  const executor = yield* CommandExecutor.CommandExecutor
  const runningProcess = yield* Effect.scoped(executor.start(command))
  yield* runningProcess.exitCode.pipe(
    Effect.catchAll(() => Effect.succeed(1))
  )
})
