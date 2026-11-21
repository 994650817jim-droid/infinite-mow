/**
 * 说话人 → 显示名 / 水墨立绘 / 名字章（2026-11-21 美术排查 speaker-portrait-audit.md：很多人有立绘，台词里写的是中文名，走不到 STORY_CAST，只显示字印）。
 * 所有对白都走这一个入口：Story.speaker()（1–12 章、支线、营寨城池剧情、首领登场卡）、StoryScroll（各章章头直接调卷轴的）、
 * StoryBarkCard（战中台词卡、玩法开放引子、关内阶段台词）。who 可以是武将 id、STORY_CAST 键、'{lord}'，也可以是中文名（反查）。
 * 立绘取法：可玩武将有主页立轴的用 ink_hero_<id>，否则用 STORY_CAST 的 ink_cast_<id>；都没有就用名字章。
 */
import { CHARACTERS, HOME_ART_HEROES } from '../characters';
import { STORY_CAST } from './types';

/**
 * 没有立绘、用名字章是正常的泛称 / 群像（静态测试 tools/test-speaker-portraits.mjs 的白名单）。
 * 不在这里、又解析不到立绘的说话人，测试会报出来——要么补立绘登记，要么判定为泛称加进来。
 */
export const SEAL_OK: ReadonlySet<string> = new Set([
  '斥候', '亲兵', '涿郡良匠', '主将', '守将', '乡里郎中', '旁白', '探马', '传令兵', '守军', '百姓', '老卒', '校尉', '郡兵', '众将', '门吏', '信使', '使者', '军士', '士卒', '义军', '城中父老', '村民',
]);

/**
 * 有名有姓、但立绘还在排队的（speaker-portrait-audit.md 出图优先级：皇甫嵩 → 张松 → 秦宓 / 苏双；卢植在美术分支已出图待合）。
 * 先用名字章；静态测试单列出来、不算失败。立绘接上（STORY_CAST 填 portrait）后从这里删掉。
 */
export const AWAITING_ART: ReadonlySet<string> = new Set(['卢植', '皇甫嵩', '张松', '秦宓', '苏双', '忙牙长']);

const hero = (id: string) => CHARACTERS.find(c => c.id === id);
let byName: Map<string, string> | null = null;
/** 中文名 → id（武将优先，再 STORY_CAST）；名字里的括注（「黄忠（老将）」）去掉再比。 */
function nameIndex(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  for (const [id, c] of Object.entries(STORY_CAST)) byName.set(c.name, id);
  for (const c of CHARACTERS) byName.set(c.name, c.id);
  return byName;
}
const clean = (s: string): string => s.replace(/（.*?）|\(.*?\)/g, '').trim();
/** who（id / 中文名）→ 认得的 id（武将或 STORY_CAST）；认不得返回 undefined。 */
export function speakerId(who: string | undefined): string | undefined {
  if (!who) return undefined;
  if (hero(who) || STORY_CAST[who]) return who;
  return nameIndex().get(clean(who));
}
/** 某个 id 的对白立绘贴图键（主页立轴优先，其次剧情人物立绘）。 */
export function portraitOf(id: string): string | undefined {
  if (HOME_ART_HEROES.includes(id)) return 'ink_hero_' + id;
  return STORY_CAST[id]?.portrait;
}
/**
 * 说话人解析（唯一入口）。o.id：台词另给的 id（bark 卡的 id 字段）；o.lord：'{lord}' 换成的主将 id。
 * 返回 name（显示名：认得的用正式名，认不得照原样）、portrait（贴图键，没有就 undefined）、seal（名字章用的字）。
 */
export function speakerArt(who: string | undefined, o: { id?: string; lord?: string } = {}): { id?: string; name?: string; portrait?: string; seal?: string } {
  const raw = who === '{lord}' ? o.lord : who;
  if (!raw && !o.id) return {};
  const id = speakerId(o.id) ?? speakerId(raw);
  if (!id) return { name: raw, seal: raw };
  const name = hero(id)?.name ?? STORY_CAST[id]?.name ?? raw;
  return { id, name, portrait: portraitOf(id), seal: name };
}
