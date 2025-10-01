# Lazygitlab

### authorize build time calls

This project uses graphql codegen `bun run codegen` and so requires a token.

Find-and-replace in all files `glpat-TODO` with your actual token.

### authorize runtime calls

Create a `.env` file in the root of this repo:

``` .env
# https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_API_TOKEN_BASE64=<insert base64 encoded token>
GITLAB_TOKEN=<replace with glpat>
```

Then install bun and run:

```bash
bun install
```

To run:

```bash
bun start
```
