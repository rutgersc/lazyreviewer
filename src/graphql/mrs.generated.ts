import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type MergeRequestFieldsFragment = { readonly id: string, readonly iid: string, readonly name: string | null, readonly title: string, readonly webUrl: string | null, readonly sourceBranch: string, readonly targetBranch: string, readonly detailedMergeStatus: Types.DetailedMergeStatus | null, readonly createdAt: string, readonly updatedAt: string, readonly state: Types.MergeRequestState, readonly project: { readonly name: string, readonly path: string, readonly fullPath: string }, readonly author: { readonly name: string, readonly username: string, readonly avatarUrl: string | null } | null, readonly approvedBy: { readonly nodes: ReadonlyArray<{ readonly id: any, readonly name: string, readonly username: string } | null> | null } | null, readonly discussions: { readonly nodes: ReadonlyArray<{ readonly resolved: boolean, readonly resolvable: boolean, readonly id: any, readonly notes: { readonly nodes: ReadonlyArray<{ readonly __typename: 'Note', readonly id: any, readonly system: boolean, readonly body: string, readonly url: string | null, readonly createdAt: string, readonly resolvable: boolean, readonly resolved: boolean, readonly author: { readonly name: string } | null, readonly position: { readonly filePath: string, readonly newLine: number | null, readonly oldLine: number | null, readonly oldPath: string | null } | null } | null> | null } } | null> | null }, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null } | null> | null } | null } | null> | null } | null } | null };

export type MRsQueryVariables = Types.Exact<{
  usernames: Types.InputMaybe<ReadonlyArray<Types.Scalars['String']['input']> | Types.Scalars['String']['input']>;
  state: Types.InputMaybe<Types.MergeRequestState>;
  first: Types.Scalars['Int']['input'];
}>;


export type MRsQuery = { readonly users: { readonly count: number, readonly nodes: ReadonlyArray<{ readonly username: string, readonly authoredMergeRequests: { readonly count: number, readonly pageInfo: { readonly hasNextPage: boolean }, readonly nodes: ReadonlyArray<{ readonly id: string, readonly iid: string, readonly name: string | null, readonly title: string, readonly webUrl: string | null, readonly sourceBranch: string, readonly targetBranch: string, readonly detailedMergeStatus: Types.DetailedMergeStatus | null, readonly createdAt: string, readonly updatedAt: string, readonly state: Types.MergeRequestState, readonly project: { readonly name: string, readonly path: string, readonly fullPath: string }, readonly author: { readonly name: string, readonly username: string, readonly avatarUrl: string | null } | null, readonly approvedBy: { readonly nodes: ReadonlyArray<{ readonly id: any, readonly name: string, readonly username: string } | null> | null } | null, readonly discussions: { readonly nodes: ReadonlyArray<{ readonly resolved: boolean, readonly resolvable: boolean, readonly id: any, readonly notes: { readonly nodes: ReadonlyArray<{ readonly __typename: 'Note', readonly id: any, readonly system: boolean, readonly body: string, readonly url: string | null, readonly createdAt: string, readonly resolvable: boolean, readonly resolved: boolean, readonly author: { readonly name: string } | null, readonly position: { readonly filePath: string, readonly newLine: number | null, readonly oldLine: number | null, readonly oldPath: string | null } | null } | null> | null } } | null> | null }, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null> | null } | null };

export const MergeRequestFieldsFragmentDoc = gql`
    fragment MergeRequestFields on MergeRequest {
  id
  iid
  name
  title
  webUrl
  sourceBranch
  targetBranch
  detailedMergeStatus
  project {
    name
    path
    fullPath
  }
  author {
    name
    username
    avatarUrl
  }
  createdAt
  updatedAt
  state
  approvedBy {
    nodes {
      id
      name
      username
    }
  }
  discussions {
    nodes {
      resolved
      resolvable
      id
      notes {
        nodes {
          id
          __typename
          system
          body
          author {
            name
          }
          url
          createdAt
          resolvable
          resolved
          position {
            filePath
            newLine
            oldLine
            oldPath
          }
        }
      }
    }
  }
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
    `;
export const MRsDocument = gql`
    query MRs($usernames: [String!], $state: MergeRequestState, $first: Int!) {
  users(usernames: $usernames, first: $first) {
    count
    nodes {
      username
      authoredMergeRequests(state: $state, first: 10) {
        count
        pageInfo {
          hasNextPage
        }
        nodes {
          ...MergeRequestFields
        }
      }
    }
  }
}
    ${MergeRequestFieldsFragmentDoc}`;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    MRs(variables: MRsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MRsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MRsQuery>({ document: MRsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MRs', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;