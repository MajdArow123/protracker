import type { SeasonRosterStint, SeasonTeamRef } from '../types';

export interface TeamRosterGroup {
  team: SeasonTeamRef;
  stints: SeasonRosterStint[];
}

// Groups a season's roster stints under its participating teams, in the season's team
// order, so a participating team with no stints still renders as an honest empty group
// (never silently dropped). Stints whose team is not in the participation list cannot
// be created through the API, but if one ever arrives on the wire it must not be lost:
// it gets a trailing group built from the stint's own team fields. Within a group,
// stints sort by player name, then join date (a player's stints read chronologically).
export function groupStintsByTeam(teams: SeasonTeamRef[], stints: SeasonRosterStint[]): TeamRosterGroup[] {
  const groups: TeamRosterGroup[] = teams.map(team => ({ team, stints: [] }));
  const byTeamId = new Map(groups.map(g => [g.team.id, g]));

  for (const stint of stints) {
    let group = byTeamId.get(stint.teamId);
    if (!group) {
      group = { team: { id: stint.teamId, name: stint.teamName }, stints: [] };
      byTeamId.set(stint.teamId, group);
      groups.push(group);
    }
    group.stints.push(stint);
  }

  for (const group of groups) {
    group.stints.sort((a, b) =>
      a.playerName.localeCompare(b.playerName) || a.joinedAt.localeCompare(b.joinedAt));
  }
  return groups;
}
