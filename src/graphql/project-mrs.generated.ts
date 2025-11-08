import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type ProjectMRsQueryVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  state: Types.InputMaybe<Types.MergeRequestState>;
  first: Types.Scalars['Int']['input'];
}>;


export type ProjectMRsQuery = { readonly project: { readonly id: string, readonly name: string, readonly path: string, readonly fullPath: string, readonly mergeRequests: { readonly count: number, readonly pageInfo: { readonly hasNextPage: boolean }, readonly nodes: ReadonlyArray<{ readonly id: string, readonly iid: string, readonly title: string, readonly webUrl: string | null, readonly sourceBranch: string, readonly targetBranch: string, readonly createdAt: string, readonly updatedAt: string, readonly state: Types.MergeRequestState, readonly project: { readonly name: string, readonly path: string, readonly fullPath: string }, readonly author: { readonly name: string, readonly username: string, readonly avatarUrl: string | null } | null, readonly approvedBy: { readonly nodes: ReadonlyArray<{ readonly id: any, readonly name: string, readonly username: string } | null> | null } | null, readonly discussions: { readonly nodes: ReadonlyArray<{ readonly resolved: boolean, readonly resolvable: boolean, readonly id: any, readonly notes: { readonly nodes: ReadonlyArray<{ readonly __typename: 'Note', readonly id: any, readonly body: string, readonly createdAt: string, readonly resolvable: boolean, readonly resolved: boolean, readonly author: { readonly name: string } | null, readonly position: { readonly filePath: string, readonly newLine: number | null, readonly oldLine: number | null, readonly oldPath: string | null } | null } | null> | null } } | null> | null }, readonly headPipeline: { readonly active: boolean, readonly iid: string, readonly stages: { readonly __typename: 'CiStageConnection', readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string | null, readonly status: string | null, readonly jobs: { readonly nodes: ReadonlyArray<{ readonly id: any | null, readonly webPath: string | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly startedAt: string | null, readonly duration: number | null } | null> | null } | null } | null> | null } | null } | null } | null> | null } | null } | null };


export const ProjectMRsDocument = gql`
    query ProjectMRs($projectPath: ID!, $state: MergeRequestState, $first: Int!) {
  project(fullPath: $projectPath) {
    id
    name
    path
    fullPath
    mergeRequests(state: $state, first: $first, sort: UPDATED_DESC) {
      count
      pageInfo {
        hasNextPage
      }
      nodes {
        id
        iid
        title
        webUrl
        sourceBranch
        targetBranch
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
                body
                author {
                  name
                }
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
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    ProjectMRs(variables: ProjectMRsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ProjectMRsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ProjectMRsQuery>({ document: ProjectMRsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'ProjectMRs', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;