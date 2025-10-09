export type RepositoryProvider = 'gitlab' | 'bitbucket';

export interface ParsedRepository {
  provider: RepositoryProvider;
  workspace: string;
  repo: string;
  fullPath: string;
}

export function parseRepositoryId(repositoryId: string): ParsedRepository {
  // Check if it has a provider prefix (e.g., "bitbucket:workspace/repo")
  if (repositoryId.startsWith('bitbucket:')) {
    const path = repositoryId.substring('bitbucket:'.length);
    const [workspace, repo] = path.split('/');

    if (!workspace || !repo) {
      throw new Error(`Invalid BitBucket repository ID: ${repositoryId}. Expected format: bitbucket:workspace/repo-slug`);
    }

    return {
      provider: 'bitbucket',
      workspace,
      repo,
      fullPath: path
    };
  }

  // Check if it has gitlab prefix (e.g., "gitlab:project/path")
  if (repositoryId.startsWith('gitlab:')) {
    const path = repositoryId.substring('gitlab:'.length);

    return {
      provider: 'gitlab',
      workspace: path.split('/')[0] || '',
      repo: path.split('/').slice(1).join('/') || '',
      fullPath: path
    };
  }

  // No prefix means it's a GitLab repository (backward compatibility)
  return {
    provider: 'gitlab',
    workspace: repositoryId.split('/')[0] || '',
    repo: repositoryId.split('/').slice(1).join('/') || '',
    fullPath: repositoryId
  };
}
