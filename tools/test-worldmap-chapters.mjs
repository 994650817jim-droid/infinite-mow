// 天下地图 · 章节时间线解锁流程：node tools/test-worldmap-chapters.mjs（需 dev server 5173）。截图输出 assets/review/worldmap-chapters/。
// 覆盖：① 存档规则（第一章通关开图、逐章解锁、新篇提示、旧存档兼容）；② 手机：真打第一章三关 → 告捷弹窗 → 进入天下地图 → 时间线状态 → 选章出征；
// ③ 电脑：讨董通关后的地图（群雄开放、攻城开放）；④ 手柄在地图上切换章节。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PADJS, padApi } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/worldmap-chapters';
mkdirSync(out, { recursive: true });
const checks = [], errors = [];
const pin = (p, id, n) => p.evaluate(([id, n]) => { const s = window.__game.scene.getScene('WorldMapScene'); s.pins.find(x => x.stage === n).root.list.find(o => o.name === `stage-pin-${id}-${n}`).emit('pointerup', { getDistance: () => 0 }); }, [id, n]);
const startBattle = async p => { await p.evaluate(() => window.__game.scene.getScene('MenuScene').startButton?.emit('pointerdown')); await p.waitForTimeout(900);
  if (!(await p.evaluate(() => window.__game.scene.isActive('GameScene')))) { await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'), find = list => { for (const o of list) { if (o.name === 'hero-confirm') return o; if (o.list) { const r = find(o.list); if (r) return r; } } }; find(m.children.list)?.emit('pointerdown'); }); await p.waitForTimeout(800); await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('start-campaign')?.emit('pointerdown')); }
  await p.waitForFunction(() => window.__game?.scene.isActive('GameScene'), null, { timeout: 30000 }); };
const ck = (name, ok, data) => { checks.push({ name, ok: !!ok, data }); console.log(ok ? 'PASS' : 'FAIL', name, data === undefined ? '' : JSON.stringify(data)); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
// evaluate 回调不要把 scene.start() 的返回值（ScenePlugin，牵连整个纹理管理器）交回 Node：Playwright 会尝试序列化，
// 有大 CanvasTexture（像素数组）时消息超过 512MB，报 ERR_STRING_TOO_LONG。场景切换一律写成 { ...; }。
const mapState = p => p.evaluate(() => {
  const s = window.__game.scene.getScene('WorldMapScene'), node = id => s.children.getByName('node-' + id)?.getData('state') ?? s.markers.find(m => m.node.id === id)?.root.list.find(o => o.name === 'node-' + id)?.getData('state');
  const chip = id => s.children.getByName('chapter-chip-' + id)?.getData('state');
  const ids = ['huangjin', 'hulao', 'qunxiong', 'guandu', 'chibi'];
  return { nodes: Object.fromEntries(ids.map(i => [i, node(i)])), chips: Object.fromEntries(ids.map(i => [i, chip(i)])), selected: s.selected.kind === 'node' ? s.selected.node.id : s.selected.kind === 'stage' ? s.selected.chapter + '-' + s.selected.stage : s.selected.city.id,
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
      out.v7 = { world: w.worldUnlocked(), merits: w.loadWorld().merits, grain: w.loadWorld().provisions, seen: w.loadWorld().chapterSeen, fresh: w.takeNewChapters(), states: states() };
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
    ck('old v7 save (ch1 cleared) gains map, resources folded into 军粮, no retro banner', r.v7.world && r.v7.merits === 0 && r.v7.grain === 654 + 321 * 2 && r.v7.seen === 2 && r.v7.fresh === 0 && r.v7.states.hulao === 'open', r.v7);
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
      for (let i = 0; i < 20; i++) { const mode = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.collectBossChests?.(); if (s.mode === 'levelup') s.chooseUpgrade(0); return s.mode; }); if (mode === 'rest' || mode === 'result') break; await p.waitForTimeout(250); }
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
    ck('era 0 (讨董前夕): chip shows 189', m.era?.includes('讨董前夕') && m.era?.includes('189'), m.era);
    const r1 = await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'), city = id => s.cityMarkers.find(c => c.city.id === id); return { era: s.era, route: s.routeChapter, pins: s.pins.map(x => x.root.list.find(o => o.name?.startsWith('stage-pin-'))?.getData('state')), hulaoNodeHidden: !s.markers.find(x => x.node.id === 'hulao').root.visible, fog: !!s.layer.list.find(o => o.name === 'world-fog'), fogLabel: !!s.layer.list.find(o => o.name === 'fog-label-qunxiong'), changanFog: city('changan').root.getData('fogged'), xuchangFog: city('xuchang').root.getData('fogged') }; });
    ck('route: 讨董 shows 3 stage pins (2-1 open, 2-2/2-3 locked) in place of its node', r1.route === 'hulao' && JSON.stringify(r1.pins) === '["open","locked","locked"]' && r1.hulaoNodeHidden, r1);
    ck('fog hides unopened regions (长安 hidden, 许昌 shown, 群雄 labelled)', r1.era === 0 && r1.fog && r1.fogLabel && r1.changanFog === true && r1.xuchangFog === false, r1);
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
    await pin(p, 'hulao', 2); await p.waitForTimeout(150); m = await mapState(p);
    ck('locked stage pin: 2-2 荥阳 history shown, cannot depart', m.title.includes('荥阳') && m.detail.includes('徐荣') && m.detail.includes('先通关前一关') && !m.actionOn, m);
    await pin(p, 'hulao', 1); await p.waitForTimeout(150); m = await mapState(p);
    ck('open stage pin: 2-1 汜水关 can depart', m.title.includes('汜水关') && m.detail.includes('华雄') && m.actionOn && m.action === '从此关出征', m);
    await p.screenshot({ path: `${out}/mobile-3b-stage-pin.png` });
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('map-action').emit('pointerup'));
    await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 20000 });
    ck('出征 from stage pin goes to hero select for 讨伐董卓 2-1', await p.evaluate(() => { const m = window.__game.scene.getScene('MenuScene'); return m.selectedChapter === 'hulao' && m.selectedWestStage === 1 && window.__game.registry.get('worldCampaign') === true && !window.__game.registry.get('hardChapter'); }));
    await p.waitForTimeout(500); await p.screenshot({ path: `${out}/mobile-4-hulao-hero-select.png` });
    // 再次进图：新篇提示不重复
    await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(300);
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
    await p.evaluate(() => { const s = window.__game.scene.getScene('WorldMapScene'); s.selected = { kind: 'city', city: s.cityMarkers.find(c => c.city.id === 'ye').city }; s.refresh(); }); await p.waitForTimeout(150);
    m = await mapState(p);
    ck('desktop: 邺城 (河北) gated until 官渡 cleared', !m.actionOn && m.action === '官渡后开放攻城' && m.detail.includes('通关第肆章「官渡之战」后开放攻城'), m);
    // 手柄：方向键移到「肆 官渡之战」章节条，Ⓐ 选中
    const pad = padApi(p); await p.waitForTimeout(300); let f0 = null;
    for (let i = 0; i < 6 && !f0?.name?.startsWith('chapter-chip-'); i++) { await pad.press('DOWN'); f0 = await pad.focus(); }
    const order = ['chapter-chip-huangjin', 'chapter-chip-hulao', 'chapter-chip-qunxiong', 'chapter-chip-guandu', 'chapter-chip-chibi'];
    for (let i = 0; i < 5; i++) { const at = order.indexOf((await pad.focus())?.name ?? ''); if (at === 3 || at < 0) break; await pad.press(at < 3 ? 'RIGHT' : 'LEFT'); }
    const f = await pad.focus();
    ck('gamepad ↓/→ moves focus onto timeline chips', f0?.name?.startsWith('chapter-chip-') && f?.name === 'chapter-chip-guandu', { f0, f });
    if (f?.name === 'chapter-chip-guandu') { await pad.press('A'); await p.waitForTimeout(250); }
    m = await mapState(p);
    ck('gamepad Ⓐ selects that chapter', m.selected === 'guandu' && m.action === '尚未解锁' && m.detail.includes('通关第三章'), m);
    await p.screenshot({ path: `${out}/desktop-2-pad-guandu-locked.png` });
    await p.close();
  }
  // ⑤ 乱世难度：全章已平定 → 讨董 2-3 乱世出征 → 首领生命 ×1.8 → 首通奖励与称号
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); watch(p);
    const save = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, worldAvailable: true, chapterSeen: 5, eraSeen: 3, cleared: { huangjin: true, hulao: true }, merits: 1000, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'] };
    await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); sessionStorage.setItem('seeded', '1'); } }, save);
    await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 });
    await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(700);
    await p.evaluate(() => { const ok = window.__game.scene.getScene('WorldMapScene').children.getByName('era-modal')?.getByName?.('era-ok'); if (ok) ok.emit('pointerup'); });
    ck('all chapters open → no fog', await p.evaluate(() => !window.__game.scene.getScene('WorldMapScene').layer.list.some(o => o.name === 'world-fog')));
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('chapter-chip-hulao').emit('pointerup')); await p.waitForTimeout(150);
    await pin(p, 'hulao', 3); await p.waitForTimeout(150);
    const m = await mapState(p);
    const hardBtn = await p.evaluate(() => { const b = window.__game.scene.getScene('WorldMapScene').children.getByName('map-hard'); return { visible: b.visible, on: !!b.input?.enabled }; });
    ck('cleared chapter offers 乱世难度 beside 重打', hardBtn.visible && hardBtn.on && m.action.includes('重打') && m.detail.includes('董卓'), { hardBtn, m });
    await p.screenshot({ path: `${out}/desktop-3-hard-offer.png` });
    await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('map-hard').emit('pointerup'));
    await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 20000 });
    ck('乱世 launch keeps stage + hard flag', await p.evaluate(() => window.__game.registry.get('hardChapter') === 'hulao' && window.__game.scene.getScene('MenuScene').selectedWestStage === 3));
    await startBattle(p);
    await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (!s.boss) s.spawnBoss(); });
    await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene').boss?.active, null, { timeout: 15000 });
    const hard = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return { hard: s.hardMode, stage: s.chapter.westStage, ratio: s.boss.maxHp / (s.chapter.enemies.boss.hp * (s.chapter.growth?.bossHp ?? 1)) /* 与「正常难度的首领生命」比：正常难度已乘 stageTuning 的首领倍率 */, dmg: s.boss.def.damage / s.chapter.enemies.boss.damage }; });
    ck('乱世 battle: boss HP ×1.8, damage ×1.25', hard.hard && hard.stage === 3 && Math.abs(hard.ratio - 1.8) < .03 && Math.abs(hard.dmg - 1.25) < .01, hard);
    const before = await p.evaluate(() => JSON.parse(localStorage.getItem("im_world_v1")).provisions);
    await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.hitEnemy(s.boss, 1e8, s.combatNow, 'melee'); });
    for (let i = 0; i < 20; i++) { const mode = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.collectBossChests?.(); if (s.mode === 'levelup') s.chooseUpgrade(0); return s.mode; }); if (mode === 'result') break; await p.waitForTimeout(250); }
    await p.waitForTimeout(1200);
    const res = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), w = JSON.parse(localStorage.getItem('im_world_v1')); return { body: s.resultTexts.body.text, hardCleared: w.hardCleared, merits: w.merits, provisions: w.provisions }; });
    ck('乱世 first clear: title + one-time reward recorded', res.hardCleared?.includes('hulao') && res.body.includes('乱世首通') && res.body.includes('虎牢扬威') && res.merits === 0 && res.provisions - before >= 600, { ...res, before });
    await p.screenshot({ path: `${out}/desktop-4-hard-result.png` });
    await p.evaluate(() => { window.__game.scene.getScene('GameScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(400);
    ck('timeline marks 乱世 cleared', (await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').children.getByName('chapter-chip-status-hulao').text)).includes('乱世'));
    await p.close();
  }
} finally { await b.close(); }
ck('no console/page errors', errors.length === 0, errors.slice(0, 5));
writeFileSync(`${out}/checks.json`, JSON.stringify(checks, null, 2));
const failed = checks.filter(c => !c.ok).length; console.log(`${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
