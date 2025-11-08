import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type ProjectsQueryVariables = Types.Exact<{
  fullPaths: Types.InputMaybe<ReadonlyArray<Types.Scalars['String']['input']> | Types.Scalars['String']['input']>;
}>;


export type ProjectsQuery = { readonly projects: { readonly count: number, readonly nodes: ReadonlyArray<{ readonly id: string, readonly name: string, readonly fullPath: string, readonly mergeRequests: { readonly nodes: ReadonlyArray<{ readonly name: string | null, readonly webPath: string } | null> | null } | null } | null> | null } | null };


export const ProjectsDocument = gql`
    query Projects($fullPaths: [String!]) {
  projects(fullPaths: $fullPaths) {
    count
    nodes {
      id
      name
      fullPath
      mergeRequests {
        nodes {
          name
          webPath
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
    Projects(variables?: ProjectsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ProjectsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ProjectsQuery>({ document: ProjectsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'Projects', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;