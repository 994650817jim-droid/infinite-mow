import type {CompanyRow,CompanyStatus} from './CoopRetinueView';
import type { ChallengeChoice, GauntletRunTier, MythicTier, MythicWarning } from '../data/mythicGauntlet';
import type { CharacterId } from '../data/characters';

export type Side = 0 | 1;
export type CoopMode = 'gauntlet';
export interface General { id: string; name: string }
export interface BossWarning {
  ownerId?: number;
  mythic?: MythicTier; face?: number; startsAt?: number; power?: number;
  action?: MythicWarning['action'];
  wei?: MythicWarning['wei'];
  wind?: MythicWarning['wind'];
  halberd?: MythicWarning['halberd']; charge?: boolean; transit?: MythicWarning['transit'];
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
  mythicSize?: number;
  general: General | null;
  upcoming: General;
  warning: BossWarning | null;
  warnings?: BossWarning[];
  dual?: boolean;
}
export interface Fighter {
  order?:'guard'|'sortie';
  stars?: string[];
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
export type PartyMember = Pick<Fighter, 'slot' | 'hero' | 'hp' | 'maxHp' | 'stars'> & { ready: boolean; ember?:number; company?:CompanyStatus };
export interface TroopCue { kind: string; x: number; y: number; angle: number; range: number; width: number; endsAt: number; spread?: number }
export interface TroopEffect { fromX?:number; fromY?:number; kind: string; x: number; y: number; radius: number; until: number }
export interface Foe { enraged?: boolean; troop?: string; cue?: TroopCue; face?: number; boosted?: boolean; id: number; x: number; y: number; hp: number; maxHp: number; boss: boolean; general?: General }
export type ServerMessage =
  | { type: 'session'; code: string; slot: Side; token: string; graceMs: number }
  | { type: 'connection'; paused: boolean; remaining: number }
  | { type: 'lobby'; code: string; slot: Side; count: number; mode: CoopMode; picks: { slot: Side; hero: CharacterId | null }[] }
  | { type: 'state'; burning?:number[]; retainers?:CompanyRow[]; spellMarks?:number[]; battleMs?: number; seconds: number; kills: number; players: Fighter[]; enemies: Foe[]; shots?: {x:number;y:number;angle:number;net:boolean}[]; troopEffects?: TroopEffect[]; gauntlet: GauntletState }
  | { type: 'draft'; seconds?:number; wave: number; total: number; mythicSize?:number; general: string; party: PartyMember[]; choices: string[]; ready: number; checkpoint: boolean; tier?: GauntletRunTier; continuation?: ChallengeChoice[]; votes?: (ChallengeChoice | null)[] }
  | { type: 'result'; mythicSize?:number; tier?:string; wave?:number; victory: boolean; reason?: 'defeated'|'withdrawn'|'completed'; seconds?: number; bosses?:string[]; party?: {slot:number; hero:string; damage?:number; defeats?:number; revives?:number; men:number; lost:number; coins:number; stars:string[]}[]; kills: number; generals: number; milestones?: number }
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
