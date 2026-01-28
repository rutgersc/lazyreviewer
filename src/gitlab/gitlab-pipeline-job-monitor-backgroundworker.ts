import { Console, Effect, Option, Array, Either } from 'effect'
import { loadSettings, saveSettings } from '../settings/settings'
import { getMrPipeline, getSingleMrAsEvent } from './gitlab-graphql'
import { EventStorage } from '../events/events'
import type { CiJobStatus, MergeRequestState } from '../graphql/generated/gitlab-base-types'
import { sendSystemNotification } from '../notifications/notification-service'
import { loadJobLogInternal } from '../mergerequests/open-pipelinejob-log'
import { MrStateService } from '../mergerequests/mr-state-service'
import { MrGid } from '../gitlab/gitlab-schema'
import {
  isFetchNeeded,
  fetchRemote,
  getRemoteBranchCommit
} from '../git/git-effects'
import { decideFetchSingleMr } from '../mergerequests/decide-fetch-mrs'

const TERMINAL_STATUSES = ['CANCELED', 'FAILED', 'SKIPPED', 'SUCCESS'] as const
type TerminalJobStatus = typeof TERMINAL_STATUSES[number]

const TERMINAL_MR_STATUSES: MergeRequestState[] = ['merged', 'closed'] as const

const isJobDone = (status: CiJobStatus | null | undefined): status is TerminalJobStatus =>
  status !== null && status !== undefined &&
  (TERMINAL_STATUSES as readonly CiJobStatus[]).includes(status)

const isMrDone = (status: MergeRequestState | null | undefined): status is typeof TERMINAL_MR_STATUSES[number] =>
  status !== null && status !== undefined &&
  TERMINAL_MR_STATUSES.includes(status)

const FETCH_HEAD_MAX_AGE_MINUTES = 5;

const backgroundWorker =
  Effect.gen(function* () {
    const settings = loadSettings()
    const monitoredMrs = Object.entries(settings.monitoredMergeRequests)
      .filter(entry => {
        const key = entry[0];
        const value = entry[1];

        return key !== null && !value.completedReason
      })
      .map(entry => MrGid(entry[0]))

    if (monitoredMrs.length === 0) {
      return
    }

    const allMrsState = yield* MrStateService.get

    // Git-fetch unique repos once before processing MRs concurrently
    const uniqueRepos = [
      ...new Map(
        monitoredMrs
          .map(mrGid => allMrsState.mrsByGid.get(mrGid))
          .filter(mr => mr !== undefined)
          .map(mr => settings.repositoryPaths[mr.project.fullPath])
          .filter(repo => repo?.localPath && repo?.remoteName)
          .map(repo => [repo!.localPath, repo!] as const)
      ).values()
    ]

    for (const repo of uniqueRepos) {
      if (isFetchNeeded(repo.localPath!, FETCH_HEAD_MAX_AGE_MINUTES)) {
        yield* Console.log(`[PipelineJobMonitor] Fetching remote for ${repo.localPath}`)
        yield* fetchRemote(repo.localPath!, repo.remoteName!).pipe(
          Effect.catchAll(e => Console.log("[PipelineJobMonitor] Fetch failed, continuing with cached data:", e))
        )
      }
    }

    const monitorMr = (mrIid: MrGid) => Effect.gen(function* () {
      const mr = allMrsState.mrsByGid.get(mrIid);
      if (!mr) {
        return yield* Effect.fail({ type: 'mrNotAvailable' as const, message: `${mrIid} is not found in ${allMrsState.mrsByGid.keys().toArray().join(", ")}` });
      }

      if (isMrDone(mr.state)) {
        const existing = settings.monitoredMergeRequests[mr.id]
        settings.monitoredMergeRequests[mr.id] = {
          ...existing,
          jobStates: existing?.jobStates ?? {},
          completedReason: mr.state === 'merged' ? 'merged' : 'closed'
        }
        saveSettings(settings)
        return yield* Effect.succeed({ type: 'mrCompleted' as const, reason: mr.state })
      }

      const jobNamesToMonitor = settings.projectMonitoredJobs[mr.project.fullPath];
      if (!jobNamesToMonitor) {
        return yield* Effect.fail({ type: 'noJobNamesToMonitor' as const, message: `no jobs to monitor configured for ${mr.project.fullPath}. Look at pipelineJobImportance in the settings for job the available names. current structure: ${JSON.stringify(settings.projectMonitoredJobs)}` });
      }

      const existingMrPipelineState = settings.monitoredMergeRequests[mr.id];
      const repoConfig = settings.repositoryPaths[mr.project.fullPath]!;

      if (!repoConfig.localPath) {
        return yield* Effect.fail({ type: 'repoNotConfigured' as const, message: `the repo for ${mr.project.fullPath} is required in the settings in order to monitor the mr.` });
      }

      const { localPath, remoteName } = repoConfig;

      const currentCommit = getRemoteBranchCommit(localPath, remoteName, mr.sourcebranch);
      if (!currentCommit) {
        return yield* Effect.fail({ type: 'getRemoteBranchError' as const, message: `` });
      }

      const existingJobStates = !existingMrPipelineState
        ? undefined
        : Object.values(existingMrPipelineState.jobStates);

      const isExistingJobDone = existingJobStates && existingJobStates.every(state => isJobDone(state));
      const isSameCommitAsExisting = existingMrPipelineState?.lastCommit === currentCommit

      if (isExistingJobDone === true && isSameCommitAsExisting) {
        return yield* Effect.succeed({
          type: 'skipped' as const,
          message: `no commit change for - ${mr.title}` });
      }

      const mrWithPipeline = yield* getMrPipeline(mr.project.fullPath, mr.iid).pipe(
        Effect.mapError(e => ({ type: 'pipelineFetchError' as const, e }))
      )

      const headPipeline = mrWithPipeline?.headPipeline;

      if (!headPipeline) {
        return yield* Effect.fail({ type: 'mrHasNoPipeline' as const });
      }

      const isExistingPipelineOutOfDate = existingMrPipelineState
        ? existingMrPipelineState.pipelineIid === headPipeline.iid
        : true;

      const allJobs = headPipeline.stage.flatMap(stage => stage.jobs);
      const [missingJobNames, relevantJobs] = Array.partitionMap(
        jobNamesToMonitor,
        (jobName) =>
          Array.findFirst(allJobs, (job) => job.name === jobName).pipe(
            Option.map((job) => ({
              existingJobState: isExistingPipelineOutOfDate
                ? undefined // ignore existing jobstate bc it's no longer relevant
                : existingMrPipelineState?.jobStates[job.name],
              currentJob: job,
            })),
            Either.fromOption(() => jobName)
          )
      );

      if (missingJobNames.length > 0) {
        return yield* Effect.fail({ type: 'missingJobs' as const });
      }

      const isNewPipeline = !existingMrPipelineState ||
        existingMrPipelineState.pipelineIid !== headPipeline.iid;

      const inProgressJobs = relevantJobs.filter(({ existingJobState, currentJob }) => {
        return !isJobDone(existingJobState) && !isJobDone(currentJob.status)
      });

      const newlyFinishedJobs = relevantJobs.filter(({ existingJobState, currentJob }) => {
        return !isJobDone(existingJobState) && isJobDone(currentJob.status)
      });

      type Job = (typeof newlyFinishedJobs)[number]

      const jobCounts = relevantJobs.reduce(
        (acc, { currentJob }) => {
          if (currentJob.status === 'SUCCESS') return { ...acc, success: acc.success + 1 }
          if (currentJob.status === 'FAILED') return { ...acc, failed: acc.failed + 1 }
          return acc
        },
        { success: 0, failed: 0, total: relevantJobs.length }
      )

      const handleFailedJob = Effect.fn(function* ({ currentJob }: Job) {
        const countSummary = `(${jobCounts.success},${jobCounts.failed})/${jobCounts.total}`
        yield* sendSystemNotification({
          title: `${currentJob.name}: FAILED ${countSummary}`,
          body: `${mr.project.path}!${mr.iid}`
        }).pipe(Effect.fork)

        yield* loadJobLogInternal(
          { project: { path: mr.project.path, fullPath: mr.project.fullPath } },
          { id: currentJob.id, name: currentJob.name, localId: currentJob.localId })
      });

      const failedJobs = newlyFinishedJobs.filter(({ currentJob }) => currentJob.status === 'FAILED')
      for (const failedJob of failedJobs) {
        yield* handleFailedJob(failedJob);
      }

      const allJobsDone = inProgressJobs.length === 0 && newlyFinishedJobs.length > 0
      const allJobsSucceeded = jobCounts.failed === 0 && jobCounts.success === jobCounts.total
      if (allJobsDone && allJobsSucceeded) {
        yield* sendSystemNotification({
          title: `Pipeline SUCCESS`,
          body: `${mr.project.path}!${mr.iid} - all ${jobCounts.total} jobs passed`
        }).pipe(Effect.fork)
      }

      const shouldRefreshMr = isNewPipeline || newlyFinishedJobs.length > 0;
      if (shouldRefreshMr) {
        yield* decideFetchSingleMr(mr.project.fullPath, mr.iid).pipe(
          Effect.mapError(e => ({ type: 'mrRefreshError' as const, e }))
        );

        const reason = isNewPipeline ? 'new pipeline detected' : 'jobs finished';
        yield* Console.log(`[PipelineJobMonitor] Refreshed MR state for !${mr.title} (${reason})`);
      }

      settings.monitoredMergeRequests[mr.id] = {
        jobStates: Object.fromEntries(
          relevantJobs.map(({ currentJob }) => [
            currentJob.name,
            currentJob.status
          ])
        ),
        lastCommit: currentCommit,
        pipelineIid: headPipeline.iid
      };

      saveSettings(settings)

      return yield* Effect.succeed({ type: 'monitored' as const, message: `${headPipeline}` })
    });

    const pollResults = yield* Effect.validateAll(
      monitoredMrs,
      (mrKey) => monitorMr(mrKey), { concurrency: 3 })
      .pipe(
        Effect.either
      )

    yield* Either.match(pollResults, {
      onLeft: (error) => {
        return Console.log("[PipelineJobMonitor] `Failed to poll mr: ", error)
      },
      onRight: (polls) => Effect.gen(function* () {

        const nonSkipped = polls
          .filter(p => p.type !== 'skipped')
          .values()
          .toArray();

        if (nonSkipped.length > 0) {
          yield* Console.log("[PipelineJobMonitor] Poll complete:", nonSkipped)
        }
      })
    })

  })

export class PipelineJobMonitor extends Effect.Service<PipelineJobMonitor>()("PipelineJobMonitor", {
  accessors: true,
  scoped: Effect.gen(function* () {
    yield* Effect.sleep('10 seconds').pipe(
      Effect.andThen(
        backgroundWorker.pipe(
          Effect.catchAllCause((cause) => Console.log('[PipelineJobMonitor] Unhandled error during poll:', cause)),
          Effect.andThen(Effect.sleep('30 seconds')),
          Effect.forever
        )
      ),
      Effect.forkScoped
    );

    return {};
  })
}) {};