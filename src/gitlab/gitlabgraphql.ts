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
import { extractElabTicketsFromTitle } from "../jira/jiraService";
import type { PipelineJob, PipelineStage, Discussion, GitlabMergeRequest } from "./gitlab-schema";
import { Data, Effect, Console } from "effect";
import fs from "fs";
import path from "path";
import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent, GitlabSingleMrFetchedEvent, GitlabJobTraceFetchedEvent, GitlabPipelineFetchedEvent, GitlabJobHistoryFetchedEvent } from "../events/gitlab-events";

export type {
  PipelineJob,
  PipelineStage,
  DiscussionNote,
  Discussion,
  GitlabMergeRequest
} from "./gitlab-schema"

export interface JobHistoryEntry {
  jobId: string;
  jobName: string;
  jobStatus: CiJobStatus;
  failureMessage: string | null;
  startedAt: string;
  duration: number | null;
  pipelineId: string;
  pipelineIid: number;
  pipelineRef: string;
  pipelineCreatedAt: string;
  pipelineSource: string;
  webPath: string | null;
  isDevelopBranch: boolean;
  mergeRequestIid: string | null;
  mergeRequestTitle: string | null;
  mergeRequestAuthor: string | null;
}

export const mapMrFromQuery = (
  username: string,
  mr: NonNullable<
      NonNullable<
        NonNullable<
          NonNullable<
            NonNullable<MRsQuery['users']>['nodes']
          >[number]
        >['authoredMergeRequests']
      >['nodes']
    >[number])
  : GitlabMergeRequest => {

  if (!mr) {
    throw Error("mr null");
  }

  const pipeline = {
    stage: mr.headPipeline?.stages?.nodes
      ?.map(stage => ({
        name: stage?.name || '',
        jobs: stage?.jobs?.nodes
          ?.map(job => ({
            id: job?.id || '',
            localId: Number(job?.id.split('/').pop()),
            name: job?.name || '',
            status: job?.status || 'CREATED',
            failureMessage: job?.failureMessage || null,
            webPath: job?.webPath || null,
            startedAt: job?.startedAt || '',
            duration: job?.duration ?? null
          } satisfies PipelineJob))
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
          || []
      })) || []
  };

  const rawDiscussions = mr.discussions?.nodes || [];
  const discussions: Discussion[] = rawDiscussions.map(d => ({
    id: d?.id || '',
    resolved: d?.resolved || false,
    resolvable: d?.resolvable || false,
    notes: (d?.notes?.nodes || []).map(note => ({
      id: note?.id || '',
      body: note?.body || '',
      author: note?.author?.name || '',
      createdAt: new Date(note?.createdAt || ''),
      resolvable: note?.resolvable || false,
      resolved: note?.resolved || false,
      position: note?.position ? {
        filePath: note.position.filePath || null,
        newLine: note.position.newLine || null,
        oldLine: note.position.oldLine || null,
        oldPath: note.position.oldPath || null,
      } : null,
    }))
  }));

  const totalDiscussions = discussions.length;
  const resolvableDiscussions = discussions.filter(d => d.resolvable).length;
  const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved === true).length;
  const unresolvedDiscussions = resolvableDiscussions - resolvedDiscussions;

  return {
    id: mr.id,
    iid: mr.iid,
    title: mr.name!,
    jiraIssueKeys: extractElabTicketsFromTitle(mr.name!),
    webUrl: mr.webUrl!,
    sourcebranch: mr.sourceBranch,
    targetbranch: mr.targetBranch,
    project: {
      name: mr.project.name,
      path: mr.project.path,
      fullPath: mr.project.fullPath
    },
    author: username,
    avatarUrl: mr.author?.avatarUrl || null,
    createdAt: new Date(mr.createdAt),
    updatedAt: new Date(mr.updatedAt),
    state: mr.state,
    approvedBy: mr!.approvedBy!.nodes!.map(n => ({ id: n!.id || n!.name, name: n!.name, username: n!.username })),
    resolvableDiscussions,
    resolvedDiscussions,
    unresolvedDiscussions,
    totalDiscussions,
    discussions,
    pipeline: pipeline
  } satisfies GitlabMergeRequest;
}

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

export const getGitlabMrs = Effect.fn("getGitlabMrs")(function* (usernames: string[], state: MergeRequestState = 'opened') {
  const event = yield* getGitlabMrsAsEvent(usernames, state);

  // Log warnings for over-fetched MRs
  for (const user of event.mrs.users!.nodes!) {
    if (user!.authoredMergeRequests!.nodes!.length > 15) {
      yield* Console.error(`Fetched more MRs than needed ${user!.authoredMergeRequests!.nodes!.length} > 15`);
    }
  }

  return projectGitlabUserMrsFetchedEvent(event);
})

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
      first: 7
    }),
    catch: cause => new FetchGitlabMrsError({ cause })
  });

  const event: GitlabUserMergeRequestsFetchedEvent = {
    type: 'gitlab-user-mrs-fetched-event',
    mrs: data,
    forUsernames: usernames,
    forState: state
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
      first: 25
    }),
    catch: cause => new FetchGitlabProjectMrsError({ cause })
  });

  const event: GitlabprojectMergeRequestsFetchedEvent = {
    type: 'gitlab-project-mrs-fetched-event',
    mrs: data,
    forProjectPath: projectPath,
    forState: state
  };

  return event;
});

export const getJobTraceAsEvent = Effect.fn("getJobTraceAsEvent")(function* (projectId: string, jobId: string) {
  const traceData = yield* getJobTraceRaw(projectId, jobId);

  const event: GitlabJobTraceFetchedEvent = {
    type: 'gitlab-jobtrace-fetched-event',
    jobTrace: traceData || '',
    forProjectId: projectId,
    forJobId: jobId
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

  const event: GitlabPipelineFetchedEvent = {
    type: 'gitlab-pipeline-fetched-event',
    pipeline: data,
    forProjectPath: projectPath,
    forIid: iid
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
      first: limit
    }),
    catch: cause => new FetchJobHistoryError({ cause })
  });

  const event: GitlabJobHistoryFetchedEvent = {
    type: 'gitlab-jobhistory-fetched-event',
    jobHistory: data,
    forProjectPath: projectPath,
    forJobName: jobName
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

  const event: GitlabSingleMrFetchedEvent = {
    type: 'gitlab-single-mr-fetched-event',
    mr: data,
    forProjectPath: projectPath,
    forIid: iid
  };

  return event;
});

// Projection functions
export const projectGitlabUserMrsFetchedEvent = (event: GitlabUserMergeRequestsFetchedEvent): GitlabMergeRequest[] => {
  const res = event.mrs.users!.nodes!.flatMap(user => {
    const mappedMrs = user!
      .authoredMergeRequests!
      .nodes!
      .slice(0, 15)
      .map(mr => mapMrFromQuery(user!.username, mr));

    return mappedMrs;
  });

  return res;
};

export const projectGitlabProjectMrsFetchedEvent = (event: GitlabprojectMergeRequestsFetchedEvent): GitlabMergeRequest[] => {
  const mapProjectMr = (
    mr: NonNullable<
      NonNullable<
        NonNullable<
          NonNullable<ProjectMRsQuery['project']>['mergeRequests']
        >['nodes']
      >[number]
    >
  ): GitlabMergeRequest => {
    if (!mr) {
      throw Error("mr null");
    }

    const pipeline = {
      stage: mr.headPipeline?.stages?.nodes
        ?.map(stage => ({
          name: stage?.name || '',
          jobs: stage?.jobs?.nodes
            ?.map(job => ({
              id: job?.id || '',
              localId: Number(job?.id.split('/').pop()),
              name: job?.name || '',
              status: job?.status || 'CREATED',
              failureMessage: job?.failureMessage || null,
              webPath: job?.webPath || null,
              startedAt: job?.startedAt || '',
              duration: job?.duration ?? null
            } satisfies PipelineJob))
            .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
            || []
        })) || []
    };

    const rawDiscussions = mr.discussions?.nodes || [];
    const discussions: Discussion[] = rawDiscussions.map(d => ({
      id: d?.id || '',
      resolved: d?.resolved || false,
      resolvable: d?.resolvable || false,
      notes: (d?.notes?.nodes || []).map(note => ({
        id: note?.id || '',
        body: note?.body || '',
        author: note?.author?.name || '',
        createdAt: new Date(note?.createdAt || ''),
        resolvable: note?.resolvable || false,
        resolved: note?.resolved || false,
        position: note?.position ? {
          filePath: note.position.filePath || null,
          newLine: note.position.newLine || null,
          oldLine: note.position.oldLine || null,
          oldPath: note.position.oldPath || null,
        } : null,
      }))
    }));

    const totalDiscussions = discussions.length;
    const resolvableDiscussions = discussions.filter(d => d.resolvable).length;
    const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved === true).length;
    const unresolvedDiscussions = resolvableDiscussions - resolvedDiscussions;

    return {
      id: mr.id,
      iid: mr.iid,
      title: mr.title!,
      jiraIssueKeys: extractElabTicketsFromTitle(mr.title!),
      webUrl: mr.webUrl!,
      sourcebranch: mr.sourceBranch,
      targetbranch: mr.targetBranch,
      project: {
        name: mr.project.name,
        path: mr.project.path,
        fullPath: mr.project.fullPath
      },
      author: mr.author?.username || '',
      avatarUrl: mr.author?.avatarUrl || null,
      createdAt: new Date(mr.createdAt),
      updatedAt: new Date(mr.updatedAt),
      state: mr.state,
      approvedBy: mr!.approvedBy!.nodes!.map(n => ({ id: n!.id || n!.name, name: n!.name, username: n!.username })),
      resolvableDiscussions,
      resolvedDiscussions,
      unresolvedDiscussions,
      totalDiscussions,
      discussions,
      pipeline: pipeline
    } satisfies GitlabMergeRequest;
  }

  const mrs = event.mrs.project?.mergeRequests?.nodes || [];
  return mrs.filter(mr => mr !== null).map(mr => mapProjectMr(mr!));
};

export const projectGitlabJobTraceFetchedEvent = (event: GitlabJobTraceFetchedEvent): string | null => {
  return event.jobTrace || null;
};

export const projectGitlabPipelineFetchedEvent = (event: GitlabPipelineFetchedEvent): { stage: PipelineStage[] } | null => {
  const mr = event.pipeline.project?.mergeRequest;
  if (!mr?.headPipeline) {
    return null;
  }

  const pipeline = {
    stage: mr.headPipeline.stages?.nodes
      ?.map(stage => ({
        name: stage?.name || '',
        jobs: stage?.jobs?.nodes
          ?.map(job => ({
            id: job?.id || '',
            localId: Number(job?.id.split('/').pop()),
            name: job?.name || '',
            status: job?.status || 'CREATED',
            failureMessage: job?.failureMessage || null,
            webPath: job?.webPath || null,
            startedAt: job?.startedAt || '',
            duration: job?.duration ?? null
          } satisfies PipelineJob))
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
          || []
      })) || []
  };

  return pipeline;
};

export const projectGitlabJobHistoryFetchedEvent = (event: GitlabJobHistoryFetchedEvent): JobHistoryEntry[] => {
  const pipelines = event.jobHistory.project?.pipelines?.nodes || [];

  const history: JobHistoryEntry[] = pipelines
    .filter(pipeline => pipeline?.job !== null)
    .map(pipeline => {
      const job = pipeline!.job!;
      return {
        jobId: job.id || '',
        jobName: job.name || '',
        jobStatus: job.status || 'CREATED',
        failureMessage: job.failureMessage || null,
        startedAt: job.startedAt || '',
        duration: job.duration ?? null,
        pipelineId: pipeline!.id,
        pipelineIid: parseInt(pipeline!.iid),
        pipelineRef: pipeline!.ref || '',
        pipelineCreatedAt: pipeline!.createdAt || '',
        pipelineSource: pipeline!.source || '',
        webPath: job.webPath || null,
        isDevelopBranch: pipeline!.ref === 'develop',
        mergeRequestIid: pipeline!.mergeRequest?.iid || null,
        mergeRequestTitle: pipeline!.mergeRequest?.title || null,
        mergeRequestAuthor: pipeline!.mergeRequest?.author?.username || null
      } satisfies JobHistoryEntry;
    });

  return history;
};

export const projectGitlabSingleMrFetchedEvent = (event: GitlabSingleMrFetchedEvent): GitlabMergeRequest | null => {
  const mr = event.mr.project?.mergeRequest;

  if (!mr) {
    return null;
  }

  const pipeline = {
    stage: mr.headPipeline?.stages?.nodes
      ?.map(stage => ({
        name: stage?.name || '',
        jobs: stage?.jobs?.nodes
          ?.map(job => ({
            id: job?.id || '',
            localId: Number(job?.id.split('/').pop()),
            name: job?.name || '',
            status: job?.status || 'CREATED',
            failureMessage: job?.failureMessage || null,
            webPath: job?.webPath || null,
            startedAt: job?.startedAt || '',
            duration: job?.duration ?? null
          } satisfies PipelineJob))
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
          || []
      })) || []
  };

  const rawDiscussions = mr.discussions?.nodes || [];
  const discussions: Discussion[] = rawDiscussions.map(d => ({
    id: d?.id || '',
    resolved: d?.resolved || false,
    resolvable: d?.resolvable || false,
    notes: (d?.notes?.nodes || []).map(note => ({
      id: note?.id || '',
      body: note?.body || '',
      author: note?.author?.name || '',
      createdAt: new Date(note?.createdAt || ''),
      resolvable: note?.resolvable || false,
      resolved: note?.resolved || false,
      position: note?.position ? {
        filePath: note.position.filePath || null,
        newLine: note.position.newLine || null,
        oldLine: note.position.oldLine || null,
        oldPath: note.position.oldPath || null,
      } : null,
    }))
  }));

  const totalDiscussions = discussions.length;
  const resolvableDiscussions = discussions.filter(d => d.resolvable).length;
  const resolvedDiscussions = discussions.filter(d => d.resolvable && d.resolved === true).length;
  const unresolvedDiscussions = resolvableDiscussions - resolvedDiscussions;

  return {
    id: mr.id,
    iid: mr.iid,
    title: mr.title!,
    jiraIssueKeys: extractElabTicketsFromTitle(mr.title!),
    webUrl: mr.webUrl!,
    sourcebranch: mr.sourceBranch,
    targetbranch: mr.targetBranch,
    project: {
      name: mr.project.name,
      path: mr.project.path,
      fullPath: mr.project.fullPath
    },
    author: mr.author?.username || '',
    avatarUrl: mr.author?.avatarUrl || null,
    createdAt: new Date(mr.createdAt),
    updatedAt: new Date(mr.updatedAt),
    state: mr.state,
    approvedBy: mr!.approvedBy!.nodes!.map(n => ({ id: n!.id || n!.name, name: n!.name, username: n!.username })),
    resolvableDiscussions,
    resolvedDiscussions,
    unresolvedDiscussions,
    totalDiscussions,
    discussions,
    pipeline: pipeline
  } satisfies GitlabMergeRequest;
};



