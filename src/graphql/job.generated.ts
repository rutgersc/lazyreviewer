import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type JobTraceQueryVariables = Types.Exact<{
  projectId: Types.Scalars['ID']['input'];
  jobId: Types.Scalars['JobID']['input'];
}>;


export type JobTraceQuery = { readonly project: { readonly job: { readonly id: any | null, readonly name: string | null, readonly status: Types.CiJobStatus | null, readonly failureMessage: string | null, readonly trace: { readonly __typename: 'CiJobTrace', readonly htmlSummary: string } | null } | null } | null };


export const JobTraceDocument = gql`
    query JobTrace($projectId: ID!, $jobId: JobID!) {
  project(fullPath: $projectId) {
    job(id: $jobId) {
      id
      name
      status
      failureMessage
      trace {
        __typename
        htmlSummary
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    JobTrace(variables: JobTraceQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<JobTraceQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<JobTraceQuery>({ document: JobTraceDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'JobTrace', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;