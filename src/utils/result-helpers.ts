import { AsyncResult } from "effect/unstable/reactivity";

/**
 * Converts an AsyncResult<A[], E> to A[], returning an empty array for Initial/Failure states.
 */
export function resultToArray<A, E>(result: AsyncResult.AsyncResult<A[], E>): A[] {
  return AsyncResult.match(result, {
    onInitial: () => [] as A[],
    onSuccess: (success) => success.value,
    onFailure: () => [] as A[]
  });
}

/**
 * Converts an AsyncResult to a value with a default fallback.
 * Returns the default value for Initial/Failure states.
 */
export function resultOr<A, E>(result: AsyncResult.AsyncResult<A, E>, defaultValue: A): A {
  return AsyncResult.match(result, {
    onInitial: () => defaultValue,
    onSuccess: (success) => success.value,
    onFailure: () => defaultValue
  });
}
