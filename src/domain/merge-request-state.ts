// Same as DetailedMergeStatus: GitLab owns the enum, so derive it rather than keeping a copy.
export { MergeRequestStateSchema } from "../graphql/generated/gitlab-base-types.schema";
export type { MergeRequestState } from "../graphql/generated/gitlab-base-types";
