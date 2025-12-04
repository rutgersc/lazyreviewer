import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type JobStatusQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type JobStatusQuery = { readonly jobs: { readonly nodes: ReadonlyArray<{ readonly name: string | null } | null> | null } | null };


export const JobStatusDocument = gql`
    query JobStatus {
  jobs {
    nodes {
      name
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    JobStatus(variables?: JobStatusQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<JobStatusQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<JobStatusQuery>({ document: JobStatusDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'JobStatus', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;