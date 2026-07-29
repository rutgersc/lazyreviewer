// GitLab owns this enum — derive it from the generated schema instead of restating the literals,
// so an upstream addition can't leave a stale hand-written copy behind.
export { DetailedMergeStatusSchema } from "../graphql/generated/gitlab-base-types.schema";
export type { DetailedMergeStatus } from "../graphql/generated/gitlab-base-types";
