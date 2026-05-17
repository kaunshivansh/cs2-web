import type { Team } from '../../gameplay/match/MatchRules.ts';

export interface TeamVisualPalette {
  gloveColor: number;
  gloveDarkColor: number;
  sleeveColor: number;
  sleeveDarkColor: number;
  uniformColor: number;
  vestColor: number;
  vestDetailColor: number;
  helmetColor: number;
  skinColor: number;
  visorColor: number;
  badgeColor: number;
}

const TEAM_VISUALS: Record<Team, TeamVisualPalette> = {
  CT: {
    gloveColor: 0x3d6b96,
    gloveDarkColor: 0x18202a,
    sleeveColor: 0x3a5f84,
    sleeveDarkColor: 0x2a4055,
    uniformColor: 0x3a5f84,
    vestColor: 0x1c2e3c,
    vestDetailColor: 0x263848,
    helmetColor: 0x182430,
    skinColor: 0xd4c0a8,
    visorColor: 0x1a3348,
    badgeColor: 0x4a8fc0,
  },
  T: {
    gloveColor: 0x8a4a30,
    gloveDarkColor: 0x3c2010,
    sleeveColor: 0x8a4a30,
    sleeveDarkColor: 0x5e3424,
    uniformColor: 0x8a4a30,
    vestColor: 0x3c1e14,
    vestDetailColor: 0x4e2818,
    helmetColor: 0x3c2010,
    skinColor: 0xc8a88a,
    visorColor: 0x281408,
    badgeColor: 0xd1844f,
  },
};

export function getTeamVisualPalette(team: Team): TeamVisualPalette {
  return { ...TEAM_VISUALS[team] };
}
