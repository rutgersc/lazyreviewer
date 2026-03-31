import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type PipelineFieldFragment = { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null, readonly finishedAt: string | null, readonly active: boolean } | null> | null } | null } | null> | null } | null };

export type GetJobStatusQueryVariables = Types.Exact<{
  fullPath: Types.Scalars['ID']['input'];
  jobId: Types.Scalars['JobID']['input'];
}>;


export type GetJobStatusQuery = { readonly project: { readonly job: { readonly status: Types.CiJobStatus | null, readonly finishedAt: string | null } | null } | null };

export type MrPipelineQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  iid: Types.Scalars['String']['input'];
}>;


export type MrPipelineQuery = { readonly project: { readonly mergeRequest: { readonly id: string, readonly iid: string, readonly state: Types.MergeRequestState, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null, readonly finishedAt: string | null, readonly active: boolean } | null> | null } | null } | null> | null } | null } | null } | null } | null };

export type MrPipelinesQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  iids: Types.InputMaybe<ReadonlyArray<Types.Scalars['String']['input']> | Types.Scalars['String']['input']>;
}>;


export type MrPipelinesQuery = { readonly project: { readonly mergeRequests: { readonly nodes: ReadonlyArray<{ readonly id: string, readonly iid: string, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null, readonly finishedAt: string | null, readonly active: boolean } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const PipelineFieldFragmentDoc = gql`
    fragment PipelineField on Pipeline {
  active
  iid
  stages {
    __typename
    nodes {
      id
      name
      jobs {
        nodes {
          id
          webPath
          name
          status
          failureMessage
          startedAt
          duration
          finishedAt
          active
        }
      }
      status
    }
  }
}
    `;
export const GetJobStatusDocument = gql`
    query GetJobStatus($fullPath: ID!, $jobId: JobID!) {
  project(fullPath: $fullPath) {
    job(id: $jobId) {
      status
      finishedAt
    }
  }
}
    `;
export const MrPipelineDocument = gql`
    query MRPipeline($projectPath: ID!, $iid: String!) {
  project(fullPath: $projectPath) {
    mergeRequest(iid: $iid) {
      id
      iid
      state
      headPipeline {
        ...PipelineField
      }
    }
  }
}
    ${PipelineFieldFragmentDoc}`;
export const MrPipelinesDocument = gql`
    query MRPipelines($projectPath: ID!, $iids: [String!]) {
  project(fullPath: $projectPath) {
    mergeRequests(iids: $iids) {
      nodes {
        id
        iid
        headPipeline {
          ...PipelineField
        }
      }
    }
  }
}
    ${PipelineFieldFragmentDoc}`;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GetJobStatus(variables: GetJobStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GetJobStatusQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetJobStatusQuery>({ document: GetJobStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GetJobStatus', 'query', variables);
    },
    MRPipeline(variables: MrPipelineQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MrPipelineQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MrPipelineQuery>({ document: MrPipelineDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MRPipeline', 'query', variables);
    },
    MRPipelines(variables: MrPipelinesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MrPipelinesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MrPipelinesQuery>({ document: MrPipelinesDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MRPipelines', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;