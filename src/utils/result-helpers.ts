import { Result } from "@effect-atom/atom-react";

/**
 * Converts a Result<A[], E> to A[], returning an empty array for Initial/Failure states.
 * Useful for unwrapping Result arrays with a safe default.
 *
 * @example
 * const events = resultToArray(eventsResult);
 * // Instead of:
 * // const events = Result.match(eventsResult, {
 * //   onInitial: () => [],
 * //   onSuccess: (success) => success.value,
 * //   onFailure: () => []
 * // });
 */
export function resultToArray<A, E>(result: Result.Result<A[], E>): A[] {
  return Result.match(result, {
    onInitial: () => [] as A[],
    onSuccess: (success) => success.value,
    onFailure: () => [] as A[]
  });
}

/**
 * Converts a Result to a value with a default fallback.
 * Returns the default value for Initial/Failure states.
 *
 * @example
 * const timestamp = resultOr(timestampResult, new Date());
 */
export function resultOr<A, E>(result: Result.Result<A, E>, defaultValue: A): A {
  return Result.match(result, {
    onInitial: () => defaultValue,
    onSuccess: (success) => success.value,
    onFailure: () => defaultValue
  });
}
