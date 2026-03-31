import { Atom } from "effect/unstable/reactivity";
import { Effect, FileSystem, Stream, Console } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { getEnvFilePath, parseEnvContent, deriveMissingCredentials, type MissingCredential, dotEnvFileChanges } from './dotenv-config';

export const missingCredentialsAtom = appAtomRuntime.atom(
  Stream.unwrap(dotEnvFileChanges),
  { initialValue: [] as MissingCredential[] }
).pipe(Atom.setLazy(false), Atom.keepAlive);
