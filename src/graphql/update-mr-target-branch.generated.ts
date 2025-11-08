import type * as Types from './generated/gitlab-base-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type UpdateMrTargetBranchMutationVariables = Types.Exact<{
  projectPath: Types.Scalars['ID']['input'];
  iid: Types.Scalars['String']['input'];
  targetBranch: Types.Scalars['String']['input'];
}>;


export type UpdateMrTargetBranchMutation = { readonly mergeRequestUpdate: { readonly errors: ReadonlyArray<string>, readonly mergeRequest: { readonly id: string, readonly iid: string, readonly targetBranch: string } | null } | null };


export const UpdateMrTargetBranchDocument = gql`
    mutation UpdateMRTargetBranch($projectPath: ID!, $iid: String!, $targetBranch: String!) {
  mergeRequestUpdate(
    input: {projectPath: $projectPath, iid: $iid, targetBranch: $targetBranch}
  ) {
    mergeRequest {
      id
      iid
      targetBranch
    }
    errors
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    UpdateMRTargetBranch(variables: UpdateMrTargetBranchMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<UpdateMrTargetBranchMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<UpdateMrTargetBranchMutation>({ document: UpdateMrTargetBranchDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'UpdateMRTargetBranch', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;