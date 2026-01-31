import { Atom } from '@effect-atom/atom-react';
import { Effect } from 'effect';
import { appAtomRuntime } from '../appLayerRuntime';
import { checkMissingCredentials, type MissingCredential } from './env-config';

export const missingCredentialsAtom = appAtomRuntime.atom(
  () => checkMissingCredentials(),
  { initialValue: [] as MissingCredential[] }
).pipe(Atom.keepAlive);

export const recheckCredentialsAtom = appAtomRuntime.fn(() => {
  return checkMissingCredentials();
});
