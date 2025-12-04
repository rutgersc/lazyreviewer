import { Schema} from "effect";
import { GitlabMergeRequestSchema } from "../gitlab/gitlab-schema";

export const MergeRequestSchema = Schema.Struct({
  ...GitlabMergeRequestSchema.fields,
}).annotations({ identifier: "MergeRequest" })

export interface MergeRequest extends Schema.Schema.Type<typeof MergeRequestSchema> {}
