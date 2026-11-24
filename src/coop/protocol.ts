import type { ChallengeChoice, GauntletRunTier, MythicTier, MythicWarning } from '../data/mythicGauntlet';
import type { CharacterId } from '../data/characters';

export type Side = 0 | 1;
export type CoopMode = 'gauntlet';
export interface General { id: string; name: string }
export interface BossWarning {
  mythic?: MythicTier; face?: number; startsAt?: number; power?: number;
  action?: MythicWarning['action'];
  fx?: 'thunder' | 'quake' | 'spear' | 'arrow';
  endsAt: number;
  lanes?: number; spread?: number; halfWidth?: number; combo?: boolean;
  kind: 'circle' | 'line' | 'sweep' | 'ring';
  innerRadius?: number;
  name: string;
  x: number;
  y: number;
  angle: number;
  radius: number;
  resolved: boolean;
}
export interface GauntletState {
  wave: number;
  cleared: number;
  total: number;
  remaining: number;
  tier?: GauntletRunTier;
  milestones?: number;
  general: General | null;
  upcoming: General;
  warning: BossWarning | null;
  warnings?: BossWarning[];
  dual?: boolean;
}
export interface Fighter {
  slot: Side;
  hero: CharacterId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  rescue: number;
  dir: number;
  moving: boolean;
  strike: { n: number; x: number; y: number };
}
export type PartyMember = Pick<Fighter, 'slot' | 'hero' | 'hp' | 'maxHp'> & { ready: boolean };
export interface TroopCue { kind: string; x: number; y: number; angle: number; range: number; width: number; endsAt: number; spread?: number }
export interface TroopEffect { kind: string; x: number; y: number; radius: number; until: number }
export interface Foe { enraged?: boolean; troop?: string; cue?: TroopCue; face?: number; boosted?: boolean; id: number; x: number; y: number; hp: number; maxHp: number; boss: boolean; general?: General }
export type ServerMessage =
  | { type: 'session'; code: string; slot: Side; token: string; graceMs: number }
  | { type: 'connection'; paused: boolean; remaining: number }
  | { type: 'lobby'; code: string; slot: Side; count: number; mode: CoopMode; picks: { slot: Side; hero: CharacterId | null }[] }
  | { type: 'state'; battleMs?: number; seconds: number; kills: number; players: Fighter[]; enemies: Foe[]; shots?: {x:number;y:number;angle:number;net:boolean}[]; troopEffects?: TroopEffect[]; gauntlet: GauntletState }
  | { type: 'draft'; wave: number; total: number; general: string; party: PartyMember[]; choices: string[]; ready: number; checkpoint: boolean; tier?: GauntletRunTier; continuation?: ChallengeChoice[] }
  | { type: 'result'; victory: boolean; kills: number; generals: number; milestones?: number }
  | { type: 'error'; message: string }
  | { type: 'closed'; reason: string };

export function coopSocketUrl(): string | null {
  const configured = import.meta.env.VITE_COOP_URL as string | undefined;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'wss:' || (import.meta.env.DEV && url.protocol === 'ws:')) return url.href;
    } catch { /* The feature is hidden until a valid endpoint is configured. */ }
  }
  if (!import.meta.env.DEV) return null;
  const url = new URL('/coop-socket', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
