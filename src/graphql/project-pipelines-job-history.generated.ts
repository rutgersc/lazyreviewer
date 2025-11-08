import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type ProjectPipelinesJobHistoryQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  jobName: Types.Scalars['String']['input'];
  first: Types.Scalars['Int']['input'];
}>;


export type ProjectPipelinesJobHistoryQuery = { readonly project: { readonly id: string, readonly pipelines: { readonly nodes: ReadonlyArray<{ readonly id: string, readonly iid: string, readonly ref: string | null, readonly createdAt: string, readonly status: Types.PipelineStatusEnum, readonly source: string | null, readonly mergeRequest: { readonly iid: string, readonly title: string, readonly author: { readonly username: string } | null } | null, readonly job: { readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null } | null } | null> | null } | null } | null };


export const ProjectPipelinesJobHistoryDocument = gql`
    query ProjectPipelinesJobHistory($projectPath: ID!, $jobName: String!, $first: Int!) {
  project(fullPath: $projectPath) {
    id
    pipelines(first: $first) {
      nodes {
        id
        iid
        ref
        createdAt
        status
        source
        mergeRequest {
          iid
          title
          author {
            username
          }
        }
        job(name: $jobName) {
          id
          webPath
          name
          status
          failureMessage
          startedAt
          duration
        }
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    ProjectPipelinesJobHistory(variables: ProjectPipelinesJobHistoryQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ProjectPipelinesJobHistoryQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ProjectPipelinesJobHistoryQuery>({ document: ProjectPipelinesJobHistoryDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'ProjectPipelinesJobHistory', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;