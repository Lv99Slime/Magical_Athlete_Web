export type Phase = "draft" | "selection" | "race" | "results" | "finished";
export type RandomSource = () => number;
export interface GameConfig {
  names: string[];
  doubleRacers?: boolean;
  randomTeams?: boolean;
}
export interface Player {
  id: string;
  name: string;
  team: string[];
  used: string[];
  score: number;
}
export interface RacerInstance {
  id: string;
  ownerId: string;
  racerId: string;
  position: number;
  status: "active" | "finished" | "eliminated";
  tripped: boolean;
  powerId: string;
  memory: Record<string, any>;
}
export interface DomainEvent {
  id: number;
  type: string;
  message: string;
  racerId?: string;
  parentId?: number;
  privateTo?: string;
  data?: Record<string, any>;
}
export interface DecisionOption {
  id: string;
  label: string;
}
export interface PendingDecision {
  id: string;
  ownerId: string;
  kind: string;
  prompt: string;
  options: DecisionOption[];
  context: Record<string, any>;
}
export interface ResolutionFrame {
  kind: string;
  [key: string]: any;
}
export interface LedgerEntry {
  playerId: string;
  amount: number;
  reason: string;
  race: number;
}
export interface RaceRecord {
  race: number;
  winner?: string;
  placements: string[];
  racers: RacerInstance[];
  gains: Record<string, number>;
}
export interface TurnState {
  racerId: string;
  start: number;
  face?: number;
  amount?: number;
  skip: boolean;
  magicianRerolls: number;
  dicemongerUsed: boolean;
  prediction?: number;
  extra: boolean;
  blimpModifier?: number;
  hareSkip?: boolean;
}
export interface GameState {
  schemaVersion: 1;
  engineVersion: string;
  rulesVersion: string;
  version: number;
  phase: Phase;
  players: Player[];
  config: { doubleRacers: boolean; randomTeams: boolean };
  deck: string[];
  discarded: string[];
  draft: {
    pool: string[];
    order: string[];
    cursor: number;
    round: number;
    rounds: number;
    starter: number;
  };
  selections: Record<string, string[]>;
  raceNumber: number;
  racers: RacerInstance[];
  turnOrder: string[];
  turnIndex: number;
  starter: number;
  turn?: TurnState;
  frozenPowers?: Record<string, string>;
  nextOverride?: string;
  extraTurns: string[];
  placements: string[];
  history: RaceRecord[];
  ledger: LedgerEntry[];
  raceStartScores: Record<string, number>;
  pending?: PendingDecision;
  queue: ResolutionFrame[];
  events: DomainEvent[];
  eventCounter: number;
  decisionCounter: number;
  randomOutcomes: number[];
  cycleSeen: string[];
  error?: string;
}
export type PlayerAction =
  | { type: "draft"; racerId: string }
  | { type: "select"; racerIds: string[] }
  | { type: "choose"; decisionId: string; optionId: string }
  | { type: "roll" }
  | { type: "nextRace" };
export interface PlayerCommand {
  actorId: string;
  action: PlayerAction;
}
export interface PlayerView extends Omit<
  GameState,
  | "deck"
  | "discarded"
  | "selections"
  | "queue"
  | "cycleSeen"
  | "randomOutcomes"
  | "pending"
> {
  deckCount: number;
  selections: Record<string, string[]>;
  selectionReady: string[];
  pending?: Omit<PendingDecision, "context">;
  legalActions: PlayerAction[];
}
export interface PowerDefinition {
  id: string;
  on: Record<string, (ctx: any) => void>;
}
