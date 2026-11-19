// 三选一池子深度模拟（wave-progression-redesign.md §4.5，2026-11-19 用户「我担心3选一池子够不够」）：
// 用真实的 buildUpgradeOptions 把一名武将整条主线的三选一连着抽完（第一章 14 次、之后每章 15 次 = 5 段 × 3 关；旧版每章 12 次），
// 每次按「本命 > 武艺 > 战法 > 其他」选一张（新卡不执行效果，只计数），统计各章出现的卡里「填充卡（固本培元等）/ 永久构筑 / 新卡」各占多少。
// 用法：BASE=http://127.0.0.1:5241/ node tools/sim-pick-pool.mjs [hero]   → 打印各章占比（old / new）
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', HERO = process.argv[2] ?? 'zhaoyun';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 500, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 12, tutorialDone: true };
await p.addInitScript(w => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, world);
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
await p.evaluate(h => { const s0 = window.__game.scene.getScene('GameScene'); s0.registry.set('runConfig', { character: h, chapter: 'hulao', westStage: 2 }); s0.scene.start('GameScene'); }, HERO);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.elapsed > .5 && s.phaseRunner; }, null, { timeout: 120000 });
const out = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.setMode?.('pause');
  const up = await import('/src/data/upgrades.ts'), LC = await import('/src/systems/LevelCards.ts'), B = (await import('/src/data/builds.ts')).BuildState, RG = await import('/src/systems/RunGrowth.ts');
  const perChapter = mode => [14, ...Array(11).fill(mode === 'old' ? 12 : 15)];
  const run = mode => {
    // 新的空构筑（同一武将），武器回到 Lv1
    const P = s.player, g = new RG.RunGrowth(P.growth.character); const saved = { growth: P.growth, weapons: P.weapons }; P.growth = g; P.weapons = saved.weapons.map(w => ({ ...w, level: 1 }));
    const rows = []; let taken = {};
    perChapter(mode).forEach((n, ci) => {
      const ch = ci + 1; B.rankCap = mode === 'old' ? 3 : B.rankCapFor(ch); B.slotCap = mode === 'old' ? 6 : B.slotCapFor(ch); RG.RunGrowth.extraCap = mode === 'old' ? 0 : RG.RunGrowth.extraCapFor(ch); taken = {};
      const src = mode === 'old' || ch === 1 ? undefined : { replaceChance: LC.NEW_CARDS.replaceChance(ch), draw: k => LC.drawNewCards({ chapter: ch, taken, applyBuff: () => {}, jinnangHeld: () => false, giveJinnang: () => {}, escort: () => {}, addGrain: () => {}, healFrac: () => {}, manualSchools: () => [], readManual: () => {}, momentum: () => false, startMomentum: () => {}, general: () => {}, gambleTaken: () => false, gamble: () => {}, bountyOpen: () => true, bounty: () => {} }, k) };
      let filler = 0, perm = 0, fresh = 0, cards = 0, deadPanels = 0;
      for (let i = 0; i < n; i++) {
        const opts = up.buildUpgradeOptions(P, P.weapons, g, src);
        const kind = o => o.kind === 'foundation' && /^foundation_/.test(o.id) ? 'filler' : LC.newCardKind(o) ? 'new' : o.kind === 'potion' ? 'filler' : 'perm';
        const ks = opts.map(kind); cards += ks.length; filler += ks.filter(k => k === 'filler').length; perm += ks.filter(k => k === 'perm').length; fresh += ks.filter(k => k === 'new').length; if (!ks.includes('perm') && !ks.includes('new')) deadPanels++;
        const rank = o => o.kind === 'weapon' ? 0 : o.kind === 'martial' ? 1 : o.kind === 'tactic' ? 2 : kind(o) === 'new' ? 3 : 4;
        const pick = [...opts].sort((a, b2) => rank(a) - rank(b2))[0];
        if (kind(pick) === 'perm') pick.apply(P, P.weapons, g);
      }
      rows.push({ ch, picks: n, filler: +(filler / cards).toFixed(2), perm: +(perm / cards).toFixed(2), new: +(fresh / cards).toFixed(2), deadPanels });
    });
    P.growth = saved.growth; P.weapons = saved.weapons; B.rankCap = 3; B.slotCap = 6; RG.RunGrowth.extraCap = 0; return rows;
  };
  return { old: run('old'), new: run('new') };
});
console.log('chapter | old filler / perm | new filler / perm / new | dead panels old→new');
out.old.forEach((o, i) => { const n = out.new[i]; console.log(`${o.ch} | ${o.filler} / ${o.perm} | ${n.filler} / ${n.perm} / ${n.new} | ${o.deadPanels}→${n.deadPanels}`); });
console.log(JSON.stringify(out));
await b.close();
