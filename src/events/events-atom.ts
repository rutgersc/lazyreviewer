import { Effect, Stream } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type Event } from "./events";
import { Atom, Result } from "@effect-atom/atom-react";
import { resultToArray } from "../utils/result-helpers";

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(EventStorage.eventsStream).pipe(
    Stream.scan([] as Event[], (acc, event) => [...acc, event])
  ),
  { initialValue: [] }
)

export const selectedEventIndexAtom = Atom.make<number | null>(null);

// Materialized events atom for FactsPane display only
// This is kept separate from projections to avoid premature materialization
export const materializedEventsAtom = Atom.readable((get) => {
  const allEventsResult = get(allEventsAtom);
  return resultToArray(allEventsResult);
});