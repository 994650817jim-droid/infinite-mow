// 天下地图 · 章节时间线解锁流程：node tools/test-worldmap-chapters.mjs（需 dev server 5173）。截图输出 assets/review/worldmap-chapters/。
// 覆盖：① 存档规则（第一章通关开图、逐章解锁、新篇提示、旧存档兼容）；② 手机：真打第一章三关 → 告捷弹窗 → 进入天下地图 → 时间线状态 → 选章出征；
// ③ 电脑：讨董通关后的地图（群雄开放、攻城开放）；④ 手柄在地图上切换章节。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PADJS, padApi } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/worldmap-chapters';
mkdirSync(out, { recursive: true });
const checks = [], errors = [];
const ck = (name, ok, data) => { checks.push({ name, ok: !!ok, data }); console.log(ok ? 'PASS' : 'FAIL', name, data === undefined ? '' : JSON.stringify(data)); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
const mapState = p => p.evaluate(() => {
  const s = window.__game.scene.getScene('WorldMapScene'), node = id => s.children.getByName('node-' + id)?.getData('state') ?? s.markers.find(m => m.node.id === id)?.root.list.find(o => o.name === 'node-' + id)?.getData('state');
  const chip = id => s.children.getByName('chapter-chip-' + id)?.getData('state');
  const ids = ['huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'];
  return { nodes: Object.fromEntries(ids.map(i => [i, node(i)])), chips: Object.fromEntries(ids.map(i => [i, chip(i)])), selected: s.selected.kind === 'node' ? s.selected.node.id : s.selected.city.id,
    action: s.action.text.text, actionOn: !!s.action.image.input?.enabled, title: s.detailTitle.text, detail: s.detail.text, banner: !!s.children.getByName('chapter-unlock-banner'), era: s.children.getByName('world-era')?.text };
});
try {
  // ① 存档规则
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); watch(p);
    await p.goto(base + '?layout=mobile'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
    const r = await p.evaluate(async () => {
      const w = await import('/src/world/WorldStore.ts'), t = await import('/src/world/ChapterTimeline.ts'), out = {};
      const reset = () => { for (const k of [w.WORLD_KEY, w.BACKUP_KEY, 'im_chapter1_cleared']) localStorage.removeItem(k); };
      const win = { chapter: 'huangjin', victory: true, bossKilled: true, reason: 'boss', elapsed: 150, kills: 100, debug: false };
      const states = () => Object.fromEntries(t.CHAPTER_TIMELINE.map(c => [c.id, t.chapterState(c.id, w.loadWorld())]));
      reset(); out.fresh = { world: w.worldUnlocked(), states: states() };
      for (let stage = 1; stage <= 3; stage++) { const id = w.beginExpedition('huangjin', stage); w.settleExpedition(id, win); out['after' + stage] = w.worldUnlocked(); }
      out.ch1 = { states: states(), fresh1: w.takeNewChapters(), fresh2: w.takeNewChapters() };
      // 调试战斗不计进度、不开图
      reset(); { const id = w.beginExpedition('huangjin', 3); w.settleExpedition(id, { ...win, debug: true }); out.debugWorld = w.worldUnlocked(); }
      // 旧存档：v7 已通关黄巾但未开图 → 开图，资源不丢，不补弹新篇提示
      reset(); localStorage.setItem(w.WORLD_KEY, JSON.stringify({ version: 7, yellowStages: 3, dongzhuoStages: 1, worldAvailable: false, cleared: { huangjin: true, hulao: false }, merits: 321, provisions: 654, buildings: { barracks: 2, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'] }));
      out.v7 = { world: w.worldUnlocked(), merits: w.loadWorld().merits, seen: w.loadWorld().chapterSeen, fresh: w.takeNewChapters(), states: states() };
      // 旧存档：已通讨董 → 群雄开放，官渡锁
      reset(); localStorage.setItem(w.WORLD_KEY, JSON.stringify({ version: 8, yellowStages: 3, dongzhuoStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 1, provisions: 1, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: [] }));
      out.hulao = states();
      // 群雄三关 → 官渡开放；官渡三关 → 赤壁开放
      const s = w.loadWorld(); s.warlordStages = 3; localStorage.setItem(w.WORLD_KEY, JSON.stringify(s)); out.qx = states();
      s.guanduStages = 3; localStorage.setItem(w.WORLD_KEY, JSON.stringify(s)); out.gd = states();
      // 仅旧版通关标记（无结构存档）
      reset(); localStorage.setItem('im_chapter1_cleared', 'true'); out.legacy = { world: w.worldUnlocked(), states: states() };
      reset(); return out;
    });
    ck('fresh profile: map closed, only ch1 open', !r.fresh.world && r.fresh.states.huangjin === 'open' && r.fresh.states.hulao === 'locked', r.fresh);
    ck('map opens only after ch1 stage 3', !r.after1 && !r.after2 && r.after3, [r.after1, r.after2, r.after3]);
    ck('after ch1: huangjin cleared, hulao open, rest locked', r.ch1.states.huangjin === 'cleared' && r.ch1.states.hulao === 'open' && ['qunxiong', 'guandu', 'chibi'].every(k => r.ch1.states[k] === 'locked'), r.ch1.states);
    ck('new-chapter notice fires once', r.ch1.fresh1 === 1 && r.ch1.fresh2 === 0, r.ch1);
    ck('debug battle does not open map', !r.debugWorld);
    ck('old v7 save (ch1 cleared) gains map, keeps resources, no retro banner', r.v7.world && r.v7.merits === 321 && r.v7.seen === 2 && r.v7.fresh === 0 && r.v7.states.hulao === 'open', r.v7);
    ck('hulao cleared → qunxiong open, guandu locked', r.hulao.hulao === 'cleared' && r.hulao.qunxiong === 'open' && r.hulao.guandu === 'locked', r.hulao);
    ck('qunxiong 3/3 → guandu open; guandu 3/3 → chibi open', r.qx.guandu === 'open' && r.qx.chibi === 'locked' && r.gd.chibi === 'open', { qx: r.qx, gd: r.gd });
    ck('legacy flag save still opens map and hulao', r.legacy.world && r.legacy.states.hulao === 'open', r.legacy);
    await p.close();
  }
  // ② 手机：真打第一章 → 告捷 → 天下地图 → 选章
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); watch(p);
    await p.goto(base + '?layout=mobile'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
    await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
    // 主页 Enter → 点将；再 Enter → 确认出战
    await p.keyboard.press('Enter'); await p.waitForTimeout(800);
    await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), find = list => { for (const o of list) { if (o.name === 'hero-confirm') return o; if (o.list) { const r = find(o.list); if (r) return r; } } }; find(m.children.list)?.emit('pointerdown'); });
    await p.waitForTimeout(800); await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('start-campaign')?.emit('pointerdown'));
    await p.waitForFunction(() => window.__game?.scene.isActive('GameScene'), null, { timeout: 30000 });
    for (let stage = 1; stage <= 3; stage++) {
      await p.waitForTimeout(200);
      await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (!s.boss) s.spawnBoss(); });
      await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene').boss?.active, null, { timeout: 15000 });
      await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.hitEnemy(s.boss, 1e6, s.combatNow, 'melee'); });
      // 首领遗物 / 升级三选一：逐个选第一项直到进入军营或结算
      for (let i = 0; i < 20; i++) { const mode = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (s.mode === 'bossloot' || s.mode === 'levelup') s.chooseUpgrade(0); return s.mode; }); if (mode === 'rest' || mode === 'result') break; await p.waitForTimeout(250); }
      await p.waitForTimeout(150);
      if (stage < 3) { await p.evaluate(() => window.__game.scene.getScene('GameScene').continueCampaign()); await p.waitForTimeout(400); }
    }
    await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene').children.getByName('chapter1-volunteers'), null, { timeout: 15000 }).catch(() => {});
    const notice = await p.evaluate(() => { const n = window.__game.scene.getScene('GameScene').children.getByName('chapter1-volunteers'); return n ? n.list.filter(o => typeof o.text === 'string').map(o => o.text).join('|') : null; });
    ck('ch1 victory notice announces the world map', !!notice && notice.includes('天下地图开启') && notice.includes('展开天下地图'), notice);
    await p.screenshot({ path: `${out}/mobile-1-victory-notice.png` });
    await p.evaluate(() => window.__game.scene.getScene('GameScene').children.getByName('chapter1-volunteers').getByName('volunteers-confirm').emit('pointerdown'));
    await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 15000 });
    await p.waitForTimeout(900);
    let m = await mapState(p);
    ck('notice confirm opens world map focused on 讨伐董卓', m.selected === 'hulao' && m.actionOn && m.action === '选择武将 · 出征', m);
    ck('map: huangjin cleared, hulao open, later chapters locked', m.nodes.huangjin === 'cleared' && m.nodes.hulao === 'open' && ['qunxiong', 'guandu', 'chibi'].every(k => m.nodes[k] === 'locked'), m.nodes);
    ck('timeline chips mirror node states', JSON.stringify(m.chips) === JSON.stringify(m.nodes), m.chips);
    ck('new-chapter banner shown', m.banner);
    ck('era chip shows pre-Dong year', m.era?.includes('190'), m.era);
    await p.screenshot({ path: `${out}/mobile-2-map-unlocked.png` });
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('chapter-chip-qunxiong').emit('pointerup')); await p.waitForTimeout(200);
    m = await mapState(p);
    ck('locked chapter shows unlock condition and disabled action', m.selected === 'qunxiong' && !m.actionOn && m.action === '尚未解锁' && m.detail.includes('通关第二章「讨伐董卓」后解锁'), m);
    await p.screenshot({ path: `${out}/mobile-3-locked-chapter.png` });
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('chapter-chip-huangjin').emit('pointerup')); await p.waitForTimeout(200);
    m = await mapState(p);
    ck('cleared chapter is replayable', m.selected === 'huangjin' && m.actionOn && m.action.includes('重温') && m.detail.includes('已平定'), m);
    // 城池：讨董之前不开放攻城
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.selected = { kind: 'city', city: s.cityMarkers.find(c => c.city.id === 'xuchang').city }; s.refresh(); }); await p.waitForTimeout(150);
    m = await mapState(p);
    ck('siege gated until 讨伐董卓 cleared', !m.actionOn && m.action === '讨董后开放攻城', m.action);
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('chapter-chip-hulao').emit('pointerup')); await p.waitForTimeout(150);
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('map-action').emit('pointerup'));
    await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 20000 });
    ck('出征 from map goes to hero select for 讨伐董卓', await p.evaluate(() => window.__game.scene.getScene('MenuScene').selectedChapter === 'hulao' && window.__game.registry.get('worldCampaign') === true));
    await p.waitForTimeout(500); await p.screenshot({ path: `${out}/mobile-4-hulao-hero-select.png` });
    // 再次进图：新篇提示不重复
    await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene')); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(300);
    ck('banner not repeated on revisit', !(await mapState(p)).banner);
    await p.close();
  }
  // ③ 电脑：讨董已通关的存档 + ④ 手柄切换章节
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); watch(p);
    await p.addInitScript(PADJS);
    const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, worldAvailable: true, chapterSeen: 2, cleared: { huangjin: true, hulao: true }, merits: 200, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'] };
    await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } }, save);
    await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
    await p.evaluate(() => { window.__game.registry.set('mapFocusNode', 'qunxiong'); window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); });
    await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(900);
    await p.evaluate(() => { const ok = window.__game.scene.getScene('WorldMapScene').children.getByName('era-modal')?.getByName?.('era-ok'); if (ok) ok.emit('pointerup'); }); await p.waitForTimeout(200);
    let m = await mapState(p);
    ck('desktop: hulao cleared → 群雄割据 open and selected', m.nodes.hulao === 'cleared' && m.nodes.qunxiong === 'open' && m.nodes.guandu === 'locked' && m.selected === 'qunxiong' && m.actionOn, m);
    ck('desktop: banner for newly opened 群雄割据', m.banner);
    await p.screenshot({ path: `${out}/desktop-1-qunxiong-open.png` });
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.selected = { kind: 'city', city: s.cityMarkers.find(c => c.city.id === 'xuchang').city }; s.refresh(); }); await p.waitForTimeout(150);
    m = await mapState(p);
    ck('desktop: siege available after 讨伐董卓', m.actionOn && m.action.includes('攻城'), m.action);
    // 手柄：方向键移到「肆 官渡之战」章节条，Ⓐ 选中
    const pad = padApi(p); await p.waitForTimeout(300); await pad.press('DOWN');
    const f0 = await pad.focus(); if (f0?.name !== 'chapter-chip-guandu') await pad.press('RIGHT'); const f = await pad.focus();
    ck('gamepad ↓/→ moves focus onto timeline chips', f0?.name?.startsWith('chapter-chip-') && f?.name === 'chapter-chip-guandu', { f0, f });
    if (f?.name === 'chapter-chip-guandu') { await pad.press('A'); await p.waitForTimeout(250); }
    m = await mapState(p);
    ck('gamepad Ⓐ selects that chapter', m.selected === 'guandu' && m.action === '尚未解锁' && m.detail.includes('通关第三章'), m);
    await p.screenshot({ path: `${out}/desktop-2-pad-guandu-locked.png` });
    await p.close();
  }
} finally { await b.close(); }
ck('no console/page errors', errors.length === 0, errors.slice(0, 5));
writeFileSync(`${out}/checks.json`, JSON.stringify(checks, null, 2));
const failed = checks.filter(c => !c.ok).length; console.log(`${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
