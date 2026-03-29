import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type ProjectQueryVariables = Types.Exact<{
  fullPath: Types.Scalars['ID']['input'];
  authorUsername?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type ProjectQuery = { readonly project: { readonly mergeRequests: { readonly nodes: ReadonlyArray<{ readonly webPath: string, readonly name: string | null } | null> | null } | null } | null };


export const ProjectDocument = gql`
    query Project($fullPath: ID!, $authorUsername: String) {
  project(fullPath: $fullPath) {
    mergeRequests(authorUsername: $authorUsername) {
      nodes {
        webPath
        name
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    Project(variables: ProjectQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ProjectQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ProjectQuery>({ document: ProjectDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'Project', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;