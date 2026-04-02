import { Atom } from "effect/unstable/reactivity";
import { Effect, FileSystem, Stream, Console } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { credentialsFileChanges, type MissingCredential } from './credentials-config';

export const missingCredentialsAtom = appAtomRuntime.atom(
  Stream.unwrap(credentialsFileChanges),
  { initialValue: [] as MissingCredential[] }
).pipe(Atom.setLazy(false), Atom.keepAlive);
