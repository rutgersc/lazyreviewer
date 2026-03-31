import * as path from "node:path"
import * as os from "node:os"

const APP_NAME = "lazyreviewer"

export const appDataDir = (() => {
  const platform = os.platform()
  if (platform === "win32") return path.join(os.homedir(), "AppData", "Local", APP_NAME)
  if (platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", APP_NAME)
  return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), APP_NAME)
})()

export const appDataPath = (...segments: string[]) => path.join(appDataDir, ...segments)
