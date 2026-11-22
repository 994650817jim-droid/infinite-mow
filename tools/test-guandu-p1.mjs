// 第四章 P1：v5→v6 存档迁移、地图入口、选关、4-1 颜良三技能与半血强化、胜利结算与返回地图、战役回顾第四章页签。
// 需要开发服务器 5173。用法：node tools/test-guandu-p1.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/guandu-p1';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 5, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'] };
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const layout of ['mobile', 'desktop']) {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'guanyu'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'));
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'));
  await p.waitForTimeout(300);
  const node = await p.evaluate(async () => { const s = window.__game.scene.getScene('WorldMapScene'), { WORLD_NODES } = await import('/src/world/WorldNodes.ts'); s.selected = { kind: 'node', node: WORLD_NODES.find(n => n.id === 'guandu') }; s.refresh(); return { action: s.action.text.text, detail: s.detailTitle.text }; });
  ck(layout + ' 地图官渡节点已开放', node.action === '选择武将 · 出征' && node.detail.includes('官渡之战'), node);
  await p.screenshot({ path: `${out}/${layout}-map.png` });
  await p.evaluate(() => { window.__game.scene.getScene('WorldMapScene').enterNode(); });
  await p.waitForFunction(() => window.__game.scene.isActive('GuanduChapterScene')); await p.waitForTimeout(300);
  const mig = await p.evaluate(async () => { const w = await import('/src/world/WorldStore.ts'), s = w.loadWorld(); return { version: s.version, guandu: s.guanduStages, merits: s.merits, provisions: s.provisions, third: s.warlordStages, open: [1, 2, 3].map(n => w.arcStageUnlocked('guandu', n)), nodes: s.nodes.includes('guandu') }; });
  // 2026-11-17：开发期不做旧档兼容、军功并入军粮，只查只开 4-1
  ck(layout + ' 第三章通关后第四章只开 4-1', mig.guandu === 0 && mig.third === 3 && mig.open.join() === 'true,false,false' && mig.nodes, mig);
  const cards = await p.evaluate(() => { const s = window.__game.scene.getScene('GuanduChapterScene'); return s.cards.map(c => c.status.text); });
  // P3 起三关全部实装，按顺序解锁
  ck(layout + ' 选关：4-1 可出征，4-2/4-3 锁定待前关', cards[0].includes('出征') && cards[1] === '锁定 · 完成前关' && cards[2] === '锁定 · 完成前关', cards);
  await p.screenshot({ path: `${out}/${layout}-select.png` });
  const pick2 = await p.evaluate(() => { const s = window.__game.scene.getScene('GuanduChapterScene'); s.children.getByName('guandu-stage-2').emit('pointerdown'); return { selected: s.selected, deploy: s.deployText.text }; });
  ck(layout + ' 点未开放的关不会被选中', pick2.selected === 1 && pick2.deploy.includes('白马解围'), pick2);
  await p.evaluate(() => window.__game.scene.getScene('GuanduChapterScene').children.getByName('guandu-deploy').emit('pointerup'));
  await p.waitForFunction(() => window.__game.scene.isActive('GuanduGameScene') && window.__game.scene.getScene('GuanduGameScene').player, null, { timeout: 15000 });
  await p.waitForTimeout(500);
  const start = await p.evaluate(async () => { const s = window.__game.scene.getScene('GuanduGameScene'), w = await import('/src/world/WorldStore.ts'), a = w.loadWorld().active; return { name: s.chapter.name, hero: s.runConfig.character, camps: s.enemyCamps?.camps.length, active: a && { arc: a.arc, stage: a.stage, state: a.state }, tint: s.chapter.enemies.infantry.walkVisual?.texture, yuan: ['infantry','shield','archer','cavalry','elite'].every(k => { const tex = s.chapter.enemies[k].walkVisual?.texture; return tex?.startsWith('yuan_') && s.textures.exists(tex); }), red: (() => { const src = s.textures.get('yuan_xiliang_infantry_walk').getSourceImage(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let red = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx === d[i] && mx > 60 && (mx - mn) / mx > .45 && d[i + 1] < d[i] * .45) red++; } return red; })() }; });
  ck(layout + ' 进入 4-1 白马解围（关羽、两座云梯营、出征记录 guandu）', start.name === '4-1 白马解围' && start.hero === 'guanyu' && start.camps === 2 && start.active?.arc === 'guandu' && start.active.stage === 1 && start.active.state === 'active', start);
  ck(layout + ' 河北袁军土黄配色（yuan_* 贴图、无残留鲜红）', start.yuan && start.tint === 'yuan_xiliang_infantry_walk' && start.red < 50, { tint: start.tint, yuan: start.yuan, red: start.red });
  // 首领三技能 + 半血强化（逐帧推进首领控制器）
  const boss = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GuanduGameScene'); s.spawnTimer = s.eliteTimer = 1e9; s.spawnBoss();
    const c = s.controller, b = s.boss, pl = s.player; const labels = new Set(); let now = s.combatNow;
    b.sprite.setPosition(pl.x + 160, pl.y);
    const run = ms => { for (let t = 0; t < ms; t += 16) { now += 16; c.update(.016, now); labels.add(c.label.replace(/^(预警|收势 · 反击机会) · /, '')); } };
    for (let i = 0; i < 3; i++) { c.forceSkill(now); run(2700); }
    const first = { ...c.metrics }; b.hp = b.maxHp * .45; run(800); const rage = c.metrics.rage; c.forceSkill(now); run(2700);
    const textureKey = b.sprite.texture.key;
    return { first, rage, phase2: c.phase2, labels: [...labels], textureKey, enemies: s.enemies.filter(e => e.active && e.kind !== 'boss').length };
  });
  ck(layout + ' 颜良三技能都释放（突进+落点斩、回旋、号令攻城）', boss.first.dash >= 1 && boss.first.cleave >= 1 && boss.first.spin >= 1 && boss.first.siege >= 1, boss);
  ck(layout + ' 技能对主将/士兵造成实际伤害', boss.first.damage > 0, boss.first);
  ck(layout + ' 号令攻城召出援军', boss.enemies >= 6, boss.enemies);
  ck(layout + ' 半血强化进入二阶段', boss.rage === 1 && boss.phase2, boss);
  ck(layout + ' 技能名与军心层数显示', ['斩将突进', '大刀回旋', '号令攻城'].every(n => boss.labels.some(l => l.startsWith(n))) && boss.labels.some(l => l.includes('军心×2')), boss.labels);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GuanduGameScene'); s.controller.forceSkill(s.combatNow); });
  await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${layout}-boss.png` });
  // 击败颜良 → 结算 → 返回地图
  await p.evaluate(() => { const s = window.__game.scene.getScene('GuanduGameScene'); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(150); const m = await p.evaluate(() => { const s = window.__game.scene.getScene('GuanduGameScene'); for (let k = 0; k < 40 && (s.mode === 'levelup' || s.mode === 'bossloot'); k++) s.chooseUpgrade(0); s.collectBossChests?.(); /* 2026-11-17：升级三选一、首领宝箱 */ return s.over; }); if (m) break; }
  await p.waitForTimeout(300);
  const end = await p.evaluate(async () => { const s = window.__game.scene.getScene('GuanduGameScene'), w = await import('/src/world/WorldStore.ts'), v = w.loadWorld(); return { over: s.over, victory: s.victory, mode: s.mode, sub: s.resultTexts.subtitle.text, home: s.resultPanel.getByName('result-home')?.text, guandu: v.guanduStages, merits: v.merits, provisions: v.provisions, state: v.active?.state, stage2: w.arcStageUnlocked('guandu', 2) }; });
  ck(layout + ' 胜利结算：guanduStages=1，首通钱币入库，进入军帐休整（下一关 4-2）', end.over && end.victory && end.guandu === 1 && end.provisions > mig.provisions && end.state === 'settled' && end.mode === 'rest' && end.stage2, end);
  ck(layout + ' 结算文案', end.sub.includes('进入军营休整'), end);
  await p.screenshot({ path: `${out}/${layout}-result.png` });
  // 战役回顾第四章页签
  await p.evaluate(() => { window.__game.scene.getScene('GuanduGameScene').scene.start('MenuScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('MenuScene')); await p.waitForTimeout(400);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-review').emit('pointerdown')); await p.waitForTimeout(300);
  const chron = await p.evaluate(() => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'); const all = c.getAll().flatMap(o => o.list ?? [o]); const tab = all.find(o => o.name === 'chronicle-tab-3'); const texts = all.filter(o => o.type === 'Text').map(o => o.text); return { tab: !!tab, texts: texts.filter(t => /官渡|白马|已平定/.test(t)) }; });
  ck(layout + ' 战役回顾第四章页签（默认打开，4-1 已平定）', chron.tab && chron.texts.some(t => t.includes('白马解围')) && chron.texts.some(t => t === '已平定'), chron);
  await p.screenshot({ path: `${out}/${layout}-chronicle.png` });
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
