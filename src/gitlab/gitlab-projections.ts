import type { ProjectMRsQuery } from "../graphql/project-mrs.generated";
import { extractElabTicketsFromTitle } from "../jira/jira-service";
import type { PipelineJob, PipelineStage, Discussion, GitlabMergeRequest, JobHistoryEntry } from "./gitlab-schema";
import type { GitlabUserMergeRequestsFetchedEvent, GitlabprojectMergeRequestsFetchedEvent, GitlabSingleMrFetchedEvent, GitlabJobTraceFetchedEvent, GitlabPipelineFetchedEvent, GitlabJobHistoryFetchedEvent } from "../events/gitlab-events";
import type { MergeRequestFieldsFragment, MRsQuery } from "../graphql/mrs.generated";

export const mapMrFragment = (
  mr: MergeRequestFieldsFragment)
  : GitlabMergeRequest => {

  if (!mr) {
    throw Error("mr null");
  }

  if (!mr.author?.username) {
    throw Error("mr username null");
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
    author: mr.author.username,
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

export const projectGitlabUserMrsFetchedEvent = (event: GitlabUserMergeRequestsFetchedEvent): GitlabMergeRequest[] => {
  const res = event.mrs.users!.nodes!.flatMap(user => {
    const mappedMrs = user!
      .authoredMergeRequests!
      .nodes!
      .filter((mr): mr is NonNullable<typeof mr> => mr !== null)
      .map(mr => mapMrFragment(mr));

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
