import { Atom } from "@effect-atom/atom-react";
import { ActivePane } from "../userselection/userSelection";

export type InfoPaneTab = 'overview' | 'jira' | 'pipeline' | 'activity';

export type ActiveModal =
  | 'none'
  | 'mrSort'
  | 'gitSwitch'
  | 'help'
  | 'jobHistory'
  | 'jobHistoryInput'
  | 'eventLog'
  | 'jiraBoard'
  | 'monitoredMrs'
  | 'notifications'
  | 'fChooser'
  | 'userFilter'
  | 'mrState'
  | 'repoFilter'
  | 'onboarding';

export const activePaneAtom = Atom.make<ActivePane>(ActivePane.MergeRequests);
export const activeModalAtom = Atom.make<ActiveModal>('none');
export const infoPaneTabAtom = Atom.make<InfoPaneTab>('overview');

const INFO_PANE_TABS: InfoPaneTab[] = ['overview', 'jira', 'pipeline', 'activity'];

export const cycleInfoPaneTabAtom = Atom.writable(
  (get) => get(infoPaneTabAtom),
  (ctx, direction: 'next' | 'prev') => {
    const currentTab = ctx.get(infoPaneTabAtom);
    const currentIndex = INFO_PANE_TABS.indexOf(currentTab);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % INFO_PANE_TABS.length
      : (currentIndex - 1 + INFO_PANE_TABS.length) % INFO_PANE_TABS.length;
    const newTab = INFO_PANE_TABS[newIndex] ?? 'overview';
    ctx.set(infoPaneTabAtom, newTab);
  }
);

export const nowAtom = Atom.readable((get) => {
  const intervalId = setInterval(() => {
    get.setSelf(new Date());
  }, 60_000);
  get.addFinalizer(() => clearInterval(intervalId));
  return new Date();
});
