import { Schema } from "effect"
import { MRsQuerySchema } from "../graphql/mrs.schema"

// GitLab event schemas using generated query schemas
const GitlabUserMergeRequestsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-user-mrs-fetched-event'),
  mrs: MRsQuerySchema,
  forUsernames: Schema.Array(Schema.String),
  forState: Schema.String
})

// For other events, use Schema.Unknown until we create their schemas
const GitlabProjectMergeRequestsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-project-mrs-fetched-event'),
  mrs: Schema.Unknown,
  forProjectPath: Schema.String,
  forState: Schema.String
})

const GitlabSingleMrFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-single-mr-fetched-event'),
  mr: Schema.Unknown,
  forProjectPath: Schema.String,
  forIid: Schema.String
})

const GitlabJobTraceFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-jobtrace-fetched-event'),
  jobTrace: Schema.String,
  forProjectId: Schema.String,
  forJobId: Schema.String
})

const GitlabPipelineFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-pipeline-fetched-event'),
  pipeline: Schema.Unknown,
  forProjectPath: Schema.String,
  forIid: Schema.String
})

const GitlabJobHistoryFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('gitlab-jobhistory-fetched-event'),
  jobHistory: Schema.Unknown,
  forProjectPath: Schema.String,
  forJobName: Schema.String
})

// Bitbucket event schemas
const BitbucketPrsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-prs-fetched-event'),
  prsResponse: Schema.Unknown,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forState: Schema.Union(
    Schema.Literal('opened'),
    Schema.Literal('merged'),
    Schema.Literal('closed'),
    Schema.Literal('all'),
    Schema.Literal('locked')
  )
})

const BitbucketSinglePrFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-single-pr-fetched-event'),
  pr: Schema.Unknown,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number
})

const BitbucketPrCommentsFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('bitbucket-pr-comments-fetched-event'),
  commentsResponse: Schema.Unknown,
  forWorkspace: Schema.String,
  forRepoSlug: Schema.String,
  forPrId: Schema.Number
})

// Jira event schemas
const JiraIssuesFetchedEventSchema = Schema.Struct({
  type: Schema.Literal('jira-issues-fetched-event'),
  searchResponse: Schema.Unknown,
  issues: Schema.Unknown,
  forTicketKeys: Schema.Array(Schema.String)
})

// Discriminated union of all events
export const EventSchema = Schema.Union(
  GitlabUserMergeRequestsFetchedEventSchema,
  GitlabProjectMergeRequestsFetchedEventSchema,
  GitlabSingleMrFetchedEventSchema,
  GitlabJobTraceFetchedEventSchema,
  GitlabPipelineFetchedEventSchema,
  GitlabJobHistoryFetchedEventSchema,
  BitbucketPrsFetchedEventSchema,
  BitbucketSinglePrFetchedEventSchema,
  BitbucketPrCommentsFetchedEventSchema,
  JiraIssuesFetchedEventSchema
)
