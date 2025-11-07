import { Schema} from "effect";
import { GitlabMergeRequestSchema } from "../gitlab/gitlab-schema";
import { JiraIssueSchema } from "../jira/jira-schema";

export const MergeRequestSchema = Schema.Struct({
  ...GitlabMergeRequestSchema.fields,
  jiraIssues: Schema.mutable(Schema.Array(JiraIssueSchema))
}).annotations({ identifier: "MergeRequest" })

export interface MergeRequest extends Schema.Schema.Type<typeof MergeRequestSchema> {}
