import { GraphQLClient } from "graphql-request"
import { getSdk, type MRsQuery, type ProjectMRsQuery, type CiJobStatus, type MergeRequestState } from "../generated/gitlab-sdk";
import { extractElabTicketsFromTitle } from "../jira/jiraService";
import type { PipelineJob, PipelineStage, Discussion, GitlabMergeRequest } from "../schemas/mergeRequestSchema";
import { Data, Effect, Console } from "effect";
import fs from "fs";
import path from "path";

export type {
  PipelineJob,
  PipelineStage,
  DiscussionNote,
  Discussion,
  GitlabMergeRequest
} from "../schemas/mergeRequestSchema"

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
            startedAt: job?.startedAt || ''
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
  const sdk = getSdk(client);
  return sdk;
};


export const getGitlabMrs = Effect.fn("getGitlabMrs")(function* (usernames: string[], state: MergeRequestState = 'opened') {
  const sdk = getElabGitSdk();
  const data = yield* Effect.tryPromise({
    try: () => sdk.MRs({
      usernames: usernames,
      state: state,
      first: 7 // TODO: remove this or something
    }),
    catch: cause => new FetchGitlabMrsError({ cause })
  });

  const outputPath = path.join(process.cwd(), 'debug/gitlab-response-debug.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  yield* Console.log(`Gitlab response written to: ${outputPath}`);

  const res = data.users!.nodes!.flatMap(user => {
    const mappedMrs = user!
      .authoredMergeRequests!
      .nodes!
      .slice(0, 15)
      .map(mr => mapMrFromQuery(user!.username, mr));

    return mappedMrs;
  });

  // Log warnings for over-fetched MRs
  for (const user of data.users!.nodes!) {
    if (user!.authoredMergeRequests!.nodes!.length > 15) {
      yield* Console.error(`Fetched more MRs than needed ${user!.authoredMergeRequests!.nodes!.length} > 15`);
    }
  }

  return res;
})

export class FetchGitlabProjectMrsError extends Data.TaggedError("FetchGitlabProjectMrsError")<{
  cause: unknown;
}> { }

const getGitElabnextSdk = () => {
  const endpoint = `https://git.elabnext.com/api/graphql`
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  })

  return getSdk(client);
}

export const getGitlabMrsByProject = Effect.fn("getGitlabMrsByProject")(function* (projectPath: string, state: MergeRequestState = 'opened') {
  yield* Console.log(`[GitLab] Fetching MRs for project: "${projectPath}", state: ${state}`);

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
              startedAt: job?.startedAt || ''
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

  const sdk = getGitElabnextSdk();
  const data = yield* Effect.tryPromise({
    try: () => sdk.ProjectMRs({
      projectPath: projectPath,
      state: state,
      first: 25
    }),
    catch: cause => new FetchGitlabProjectMrsError({ cause })
  });

  const outputPath = path.join(process.cwd(), 'debug/gitlab-project-response-debug.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  yield* Console.log(`Gitlab project response written to: ${outputPath}`);

  const mrs = data.project?.mergeRequests?.nodes || [];
  return mrs.filter(mr => mr !== null).map(mr => mapProjectMr(mr!));
})

export class FetchJobTraceError extends Data.TaggedError("FetchJobTraceError")<{
  cause: unknown;
}> { }

export const getJobTrace = Effect.fn("getJobTrace")(function* (projectId: string, jobId: string) {
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

export class FetchMrPipelineError extends Data.TaggedError("FetchMrPipelineError")<{
  cause: unknown;
}> { }

export const getMrPipeline = Effect.fn("getMrPipeline")(function* (projectPath: string, iid: string) {
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sdk = getSdk(client);

  const data = yield* Effect.tryPromise({
    try: () => sdk.MRPipeline({
      projectPath,
      iid
    }),
    catch: cause => new FetchMrPipelineError({ cause })
  });

  const mr = data.project?.mergeRequest;
  if (!mr?.headPipeline) {
    yield* Console.log(`[Pipeline] No pipeline found for MR ${iid} in ${projectPath}`);
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
            startedAt: job?.startedAt || ''
          } satisfies PipelineJob))
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
          || []
      })) || []
  };

  yield* Console.log(`[Pipeline] Fetched pipeline for MR ${iid}: ${pipeline.stage.length} stages`);
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
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    responseMiddleware: m => {

      return m;
    }
  });

  const sdk = getSdk(client);

  const data = yield* Effect.tryPromise({
    try: () => sdk.ProjectPipelinesJobHistory({
      projectPath,
      jobName,
      first: limit
    }),
    catch: cause => new FetchJobHistoryError({ cause })
  });

  const pipelines = data.project?.pipelines?.nodes || [];

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

  yield* Console.log(`[JobHistory] Fetched ${history.length} job history entries for "${jobName}" in ${projectPath}`);
  return history;
})


