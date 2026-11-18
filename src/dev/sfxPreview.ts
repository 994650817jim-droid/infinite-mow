/** 出手音效试听页（sfx-preview.html，只在 dev server 下可用，不进正式包）。 */
import { Sfx } from '../systems/Sfx';

type Row = { title: string; sub: string; sounds: Array<[string, string]> };
const HEROES: Row[] = [
  { title: '赵云', sub: '龙胆枪 · 突刺破风 + 枪尖轻鸣', sounds: [['atk_spear', '出枪']] },
  { title: '关羽', sub: '青龙偃月刀 · 沉重横扫 + 刀身嗡鸣', sounds: [['atk_guandao', '横扫'], ['atk_guandao_heavy', '蓄势重斩']] },
  { title: '黄忠', sub: '宝雕弓 · 弓弦 + 箭啸；神射加重、爆裂闷响', sounds: [['atk_bow', '射箭'], ['atk_bow_heavy', '神射重箭'], ['atk_bow_impact', '神射爆裂']] },
  { title: '诸葛亮', sub: '火旗 · 点火呼声；大招火焰轰鸣', sounds: [['atk_flame', '挥旗点火'], ['atk_flame_boom', '烈焰轰鸣']] },
  { title: '张飞', sub: '丈八蛇矛 · 沉重直刺；当阳怒吼 + 地面重击', sounds: [['atk_serpent', '蛇矛直刺'], ['atk_roar', '据水断桥 / 燕人咆哮']] },
  { title: '马超', sub: '锦马长枪 · 轻快突刺；铁骑冲锋马蹄', sounds: [['atk_lance', '长枪突刺'], ['atk_charge', '铁骑冲锋']] },
  { title: '魏延', sub: '镇北刀 · 沉重劈砍；谁敢杀我：怒吼 + 地裂', sounds: [['atk_zhenbei', '劈砍'], ['atk_zhenbei_cry', '谁敢杀我']] },
  { title: '刘备', sub: '双股剑 · 双剑交错清脆双响', sounds: [['atk_twin', '双剑']] },
  { title: '庞统', sub: '连环雷 · 锁链哗啦、火雷炸裂', sounds: [['atk_chain', '布雷连环'], ['atk_mine', '火雷炸裂']] },
  { title: '黄月英', sub: '连弩 · 机括 + 弦响 + 弩矢破空；连发齐射', sounds: [['atk_crossbow', '连弩'], ['atk_crossbow_volley', '机关齐射']] },
  { title: '孙尚香', sub: '飞刀 · 尖短「嗖」，常两三把连发', sounds: [['atk_knife', '飞刀']] },
  { title: '貂蝉', sub: '双花扇 · 丝扇轻扫 + 小铃；闭月舞带', sounds: [['atk_fan', '飞扇'], ['atk_moon', '闭月']] },
];
const TROOPS: Row[] = [
  { title: '兵种 / 随行名将（较轻）', sub: '刀 · 枪 · 戟 · 骑 · 弓 · 弩 · 盾 · 谋士', sounds: [['troop_blade', '刀兵'], ['troop_spear', '枪兵'], ['troop_halberd', '戟兵'], ['troop_rider', '骑兵'], ['troop_bow', '弓兵'], ['troop_crossbow', '弩兵'], ['troop_shield', '盾兵'], ['troop_spell', '谋士']] },
];
const MIX: Row = { title: '与打击感一起听', sub: '命中 / 暴击 / 击杀由打击感系统负责，这里只做对照', sounds: [['hitLight', '轻击'], ['hitCrit', '暴击'], ['killThud', '击杀'], ['bossHit', '首领受击']] };

const sfx = new Sfx();
const stats = document.getElementById('stats')!;
const show = (kind: string): void => { const s = sfx.getStats()[kind]; if (s) stats.textContent = `${kind}：触发 ${s.triggered} 次，播放 ${s.played}，被节流 / 并发上限丢弃 ${s.dropped}`; };
const play = (kind: string): void => { sfx.unlock(); sfx.play(kind); show(kind); };
const stress = (kind: string): void => { sfx.unlock(); for (let i = 0; i < 40; i++) window.setTimeout(() => { sfx.play(kind); show(kind); }, i * 75 + Math.random() * 30); };
/** 混战：主将出手 + 5 种兵种同时连发 3 秒，听分组上限。 */
const melee = (hero: string): void => { sfx.unlock(); const kinds = [hero, 'troop_blade', 'troop_spear', 'troop_bow', 'troop_crossbow', 'troop_rider', 'hitLight', 'killThud']; for (let i = 0; i < 120; i++) window.setTimeout(() => sfx.play(kinds[i % kinds.length]), i * 25); window.setTimeout(() => { const st = sfx.getStats(); stats.textContent = '混战 3 秒：' + kinds.map(k => `${k} ${st[k]?.played ?? 0}/${st[k]?.triggered ?? 0}`).join('，'); }, 3200); };

function section(title: string, rows: Row[], withStress: boolean): void {
  const sec = document.createElement('section'), h = document.createElement('h2'), grid = document.createElement('div');
  h.textContent = title; grid.className = 'grid'; sec.append(h, grid);
  for (const r of rows) {
    const card = document.createElement('div'); card.className = 'card';
    const b = document.createElement('b'); b.textContent = r.title; const sm = document.createElement('small'); sm.textContent = r.sub; card.append(b, sm);
    for (const [kind, label] of r.sounds) { const btn = document.createElement('button'); btn.textContent = label; btn.onclick = () => play(kind); card.append(btn); }
    if (withStress) {
      const k = r.sounds[0][0], s1 = document.createElement('button'); s1.className = 'stress'; s1.textContent = '割草连发'; s1.onclick = () => stress(k); card.append(s1);
      const s2 = document.createElement('button'); s2.className = 'stress'; s2.textContent = '混战（带兵）'; s2.onclick = () => melee(k); card.append(s2);
    }
    grid.append(card);
  }
  document.getElementById('app')!.append(sec);
}
section('可玩武将（本命武器）', HEROES, true);
section('兵种', TROOPS, false);
section('对照', [MIX], false);
(window as unknown as { __sfxPreview?: Sfx }).__sfxPreview = sfx;
