import { GraphQLClient } from "graphql-request"
import { getSdk as getMRsSdk } from "../graphql/mrs.generated";
import type { MRsQuery } from "../graphql/mrs.generated";
import { getSdk as getProjectMRsSdk } from "../graphql/project-mrs.generated";
import type { ProjectMRsQuery } from "../graphql/project-mrs.generated";
import { getSdk as getSingleMrSdk } from "../graphql/single-mr.generated";
import type { SingleMrQuery } from "../graphql/single-mr.generated";
import { getSdk as getMrPipelineSdk } from "../graphql/mr-pipeline.generated";
import { getSdk as getProjectPipelinesJobHistorySdk } from "../graphql/project-pipelines-job-history.generated";
import { getSdk as getJobSdk } from "../graphql/job.generated";
import type { CiJobStatus, MergeRequestState } from "../graphql/generated/gitlab-base-types";
import { extractElabTicketsFromTitle } from "../jira/jira-service";
import type { PipelineJob, PipelineStage, Discussion, GitlabMergeRequest } from "./gitlab-schema";
import { Data, Effect, Console } from "effect";
import fs from "fs";
import path from "path";
import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent, GitlabSingleMrFetchedEvent, GitlabJobTraceFetchedEvent, GitlabPipelineFetchedEvent, GitlabJobHistoryFetchedEvent } from "../events/gitlab-events";
import { projectGitlabJobHistoryFetchedEvent, projectGitlabJobTraceFetchedEvent, projectGitlabPipelineFetchedEvent, projectGitlabProjectMrsFetchedEvent, projectGitlabSingleMrFetchedEvent } from "./gitlab-projections";
import { generateEventId } from "../events/event-id";

export type {
  PipelineJob,
  PipelineStage,
  DiscussionNote,
  Discussion,
  GitlabMergeRequest
} from "./gitlab-schema"

export class FetchGitlabMrsError extends Data.TaggedError("FetchGitlabMrsError")<{
  cause: unknown;
}> { }

const getElabGitSdk = () => {
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  // Combine all SDKs into one unified SDK
  return {
    ...getMRsSdk(client),
    ...getProjectMRsSdk(client),
    ...getSingleMrSdk(client),
    ...getMrPipelineSdk(client),
    ...getProjectPipelinesJobHistorySdk(client),
    ...getJobSdk(client),
  };
};

export class FetchGitlabProjectMrsError extends Data.TaggedError("FetchGitlabProjectMrsError")<{
  cause: unknown;
}> { }

export const getGitlabMrsByProject = Effect.fn("getGitlabMrsByProject")(function* (projectPath: string, state: MergeRequestState = 'opened') {
  const event = yield* getGitlabMrsByProjectAsEvent(projectPath, state);
  return projectGitlabProjectMrsFetchedEvent(event);
})

export class FetchJobTraceError extends Data.TaggedError("FetchJobTraceError")<{
  cause: unknown;
}> { }

const getJobTraceRaw = Effect.fn("getJobTraceRaw")(function* (projectId: string, jobId: string) {
  const token = process.env.GITLAB_TOKEN;
  const encodedProjectId = encodeURIComponent(projectId);
  const realIdLol = jobId.split("/");
  const uhh = realIdLol[realIdLol.length-1];
  const url = `https://git.elabnext.com/api/v4/projects/${encodedProjectId}/jobs/${uhh}/trace`;

  const response = yield* Effect.tryPromise({
    try: () => fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token!
      }
    }),
    catch: cause => new FetchJobTraceError({ cause })
  });

  if (!response.ok) {
    yield* Console.error(`Failed to fetch job trace: ${url} ${response.status} ${response.statusText}`);
    return null;
  }

  const traceData = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: cause => new FetchJobTraceError({ cause })
  });

  return traceData;
})

export const getJobTrace = Effect.fn("getJobTrace")(function* (projectId: string, jobId: string) {
  const event = yield* getJobTraceAsEvent(projectId, jobId);
  return projectGitlabJobTraceFetchedEvent(event);
})

export class FetchMrPipelineError extends Data.TaggedError("FetchMrPipelineError")<{
  cause: unknown;
}> { }

export const getMrPipeline = Effect.fn("getMrPipeline")(function* (projectPath: string, iid: string) {
  const event = yield* getMrPipelineAsEvent(projectPath, iid);
  const pipeline = projectGitlabPipelineFetchedEvent(event);

  if (!pipeline) {
    yield* Console.log(`[Pipeline] No pipeline found for MR ${iid} in ${projectPath}`);
  } else {
    yield* Console.log(`[Pipeline] Fetched pipeline for MR ${iid}: ${pipeline.stage.length} stages`);
  }

  return pipeline;
})

export class FetchJobHistoryError extends Data.TaggedError("FetchJobHistoryError")<{
  cause: unknown;
}> { }

export const fetchJobHistory = Effect.fn("fetchJobHistory")(function* (
  projectPath: string,
  jobName: string,
  limit: number = 50
) {
  const event = yield* fetchJobHistoryAsEvent(projectPath, jobName, limit);
  const history = projectGitlabJobHistoryFetchedEvent(event);

  yield* Console.log(`[JobHistory] Fetched ${history.length} job history entries for "${jobName}" in ${projectPath}`);
  return history;
})

export class FetchSingleMrError extends Data.TaggedError("FetchSingleMrError")<{
  cause: unknown;
}> { }

export const getSingleMr = Effect.fn("getSingleMr")(function* (projectPath: string, iid: string) {
  const event = yield* getSingleMrAsEvent(projectPath, iid);
  const mr = projectGitlabSingleMrFetchedEvent(event);

  if (!mr) {
    yield* Console.log(`[SingleMR] No MR found for ${iid} in ${projectPath}`);
  } else {
    yield* Console.log(`[SingleMR] Fetched MR ${iid} in ${projectPath}`);
  }

  return mr;
})

// Event-returning wrapper functions
export const getGitlabMrsAsEvent = Effect.fn("getGitlabMrsAsEvent")(function* (usernames: string[], state: MergeRequestState = 'opened') {
  const sdk = getElabGitSdk();
  const data = yield* Effect.tryPromise({
    try: () => sdk.MRs({
      usernames: usernames,
      state: state,
      first: 30
    }),
    catch: cause => new FetchGitlabMrsError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'gitlab-user-mrs-fetched-event' as const;
  const event: GitlabUserMergeRequestsFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    mrs: data,
    forUsernames: usernames,
    forState: state,
    timestamp
  };

  return event;
});

export const getGitlabMrsByProjectAsEvent = Effect.fn("getGitlabMrsByProjectAsEvent")(function* (projectPath: string, state: MergeRequestState = 'opened') {
  yield* Console.log(`[GitLab] Fetching MRs for project: "${projectPath}", state: ${state}`);

  const sdk = getElabGitSdk();
  const data = yield* Effect.tryPromise({
    try: () => sdk.ProjectMRs({
      projectPath: projectPath,
      state: state,
      first: 40
    }),
    catch: cause => new FetchGitlabProjectMrsError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'gitlab-project-mrs-fetched-event' as const;
  const event: GitlabprojectMergeRequestsFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    mrs: data,
    forProjectPath: projectPath,
    forState: state,
    timestamp
  };

  return event;
});

export const getJobTraceAsEvent = Effect.fn("getJobTraceAsEvent")(function* (projectId: string, jobId: string) {
  const traceData = yield* getJobTraceRaw(projectId, jobId);

  const timestamp = new Date().toISOString();
  const type = 'gitlab-jobtrace-fetched-event' as const;
  const event: GitlabJobTraceFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    jobTrace: traceData || '',
    forProjectId: projectId,
    forJobId: jobId,
    timestamp
  };

  return event;
});

export const getMrPipelineAsEvent = Effect.fn("getMrPipelineAsEvent")(function* (projectPath: string, iid: string) {
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sdk = getMrPipelineSdk(client);

  const data = yield* Effect.tryPromise({
    try: () => sdk.MRPipeline({
      projectPath,
      iid
    }),
    catch: cause => new FetchMrPipelineError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'gitlab-pipeline-fetched-event' as const;
  const event: GitlabPipelineFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    pipeline: data,
    forProjectPath: projectPath,
    forIid: iid,
    timestamp
  };

  return event;
});

export const fetchJobHistoryAsEvent = Effect.fn("fetchJobHistoryAsEvent")(function* (
  projectPath: string,
  jobName: string,
  limit: number = 50
) {
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    responseMiddleware: m => {
      return m;
    }
  });

  const sdk = getProjectPipelinesJobHistorySdk(client);

  const data = yield* Effect.tryPromise({
    try: () => sdk.ProjectPipelinesJobHistory({
      projectPath,
      jobName,
      first: limit,
      after: null
    }),
    catch: cause => new FetchJobHistoryError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'gitlab-jobhistory-fetched-event' as const;
  const event: GitlabJobHistoryFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    jobHistory: data,
    forProjectPath: projectPath,
    forJobName: jobName,
    timestamp
  };

  return event;
});

export const getSingleMrAsEvent = Effect.fn("getSingleMrAsEvent")(function* (projectPath: string, iid: string) {
  yield* Console.log(`[GitLab] Fetching single MR: ${iid} in project "${projectPath}"`);

  const sdk = getElabGitSdk();
  const data = yield* Effect.tryPromise({
    try: () => sdk.SingleMR({
      projectPath: projectPath,
      iid: iid
    }),
    catch: cause => new FetchSingleMrError({ cause })
  });

  const timestamp = new Date().toISOString();
  const type = 'gitlab-single-mr-fetched-event' as const;
  const event: GitlabSingleMrFetchedEvent = {
    eventId: generateEventId(timestamp, type),
    type,
    mr: data,
    forProjectPath: projectPath,
    forIid: iid,
    timestamp
  };

  return event;
});


