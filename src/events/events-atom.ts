import { Stream } from "effect";
import { appAtomRuntime } from "../appLayerRuntime";
import { EventStorage, type LazyReviewerEvent } from "./events";
import { Atom } from "@effect-atom/atom-react";

export const allEventsAtom = appAtomRuntime.atom(
  Stream.unwrap(EventStorage.eventsStream).pipe(
    Stream.scan([] as LazyReviewerEvent[], (acc, event) => [...acc, event])
  ),
  { initialValue: [] }
)

export const selectedEventIndexAtom = Atom.make<number | null>(null);