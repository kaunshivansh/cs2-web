export type Team = 'CT' | 'T';
export type MatchPhase = 'freeze' | 'live' | 'planted' | 'end' | 'halftime' | 'overtime' | 'complete';
export type RoundWinReason = 'elimination' | 'time' | 'bomb_defused' | 'bomb_detonated' | 'surrender';

export interface MatchPlayerSlot {
  id: string;
  name: string;
  team: Team;
  isHuman: boolean;
  hasBomb: boolean;
  kills: number;
  deaths: number;
  assists: number;
  mvpScore: number;
}

export interface TeamEconomyState {
  bank: Record<string, number>;
  lossStreak: number;
  nextRoundAward: number;
}

export interface RoundHistoryEntry {
  round: number;
  winner: Team;
  reason: RoundWinReason;
  mvpPlayerId?: string;
}

export interface TacticalMatchState {
  phase: MatchPhase;
  round: number;
  maxRounds: number;
  freezeTime: number;
  roundTime: number;
  bombTime: number;
  overtimeEnabled: boolean;
  score: Record<Team, number>;
  rosters: Record<Team, MatchPlayerSlot[]>;
  economy: Record<Team, TeamEconomyState>;
  roundHistory: RoundHistoryEntry[];
}

export interface CreateMatchOptions {
  playerName: string;
  playerTeam: Team;
  maxRounds?: number;
  freezeTime?: number;
  roundTime?: number;
  bombTime?: number;
  overtimeEnabled?: boolean;
}

export interface RoundResult {
  winner: Team;
  reason: RoundWinReason;
  mvpPlayerId?: string;
}

const STARTING_MONEY = 800;
const WIN_AWARD = 3250;
const LOSS_BONUSES = [1400, 1900, 2400, 2900, 3400] as const;

export function oppositeTeam(team: Team): Team {
  return team === 'CT' ? 'T' : 'CT';
}

export function calculateLossBonus(lossStreak: number): number {
  const index = Math.min(Math.max(1, Math.floor(lossStreak)), LOSS_BONUSES.length) - 1;
  return LOSS_BONUSES[index];
}

export function clampMoney(value: number): number {
  return Math.min(16000, Math.max(0, Math.round(value)));
}

export function shouldSwapSides(completedRound: number, maxRounds: number): boolean {
  return completedRound === Math.floor(maxRounds / 2);
}

export function createInitialMatchState(options: CreateMatchOptions): TacticalMatchState {
  const maxRounds = options.maxRounds ?? 24;
  const rosters = createRosters(options.playerName, options.playerTeam);

  return {
    phase: 'freeze',
    round: 1,
    maxRounds,
    freezeTime: options.freezeTime ?? 12,
    roundTime: options.roundTime ?? 115,
    bombTime: options.bombTime ?? 40,
    overtimeEnabled: options.overtimeEnabled ?? true,
    score: { CT: 0, T: 0 },
    rosters,
    economy: {
      CT: createEconomy(rosters.CT),
      T: createEconomy(rosters.T),
    },
    roundHistory: [],
  };
}

export function createRosters(playerName: string, playerTeam: Team): Record<Team, MatchPlayerSlot[]> {
  const makeSlot = (team: Team, index: number): MatchPlayerSlot => ({
    id: `${team.toLowerCase()}-${index}`,
    name: `${team}${index}`,
    team,
    isHuman: false,
    hasBomb: false,
    kills: 0,
    deaths: 0,
    assists: 0,
    mvpScore: 0,
  });

  const rosters: Record<Team, MatchPlayerSlot[]> = {
    CT: Array.from({ length: 5 }, (_, index) => makeSlot('CT', index + 1)),
    T: Array.from({ length: 5 }, (_, index) => makeSlot('T', index + 1)),
  };

  const humanId = playerTeam === 'CT' ? 'ct-player' : 't-player';
  rosters[playerTeam][0] = {
    ...rosters[playerTeam][0],
    id: humanId,
    name: playerName || 'Player',
    isHuman: true,
  };

  rosters.T[0] = { ...rosters.T[0], hasBomb: true };
  return rosters;
}

export function resolveRound(state: TacticalMatchState, result: RoundResult): TacticalMatchState {
  const loser = oppositeTeam(result.winner);
  const next = cloneMatchState(state);

  next.phase = 'end';
  next.score[result.winner] += 1;
  next.roundHistory.push({
    round: state.round,
    winner: result.winner,
    reason: result.reason,
    mvpPlayerId: result.mvpPlayerId,
  });

  awardTeam(next.economy[result.winner], WIN_AWARD);
  next.economy[result.winner].lossStreak = 0;
  next.economy[result.winner].nextRoundAward = WIN_AWARD;

  next.economy[loser].lossStreak += 1;
  next.economy[loser].nextRoundAward = calculateLossBonus(next.economy[loser].lossStreak);
  awardTeam(next.economy[loser], next.economy[loser].nextRoundAward);

  if (result.mvpPlayerId) {
    const mvp = [...next.rosters.CT, ...next.rosters.T].find((player) => player.id === result.mvpPlayerId);
    if (mvp) mvp.mvpScore += 1;
  }

  return next;
}

export function advanceRound(state: TacticalMatchState): TacticalMatchState {
  const next = cloneMatchState(state);

  if (isMatchPointReached(next)) {
    next.phase = next.score.CT === next.score.T && next.overtimeEnabled ? 'overtime' : 'complete';
    return next;
  }

  if (shouldSwapSides(next.round, next.maxRounds)) swapSides(next);
  next.round += 1;
  next.phase = 'freeze';
  clearBombAssignments(next);
  next.rosters.T[0].hasBomb = true;
  return next;
}

function createEconomy(roster: MatchPlayerSlot[]): TeamEconomyState {
  return {
    bank: Object.fromEntries(roster.map((player) => [player.id, STARTING_MONEY])),
    lossStreak: 0,
    nextRoundAward: 0,
  };
}

function awardTeam(economy: TeamEconomyState, amount: number) {
  for (const playerId of Object.keys(economy.bank)) {
    economy.bank[playerId] = clampMoney(economy.bank[playerId] + amount);
  }
}

function cloneMatchState(state: TacticalMatchState): TacticalMatchState {
  return {
    ...state,
    score: { ...state.score },
    rosters: {
      CT: state.rosters.CT.map((player) => ({ ...player })),
      T: state.rosters.T.map((player) => ({ ...player })),
    },
    economy: {
      CT: { ...state.economy.CT, bank: { ...state.economy.CT.bank } },
      T: { ...state.economy.T, bank: { ...state.economy.T.bank } },
    },
    roundHistory: state.roundHistory.map((entry) => ({ ...entry })),
  };
}

function isMatchPointReached(state: TacticalMatchState): boolean {
  const regulationTarget = Math.floor(state.maxRounds / 2) + 1;
  return state.score.CT >= regulationTarget || state.score.T >= regulationTarget || state.round >= state.maxRounds;
}

function clearBombAssignments(state: TacticalMatchState) {
  for (const player of [...state.rosters.CT, ...state.rosters.T]) player.hasBomb = false;
}

function swapSides(state: TacticalMatchState) {
  const ctRoster = state.rosters.CT.map((player) => ({ ...player, team: 'T' as Team, hasBomb: false }));
  const tRoster = state.rosters.T.map((player) => ({ ...player, team: 'CT' as Team, hasBomb: false }));
  state.rosters = { CT: tRoster, T: ctRoster };
  state.economy = {
    CT: createEconomy(state.rosters.CT),
    T: createEconomy(state.rosters.T),
  };
}
