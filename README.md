# Lazyreviewer

A Terminal user interface (TUI) that provides an overview of pull requests and helps managing checked out branches/worktrees.

Features:
- pipeline status monitoring
- related (jira) ticket status and updates
- checkout PRs in worktree checkout
 
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