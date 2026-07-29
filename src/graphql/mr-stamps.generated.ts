import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type MergeRequestStampFieldsFragment = { readonly id: string, readonly iid: string, readonly updatedAt: string, readonly state: Types.MergeRequestState, readonly detailedMergeStatus: Types.DetailedMergeStatus | null, readonly diffHeadSha: string | null, readonly approvedBy: { readonly nodes: ReadonlyArray<{ readonly id: any } | null> | null } | null, readonly headPipeline: { readonly iid: string, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly name: string | null, readonly status: Types.CiJobStatus | null } | null> | null } | null } | null };

export type MrStampsQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  state: Types.InputMaybe<Types.MergeRequestState>;
  first: Types.Scalars['Int']['input'];
  after: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type MrStampsQuery = { readonly project: { readonly id: string, readonly mergeRequests: { readonly pageInfo: { readonly hasNextPage: boolean, readonly endCursor: string | null }, readonly nodes: ReadonlyArray<{ readonly id: string, readonly iid: string, readonly updatedAt: string, readonly state: Types.MergeRequestState, readonly detailedMergeStatus: Types.DetailedMergeStatus | null, readonly diffHeadSha: string | null, readonly approvedBy: { readonly nodes: ReadonlyArray<{ readonly id: any } | null> | null } | null, readonly headPipeline: { readonly iid: string, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly name: string | null, readonly status: Types.CiJobStatus | null } | null> | null } | null } | null } | null> | null } | null } | null };

export const MergeRequestStampFieldsFragmentDoc = gql`
    fragment MergeRequestStampFields on MergeRequest {
  id
  iid
  updatedAt
  state
  detailedMergeStatus
  diffHeadSha
  approvedBy {
    nodes {
      id
    }
  }
  headPipeline {
    iid
    jobs {
      nodes {
        name
        status
      }
    }
  }
}
    `;
export const MrStampsDocument = gql`
    query MrStamps($projectPath: ID!, $state: MergeRequestState, $first: Int!, $after: String) {
  project(fullPath: $projectPath) {
    id
    mergeRequests(state: $state, first: $first, sort: UPDATED_ASC, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...MergeRequestStampFields
      }
    }
  }
}
    ${MergeRequestStampFieldsFragmentDoc}`;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    MrStamps(variables: MrStampsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MrStampsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MrStampsQuery>({ document: MrStampsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MrStamps', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;