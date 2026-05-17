import type { Team } from '../../gameplay/match/MatchRules.ts';

export interface ScoreboardSourceRow {
  team: Team;
  name: string;
  hp: number;
  alive: boolean;
  weaponName: string;
  kills: number;
  deaths: number;
  money: number | null;
  hasBomb: boolean;
}

export interface ScoreboardViewRow extends ScoreboardSourceRow {
  prefix: string;
  displayHp: string;
  displayMoney: string;
}

export interface ScoreboardViewTeam {
  label: string;
  color: string;
  score: number;
  rows: ScoreboardViewRow[];
}

export interface ScoreboardView {
  round: number;
  maxRounds: number;
  teams: Record<Team, ScoreboardViewTeam>;
}

export interface BuildScoreboardInput {
  round: number;
  maxRounds: number;
  score: Record<Team, number>;
  playerName: string;
  playerTeam: Team;
  playerMoney: number;
  playerHasBomb: boolean;
  rows: ScoreboardSourceRow[];
}

export interface AmmoView {
  primary: string;
  reserve: string;
  reloading: boolean;
}

export function buildScoreboardView(input: BuildScoreboardInput): ScoreboardView {
  const byTeam = (team: Team): ScoreboardViewTeam => ({
    label: team === 'CT' ? 'COUNTER-TERRORISTS' : 'TERRORISTS',
    color: team === 'CT' ? '#87b9ff' : '#f0a366',
    score: input.score[team],
    rows: input.rows
      .filter((row) => row.team === team)
      .sort((a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills || a.name.localeCompare(b.name))
      .map((row) => ({
        ...row,
        prefix: row.hasBomb ? '◆ ' : '',
        displayHp: row.alive ? String(Math.max(0, Math.round(row.hp))) : 'DEAD',
        displayMoney: row.money === null ? '-' : `$${row.money}`,
      })),
  });

  return {
    round: input.round,
    maxRounds: input.maxRounds,
    teams: {
      CT: byTeam('CT'),
      T: byTeam('T'),
    },
  };
}

export function buildAmmoView(
  input:
    | { type: 'melee' }
    | { type: 'gun'; mag: number; reserve: number; reloading: boolean },
): AmmoView {
  if (input.type === 'melee') {
    return {
      primary: '—',
      reserve: '',
      reloading: false,
    };
  }

  return {
    primary: String(input.mag),
    reserve: `/ ${input.reserve}${input.reloading ? ' · RLD' : ''}`,
    reloading: input.reloading,
  };
}
