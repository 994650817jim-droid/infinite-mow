/**
 * 营寨 / 城池的军医（2026-11-19 用户：「军医随着章节往后推越贵，还有军医再营寨城市也有」）。
 * 与行营休整的军医同一套价格（data/campMedic medicPrice），章节取天下进度（worldMedicChapter）。
 * 不在战斗里：治的是当前武将存档点里的血（征程构筑 im_campaign_v1：主将 hpFrac、名将随从 followerHp、部曲 soldiers），下次出征带上。
 * 付账走钱包（同军需商人 MerchantWallet）：营寨 / 城池扣营寨军粮。还没有征程（没打赢过主线关）时无伤可治。
 */
import { CAMP_MEDIC, medicPrice, type MedicKind } from '../data/campMedic';
import { CAMPAIGN_KEY } from '../systems/Campaign';
import { CHAPTER_TIMELINE, currentChapter } from '../world/ChapterTimeline';
import { loadWorld } from '../world/WorldStore';

export interface MedicWallet { name: string; get(): number; spend(amount: number): boolean }

/** 天下进度在第几章（当前最该打的那一章；全部通关为最后一章）。 */
export function worldMedicChapter(): number {
  try { const c = currentChapter(loadWorld() as Parameters<typeof currentChapter>[0]); return Math.max(1, Math.min(12, CHAPTER_TIMELINE.indexOf(c) + 1)); } catch { return 1; }
}

type Soldier = { hp: number; max?: number };
interface HeroSave { player?: { hpFrac?: number; followerHp?: Record<string, number> }; army?: { soldiers?: Soldier[] } }
function read(): { all: { version?: number; heroes?: Record<string, HeroSave> } | null } { try { return { all: JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null') }; } catch { return { all: null }; } }

export interface OutMedicState { has: boolean; hp: number; followersHurt: number; soldiersHurt: number; chapter: number; price: Record<MedicKind, number>; hale: boolean; armyHale: boolean }
/** 当前武将存档点里的伤情与三档价格。 */
export function outMedicState(hero: string): OutMedicState {
  const ch = worldMedicChapter(), s = read().all?.heroes?.[hero], p = s?.player;
  const hp = p ? Math.max(0, Math.min(1, p.hpFrac ?? 1)) : 1, fh = Object.values(p?.followerHp ?? {}).filter(v => v < 1).length;
  const sh = (s?.army?.soldiers ?? []).filter(x => x.max !== undefined && x.hp < x.max - .5).length;
  return { has: !!p, hp, followersHurt: fh, soldiersHurt: sh, chapter: ch, hale: hp >= .999, armyHale: fh + sh === 0,
    price: { small: medicPrice('small', ch), full: medicPrice('full', ch, 1 - hp), army: medicPrice('army', ch) } };
}
/** 施治：付钱、改存档点。无伤 / 钱不够返回 false。 */
export function outHeal(hero: string, kind: MedicKind, wallet: MedicWallet): boolean {
  const st = outMedicState(hero); if (!st.has) return false;
  if (kind === 'army' ? st.armyHale : st.hale) return false;
  const price = st.price[kind]; if (wallet.get() < price || !wallet.spend(price)) return false;
  const { all } = read(), s = all?.heroes?.[hero]; if (!all || !s?.player) return false;
  if (kind === 'small') s.player.hpFrac = Math.min(1, st.hp + CAMP_MEDIC.small.frac);
  else if (kind === 'full') s.player.hpFrac = 1;
  else { for (const k of Object.keys(s.player.followerHp ?? {})) s.player.followerHp![k] = 1; for (const x of s.army?.soldiers ?? []) if (x.max !== undefined) x.hp = x.max; }
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(all)); } catch { return false; }
  return true;
}
