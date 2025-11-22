import { Effect } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { LogStorage } from "./logStorage";

export const consoleLogsAtom = appAtomRuntime.subscriptionRef(
  Effect.map(LogStorage, service => service.logsRef)
)

export type { LogEntry } from "./logStorage";
