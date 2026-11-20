// 升级三选一卡面截图（2026-11-19 文案审校前 / 后对比）：几组固定的三张卡，按 ids 从卡面总表（src/data/cardCatalog.ts）取；
// 总表还没有时（审校前）按旧代码的拼法现拼。输出 assets/review/levelup-cards/<TAG>-<组>.png（电脑布局 1280×720）。
// 用法：BASE=http://127.0.0.1:5173/ TAG=after node tools/shot-levelup-cards.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/levelup-cards';
mkdirSync(OUT, { recursive: true });
const PANELS = [
  { name: 'zhuge', hero: 'zhuge', ids: ['martial_wildfire_1', 'martial_eight_trigrams_3', 'tactic_gust_2'] },
  { name: 'newcards', hero: 'zhaoyun', ids: ['jinnang_fire', 'gamble_light', 'bounty_elites'] },
  { name: 'zhaoyun', hero: 'zhaoyun', ids: ['weapon_spear_orbit_2', 'branch_zy_longdan', 'tactic_eagle_4'] },
  { name: 'fortune', hero: 'guanyu', ids: ['new_momentum', 'new_f_vigor', 'new_general'] },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 90000 }); await p.waitForTimeout(800);
for (const P of PANELS) {
  await p.evaluate(id => { const s = window.__game.scene.getScene('GameScene'); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, P.hero);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, P.hero, { timeout: 30000 });
  const got = await p.evaluate(async ids => {
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
    let cat = null;
    try { cat = (await import('/src/data/cardCatalog.ts')).cardCatalog(s.player, { chapter: 9 }); } catch { /* 审校前没有总表 */ }
    if (!cat) { // 旧拼法
      const up = await import('/src/data/upgrades.ts'), bd = await import('/src/data/builds.ts'), lc = await import('/src/systems/LevelCards.ts'), rg = await import('/src/systems/RunGrowth.ts'), wb = await import('/src/data/weaponBranches.ts'), sc = await import('/src/data/schools.ts');
      const tags = s.player.growth.build.tags(), o = (id, name, desc, kind, categoryLabel, icon) => ({ id, name, desc, kind, categoryLabel, icon, apply() {} });
      const m = (id, n) => o(`martial_${id}_${n}`, rg.MARTIALS[id].name + ' · Lv.' + n, up.martialDescription(id, n), 'martial', '专属武艺');
      const t = (id, n) => o(`tactic_${id}_${n}`, bd.TACTICS[id].name + ' · Lv.' + n, bd.tacticDescription(id, n), 'tactic', bd.tacticSchool(id) ? up.schoolLabel(bd.tacticSchool(id), tags) : '基础成长', 'build_icon_' + id);
      let weapon = null; for (let k = 0; k < 40 && !weapon; k++) weapon = up.buildUpgradeOptions(s.player, s.player.weapons, s.player.growth).find(x => x.kind === 'weapon') ?? null;
      const br = wb.branchById('zy_longdan'), F = (await import('/src/data/fortunes.ts')).FORTUNE_BUFFS.find(f => f.id === 'f_vigor');
      cat = [m('wildfire', 1), m('eight_trigrams', 3), t('gust', 2), t('eagle', 4),
        weapon && { ...weapon, id: 'weapon_spear_orbit_2' },
        o('branch_zy_longdan', '专职 · ' + br.name, sc.SCHOOLS[br.school].name + '派 · ' + br.desc + '\n（二选一，选定后本次征程锁定）', 'weapon', '兵器专职 · 二选一', br.icon),
        o('jinnang_fire', '锦囊 · 火计', lc.JINNANG.fire.desc + '\n（R 键使用，限 1 个）', 'foundation', '锦囊 · 一次性', lc.JINNANG.fire.icon),
        o('gamble_light', '赌命 · 轻装', lc.GAMBLES.light.desc, 'foundation', '赌命 · 本关', lc.GAMBLES.light.icon),
        o('bounty_elites', lc.BOUNTIES.elites.name, lc.BOUNTIES.elites.desc, 'foundation', '悬赏军令 · 本关', lc.BOUNTIES.elites.icon),
        o('new_momentum', '乘胜追击', '本关每击杀 10 敌伤害 +1%\n（最多 +15%）', 'foundation', '战场机缘 · 本关有效', 'growth_icon_might'),
        o('new_f_vigor', F.name, F.desc, 'foundation', '战场机缘 · 本关有效', F.icon),
        o('new_general', '名将来投 · 赵云', '赵云率 12 名部众来投，\n随你冲阵 45 秒', 'foundation', '名将来投 · 本关', 'growth_icon_wanrendi')].filter(Boolean);
    }
    const pick = ids.map(id => cat.find(c => c.id === id || c.id.startsWith(id))).filter(Boolean);
    s.upgradeOptions = pick; s.renderCards(); s.setMode('levelup');
    return pick.map(c => c.id);
  }, P.ids);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${TAG}-${P.name}.png` });
  console.log(P.name, JSON.stringify(got));
}
console.log('errors', JSON.stringify(errs.slice(0, 3))); await b.close();
