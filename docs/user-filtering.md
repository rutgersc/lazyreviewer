# User Filtering

## Concepts

### User

A person who authors merge requests, identified across providers.

- **userId** — internal key used throughout the app
- **gitlab** — GitLab username (optional)
- **bitbucket** — Bitbucket username (optional)
- **jira** — Jira display name or account ID (optional)

### Group

A named collection of users and/or other groups. Groups can nest — "Florence" might contain "Florence FE" and "Florence BE", each of which contains individual users. Groups serve double duty: they define team structure and act as saved filters that can be quickly applied.

- **id** — unique identifier for the group
- **name** — display name
- **users** — list of user IDs that belong to this group
- **groups** — list of group IDs nested within this group

### Active Filter

The currently applied filter that determines which merge requests are visible. When both fields are empty, all merge requests are shown. When non-empty, only merge requests authored by a matching user are displayed.

- **userFilterUsernames** — individual user IDs to include
- **userFilterGroupIds** — group IDs to include (resolved to their member users)

## Storage

Users and groups live in `lazyreviewer-settings-users.json`. This keeps team/identity data isolated from application preferences.

The active filter lives in `lazyreviewer-settings.json` alongside other app state.

## Relations

```
Group ──contains──▶ User (directly)
Group ──contains──▶ Group (nested, resolved recursively)

Active Filter ──references──▶ User (by username)
Active Filter ──references──▶ Group (by group ID)

Applying a Group ──writes──▶ Active Filter
Saving from Filter ──creates──▶ Group
```

## UI Operations

### Viewing / Editing the Active Filter

Open with `f` → `f`. Two-column toggle interface: groups on the left, individual users on the right. Space toggles items. Confirming writes the new filter.

### Applying a Group

Open with `/` (or `f` → `p`). Type to fuzzy-search groups by name. Arrow keys navigate, Enter applies the highlighted group as the active filter.

### Saving Current Filter as Group

From the group picker, press `Ctrl+n`. Type a name and press Enter. The current active filter is captured as a new group.

### Deleting a Group

From the group picker, highlight a group and press `Ctrl+x` or Delete.

### Restoring Previous Filter

Press `b` in the MR pane to revert to the filter state before the last change.
