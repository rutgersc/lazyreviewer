import { GraphQLClient } from "graphql-request"
import { getSdk, type MRsQuery, type ProjectMRsQuery, type CiJobStatus, type MergeRequestState } from "../generated/gitlab-sdk";
import { extractElabTicketsFromTitle } from "../jira/jiraService";
import type { PipelineJob, PipelineStage, Discussion, GitlabMergeRequest } from "../schemas/mergeRequestSchema";

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

export const getGitlabMrs = async (usernames: string[], state: MergeRequestState = 'opened'): Promise<GitlabMergeRequest[]> => {
  const endpoint = `https://git.elabnext.com/api/graphql`
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const sdk = getSdk(client)
  const data = await sdk.MRs({
    usernames: usernames,
    state: state,
    first: 7 // TODO: remove this or something
  });

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(process.cwd(), 'debug/gitlab-response-debug.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Gitlab response written to: ${outputPath}`);

  const res = data.users!.nodes!.flatMap(user => {

    const mappedMrs = user!
      .authoredMergeRequests!
      .nodes!
      .slice(0, 15)
      .map(mr => mapMrFromQuery(user!.username, mr));

    if (user!.authoredMergeRequests!.nodes!.length > mappedMrs.length) {
      console.error(`Fetched more MRs than needed ${user!.authoredMergeRequests!.nodes!.length} > ${mappedMrs.length}`)
    }

    return mappedMrs;
  });

  return res;
}

export const getGitlabMrsByProject = async (projectPath: string, state: MergeRequestState = 'opened'): Promise<GitlabMergeRequest[]> => {
  console.log(`[GitLab] Fetching MRs for project: "${projectPath}", state: ${state}`);

  const endpoint = `https://git.elabnext.com/api/graphql`
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  })

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

  const sdk = getSdk(client)
  const data = await sdk.ProjectMRs({
    projectPath: projectPath,
    state: state,
    first: 25
  });

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(process.cwd(), 'debug/gitlab-project-response-debug.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Gitlab project response written to: ${outputPath}`);

  const mrs = data.project?.mergeRequests?.nodes || [];
  return mrs.filter(mr => mr !== null).map(mr => mapProjectMr(mr!));
}

export const getJobTrace = async (projectId: string, jobId: string): Promise<string | null> => {
  const token = process.env.GITLAB_TOKEN;
  const encodedProjectId = encodeURIComponent(projectId);
  const realIdLol = jobId.split("/");
  const uhh = realIdLol[realIdLol.length-1];
  const url = `https://git.elabnext.com/api/v4/projects/${encodedProjectId}/jobs/${uhh}/trace`;

  try {
    const response = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token!
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch job trace: ${url} ${response.status} ${response.statusText}`);
      return null;
    }

    const traceData = await response.text();
    return traceData;
  } catch (error) {
    console.error('Failed to fetch job trace:', error);
    return null;
  }
}

export const getMrPipeline = async (projectPath: string, iid: string): Promise<{ stage: PipelineStage[] } | null> => {
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sdk = getSdk(client);

  try {
    const data = await sdk.MRPipeline({
      projectPath,
      iid
    });

    const mr = data.project?.mergeRequest;
    if (!mr?.headPipeline) {
      console.log(`[Pipeline] No pipeline found for MR ${iid} in ${projectPath}`);
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

    console.log(`[Pipeline] Fetched pipeline for MR ${iid}: ${pipeline.stage.length} stages`);
    return pipeline;
  } catch (error) {
    console.error(`[Pipeline] Failed to fetch pipeline for MR ${iid}:`, error);
    return null;
  }
}

export const fetchJobHistory = async (
  projectPath: string,
  jobName: string,
  limit: number = 50
): Promise<JobHistoryEntry[]> => {
  const endpoint = `https://git.elabnext.com/api/graphql`;
  const token = process.env.GITLAB_TOKEN;
  const client = new GraphQLClient(endpoint, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const sdk = getSdk(client);

  try {
    const data = await sdk.ProjectPipelinesJobHistory({
      projectPath,
      jobName,
      first: limit
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

    console.log(`[JobHistory] Fetched ${history.length} job history entries for "${jobName}" in ${projectPath}`);
    return history;
  } catch (error) {
    console.error(`[JobHistory] Failed to fetch job history for "${jobName}":`, error);
    return [];
  }
}


