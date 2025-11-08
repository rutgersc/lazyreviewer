import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type MrPipelineQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  iid: Types.Scalars['String']['input'];
}>;


export type MrPipelineQuery = { readonly project: { readonly mergeRequest: { readonly id: string, readonly iid: string, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null } | null> | null } | null } | null> | null } | null } | null } | null } | null };


export const MrPipelineDocument = gql`
    query MRPipeline($projectPath: ID!, $iid: String!) {
  project(fullPath: $projectPath) {
    mergeRequest(iid: $iid) {
      id
      iid
      headPipeline {
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
              }
            }
            status
          }
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
    MRPipeline(variables: MrPipelineQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MrPipelineQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MrPipelineQuery>({ document: MrPipelineDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MRPipeline', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;