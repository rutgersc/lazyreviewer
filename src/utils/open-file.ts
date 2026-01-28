import { Effect, Console, Stream } from "effect"
import { Command, CommandExecutor } from "@effect/platform"
import { Path } from "@effect/platform"

export const openFileInEditor = (filePath: string) => Effect.gen(function* () {
  const platform = process.platform
  const path = yield* Path.Path

  // Resolve to absolute path
  const absolutePath = path.resolve(filePath)

  yield* Console.log(`Opening file: ${absolutePath}`)

  let command: Command.Command

  if (platform === 'win32') {
    // Windows - use start
    command = Command.make('cmd', '/c', 'start', '', absolutePath)
  } else if (platform === 'darwin') {
    // macOS - use open
    command = Command.make('open', absolutePath)
  } else {
    // Linux - use xdg-open
    command = Command.make('xdg-open', absolutePath)
  }

  const executor = yield* CommandExecutor.CommandExecutor
  const runningProcess = yield* Effect.scoped(
    Effect.gen(function* () {
      const process = yield* executor.start(command)

      // Capture stdout and stderr as strings
      const stdoutChunks = yield* Stream.runCollect(process.stdout).pipe(
        Effect.catchAll(() => Effect.succeed([]))
      )
      const stderrChunks = yield* Stream.runCollect(process.stderr).pipe(
        Effect.catchAll(() => Effect.succeed([]))
      )

      const stdout = new TextDecoder().decode(
        new Uint8Array(Array.from(stdoutChunks).flatMap(chunk => Array.from(chunk)))
      )
      const stderr = new TextDecoder().decode(
        new Uint8Array(Array.from(stderrChunks).flatMap(chunk => Array.from(chunk)))
      )

      if (stdout) yield* Console.log(`stdout: ${stdout}`)
      if (stderr) yield* Console.log(`stderr: ${stderr}`)

      const exitCode = yield* process.exitCode

      return { exitCode, stdout, stderr }
    })
  )

  yield* Console.log(`File opened with exit code: ${runningProcess.exitCode}`)

  if (runningProcess.exitCode !== 0) {
    yield* Console.log(`Command failed with exit code ${runningProcess.exitCode}`)
    if (runningProcess.stderr) {
      yield* Console.log(`Error: ${runningProcess.stderr}`)
    }
  }
})
