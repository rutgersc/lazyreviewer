import { Atom, Result } from "@effect-atom/atom-react";
import { settingsUsersToUserSelections, settingsGroupsToUserGroups } from "../userselection/userSelection";
import { userSettingsAtom } from "../settings/settings-atom";
import { defaultUserSettings } from "../settings/user-filter-presets";

export const groupsAtom = Atom.make(get => {
  const settings = Result.match(get(userSettingsAtom), {
    onInitial: () => defaultUserSettings,
    onSuccess: ({ value }) => value,
    onFailure: () => defaultUserSettings,
  });
  return settingsGroupsToUserGroups(settings.userGroups, settings.users);
});

export const usersAtom = Atom.make(get => {
  const settings = Result.match(get(userSettingsAtom), {
    onInitial: () => defaultUserSettings,
    onSuccess: ({ value }) => value,
    onFailure: () => defaultUserSettings,
  });
  return settingsUsersToUserSelections(settings.users);
});
