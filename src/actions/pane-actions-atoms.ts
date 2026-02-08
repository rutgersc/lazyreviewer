import { Atom } from "@effect-atom/atom-react";
import { activePaneAtom, activeModalAtom, infoPaneTabAtom } from "../ui/navigation-atom";
import { ActivePane } from "../userselection/userSelection";
import { mrActionsAtom } from "../components/MergeRequestPaneActions";
import { factsPaneActionsAtom } from "../components/FactsPaneActions";
import { repositoriesPaneActionsAtom } from "../components/RepositoriesPaneActions";
import { overviewActionsAtom } from "../components/OverviewActions";
import { jiraIssuesListActionsAtom } from "../components/JiraIssuesListActions";
import { pipelineJobsListActionsAtom } from "../components/PipelineJobsListActions";

// Re-export for convenience
export { mrActionsAtom } from "../components/MergeRequestPaneActions";
export { repositoriesPaneActionsAtom } from "../components/RepositoriesPaneActions";
export { overviewActionsAtom } from "../components/OverviewActions";

// Gets pane actions based on active pane (ignores modal state - for display purposes)
const paneActionsForDisplayAtom = Atom.make((get) => {
  const activePane = get(activePaneAtom);
  const infoPaneTab = get(infoPaneTabAtom);

  switch (activePane) {
    case ActivePane.Facts:
      return get(factsPaneActionsAtom);
    case ActivePane.MergeRequests:
      return get(mrActionsAtom);
    case ActivePane.UserSelection:
      return get(repositoriesPaneActionsAtom);
    case ActivePane.InfoPane:
      switch (infoPaneTab) {
        case 'overview':
          return get(overviewActionsAtom);
        case 'jira':
          return get(jiraIssuesListActionsAtom);
        case 'pipeline':
          return get(pipelineJobsListActionsAtom);
        case 'activity':
          return [];
        default:
          return [];
      }
    case ActivePane.Console:
      return [];
    default:
      return [];
  }
});

// For HelpModal display - always shows current pane's actions regardless of modal
export { paneActionsForDisplayAtom };

// Derived atom - selects active pane's actions (returns [] when modal open for keyboard handling)
export const activePaneActionsAtom = Atom.make((get) => {
  const activeModal = get(activeModalAtom);

  // No pane actions when modal is open (for keyboard handling)
  if (activeModal !== 'none') return [];

  return get(paneActionsForDisplayAtom);
});
