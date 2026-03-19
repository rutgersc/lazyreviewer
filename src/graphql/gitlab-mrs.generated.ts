import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
import { MergeRequestFieldsFragmentDoc } from './mrs.generated';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type GitlabMRsQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  iids: Types.InputMaybe<ReadonlyArray<Types.Scalars['String']['input']> | Types.Scalars['String']['input']>;
}>;


export type GitlabMRsQuery = { readonly project: { readonly id: string, readonly name: string, readonly path: string, readonly fullPath: string, readonly mergeRequests: { readonly nodes: ReadonlyArray<{ readonly id: string, readonly iid: string, readonly name: string | null, readonly title: string, readonly description: string | null, readonly webUrl: string | null, readonly sourceBranch: string, readonly targetBranch: string, readonly detailedMergeStatus: Types.DetailedMergeStatus | null, readonly createdAt: string, readonly updatedAt: string, readonly state: Types.MergeRequestState, readonly project: { readonly name: string, readonly path: string, readonly fullPath: string }, readonly author: { readonly name: string, readonly username: string, readonly avatarUrl: string | null } | null, readonly approvedBy: { readonly nodes: ReadonlyArray<{ readonly id: any, readonly name: string, readonly username: string } | null> | null } | null, readonly discussions: { readonly nodes: ReadonlyArray<{ readonly resolved: boolean, readonly resolvable: boolean, readonly id: any, readonly notes: { readonly nodes: ReadonlyArray<{ readonly __typename: 'Note', readonly id: any, readonly system: boolean, readonly body: string, readonly url: string | null, readonly createdAt: string, readonly resolvable: boolean, readonly resolved: boolean, readonly author: { readonly name: string, readonly username: string } | null, readonly position: { readonly filePath: string, readonly newLine: number | null, readonly oldLine: number | null, readonly oldPath: string | null } | null } | null> | null } } | null> | null }, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null } | null> | null } | null } | null> | null } | null } | null } | null> | null, readonly pageInfo: { readonly hasNextPage: boolean } } | null } | null };


export const GitlabMRsDocument = gql`
    query GitlabMRs($projectPath: ID!, $iids: [String!]) {
  project(fullPath: $projectPath) {
    id
    name
    path
    fullPath
    mergeRequests(iids: $iids) {
      nodes {
        ...MergeRequestFields
      }
      pageInfo {
        hasNextPage
      }
    }
  }
}
    ${MergeRequestFieldsFragmentDoc}`;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    GitlabMRs(variables: GitlabMRsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<GitlabMRsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GitlabMRsQuery>({ document: GitlabMRsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'GitlabMRs', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;