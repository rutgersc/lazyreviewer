import { Effect, Stream } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage } from "./events";

export const allEventsAtom = appAtomRuntime.pull(
  Stream.unwrap(Effect.map(EventStorage, service => service.eventsStream)),
  { initialValue: [] }
)
