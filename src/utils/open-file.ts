import { Effect, Console, Path } from "effect"
import { execFile } from "child_process"

export const openFileInEditor = (filePath: string) => Effect.gen(function* () {
  const platform = process.platform
  const path = yield* Path.Path

  const absolutePath = path.resolve(filePath)
  yield* Console.log(`Opening file: ${absolutePath}`)

  const [cmd, ...args]: [string, ...string[]] =
    platform === 'win32' ? ['cmd', '/c', 'start', '', absolutePath]
    : platform === 'darwin' ? ['open', absolutePath]
    : ['xdg-open', absolutePath]

  yield* Effect.callback<void, Error>((resume) => {
    execFile(cmd, args, (error) => {
      if (error) resume(Effect.fail(error))
      else resume(Effect.succeed(void 0))
    })
  })

  yield* Console.log(`File opened successfully`)
})
