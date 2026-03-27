# Lazyreviewer

### authorize build time calls

This project uses graphql codegen `bun run codegen` and so requires a token.

Find-and-replace in all files `glpat-TODO` with your actual token.

### authorize runtime calls

Create a `.env` file in the root of this repo:

``` .env
# Jira API token
# Get token from: https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_EMAIL=your.email@domain.com
JIRA_API_TOKEN=your-jira-api-token-here

# BitBucket API token (separate from Jira)
# Get token from: https://id.atlassian.com/manage-profile/security/api-tokens
BITBUCKET_EMAIL=your.email@domain.com
BITBUCKET_API_TOKEN=your-bitbucket-api-token-here

# GitLab personal access token
GITLAB_TOKEN=glpat-your-gitlab-token-here
```

Then install bun and run:

```bash
bun install
```

To run:

```bash
bun start
```

### Bitbucket Support

Lazygitlab supports both GitLab and Bitbucket repositories. To use a Bitbucket repository:

1. Configure your Bitbucket credentials in `.env` (see above)
2. Add a Bitbucket repository using the format: `bitbucket:workspace/repo-slug`

Example in `src/data/usersAndGroups.ts`:
```typescript
const myRepo = { type: 'repositoryId', id: 'bitbucket:myworkspace/my-repo' } satisfies RepositoryId;
```

**Current Limitations:**
- Bitbucket Pipelines CI/CD integration is not yet implemented
- Pipeline status, build jobs, and job logs are not available for Bitbucket repos
- All other features (PRs, comments, approvals, Jira integration) work normally
