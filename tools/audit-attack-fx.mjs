// 攻击特效整体检查（2026-11-20 统筹：「关于攻击特效需要检查一下自不自然，兼不兼容，会不会很奇怪」）：
// 17 位可玩武将逐个跑 4 段：普攻 + 起手特效 / 专职甲进阶 / 专职乙进阶 / 满场混战（学两派战法），每段截图并逐帧采样：
//   同屏特效数、代码画的 Graphics 数（排除 HUD）、跑到主将身后的特效、盖住 HUD 的特效、残留超过 4 秒的特效、同一点叠了几层、帧率。
// 输出 assets/review/attack-fx/<武将>_<段>.png 与 report.json（不入库）。
// 用法：BASE=http://127.0.0.1:5743/ [HEROES=zhaoyun,guanyu] [TAG=before] node tools/audit-attack-fx.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5743/', TAG = E.TAG ?? 'before', OUT = 'assets/review/attack-fx/' + TAG;
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const report = {};
try {
  const p0 = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await p0.goto(BASE + '?dev=1&layout=desktop', { waitUntil: 'domcontentloaded' });
  await p0.waitForFunction(() => window.__game, null, { timeout: 120000 });
  const all = await p0.evaluate(async () => (await import('/src/data/characters.ts')).CHARACTERS.map(c => c.id));
  await p0.context().close();
  const heroes = E.HEROES ? E.HEROES.split(',') : all;
  for (const hero of heroes) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await p.addInitScript(h => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', h); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } }, hero);
    await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 });
    await p.evaluate(h => { const s = window.__game.scene.getScene('GameScene'); if (s.runConfig?.character !== h) { s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: h, weapon: undefined }); s.scene.restart(); } }, hero);
    await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.__DEV_ACTIONS; }, hero, { timeout: 60000 });
    await p.waitForTimeout(800);
    // 公共：采样器
    await p.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      s.__DEV_ACTIONS.closePopup?.(); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = 0;
      setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40);
      const GROUND = /field|zone|sigil|ring|pin|route|banner|dust|aura|trail|scar|mark-ground|ember|fire-ground|shadow|qin|circle|area|floor|decal|crack|puddle/i;
      const isFx = o => o.visible && o.alpha > .05 && o.texture && /^(fx_|branch_fx|bvfx|school_fx|jn_|spear_thrust|fx)/.test(o.texture.key ?? '');
      window.__audit = {
        start() { this.t0 = performance.now(); this.samples = []; this.seen = new Map(); this.timer = setInterval(() => this.sample(), 100); },
        stop() { clearInterval(this.timer); const S = this.samples; const fps = S.map(x => x.fps); const pick = k => [...new Set(S.flatMap(x => x[k]))].slice(0, 12);
          const stuck = [...this.seen.entries()].filter(([o, t]) => o.active && performance.now() - t > 4000 && !GROUND.test(o.name ?? '')).map(([o]) => (o.name || o.texture?.key) + '');
          return { maxFx: Math.max(0, ...S.map(x => x.fx)), avgFx: +(S.reduce((a, x) => a + x.fx, 0) / Math.max(1, S.length)).toFixed(1), maxGfx: Math.max(0, ...S.map(x => x.gfx)), gfxNames: pick('gfxNames'), under: pick('under'), hudOver: pick('hudOver'), maxCluster: Math.max(0, ...S.map(x => x.cluster)), clusterNames: pick('clusterNames'), stuck: [...new Set(stuck)].slice(0, 10), fpsMin: Math.round(Math.min(...fps)), fpsAvg: Math.round(fps.reduce((a, b) => a + b, 0) / Math.max(1, fps.length)), objs: Math.max(0, ...S.map(x => x.objs)), keys: pick('keys') }; },
        sample() {
          const pl = s.player, pd = pl.sprite.depth, list = s.children.list, now = performance.now();
          const fx = [], gfxNames = [], under = [], hudOver = [], keys = [];
          let gfx = 0;
          for (const o of list) {
            if (o.type === 'Graphics' && o.visible && o.alpha > .05 && o.scrollFactorX !== 0) { gfx++; gfxNames.push(o.name || '(无名)'); }
            if (!isFx(o)) continue;
            if (o.scrollFactorX === 0) continue;
            fx.push(o); keys.push(o.texture.key);
            if (!this.seen.has(o)) this.seen.set(o, now);
            const near = Math.hypot(o.x - pl.x, o.y - pl.y) < 90;
            if (near && o.depth < pd && !GROUND.test((o.name ?? '') + o.texture.key)) under.push((o.name || '') + '@' + o.texture.key);
            if (o.depth >= 900) hudOver.push((o.name || '') + '@' + o.texture.key);
          }
          let cluster = 0, clusterNames = [];
          for (const a of fx) { const c = fx.filter(o => Math.hypot(o.x - a.x, o.y - a.y) < 26); if (c.length > cluster) { cluster = c.length; clusterNames = c.map(o => o.texture.key); } }
          this.samples.push({ fx: fx.length, gfx, gfxNames, under, hudOver, cluster, clusterNames, fps: window.__game.loop.actualFps, objs: list.length, keys });
        },
      };
    });
    const runScenario = async (name, code, ms, shotAt) => {
      await p.evaluate(`(async () => { ${code} })()`);
      await p.evaluate(() => window.__audit.start());
      await p.waitForTimeout(shotAt);
      const pos = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), c = s.cameras.main; return { x: (s.player.x - c.worldView.x) * 1280 / c.worldView.width, y: (s.player.y - c.worldView.y) * 720 / c.worldView.height }; });
      const cx = Math.max(0, Math.min(1280 - 760, Math.round(pos.x - 380))), cy = Math.max(0, Math.min(720 - 430, Math.round(pos.y - 230)));
      await p.screenshot({ path: `${OUT}/${hero}_${name}.png`, clip: { x: cx, y: cy, width: 760, height: 430 } });
      await p.waitForTimeout(Math.max(0, ms - shotAt));
      return p.evaluate(() => window.__audit.stop());
    };
    const clear = `const s = window.__game.scene.getScene('GameScene'), pl = s.player, w = pl.weapons[0];
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      const ring = (n, r, stun = true) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * .2; const e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, 1, true); if (e) { e.hp = e.maxHp = 400; if (stun) e.stunUntil = s.combatNow + 1e7; } } };`;
    const R = {};
    // ① 普攻 + 起手特效（招牌技 / 被动触发的手绘起手）
    R.basic = await runScenario('basic', `${clear} w.level = 3; w.branch = undefined; w.over = 0; ring(6, 110); ring(5, 200); setTimeout(() => { s.heroCastFx?.markSkill(); pl.playAction?.('skill', 'right'); }, 500);`, 2200, 650);
    // ②③ 两个专职进阶（老 12 人走 branchRt.final；P2 走 build.tags ≥ 4）
    const branches = await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'); const B = await import('/src/data/weaponBranches.ts'); return B.branchesFor(s.player.weapons[0].id).map(b => ({ id: b.id, school: b.school })); });
    for (const [i, br] of branches.entries()) {
      R['branch' + (i ? 'B' : 'A')] = await runScenario(br.id, `const br = ${JSON.stringify(br)}; ${clear} w.level = 5; w.branch = br.id; w.over = 2; const tags = { fire: 0, stratagem: 0, archery: 0, cavalry: 0, warrior: 0, formation: 0 }; tags[br.school] = 5; pl.growth.build.tags = () => tags; if (s.branchRt) s.branchRt.final = () => true; ring(7, 120); ring(6, 230);`, 2600, 1300);
      await p.evaluate("(() => { const s = window.__game.scene.getScene('GameScene'); s.player.weapons[0].branch = undefined; s.player.weapons[0].over = 0; })()");
    }
    // ④ 满场混战：学本命两派各两门战法（Lv3），60 个会动的敌兵，看叠加 / 帧率
    R.melee = await runScenario('melee', `${clear} w.level = 5; w.branch = undefined; w.over = 0; delete pl.growth.build.tags; if (s.branchRt) s.branchRt.final = () => false;
      return import('/src/data/builds.ts').then(B => import('/src/data/schools.ts').then(S => { const aff = S.HERO_AFFINITY?.[s.runConfig.character] ?? []; const T = B.TACTICS; for (const sc of aff) { let n = 0; for (const id of Object.keys(T)) { if (T[id].tag !== sc || n >= 2) continue; n++; for (let k = 0; k < 3; k++) pl.growth.build.learn(id); } } for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 330; const e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, 1, true); if (e) e.hp = e.maxHp = 220; } }));`, 4500, 2600);
    R.errors = errs.slice(0, 5);
    report[hero] = R;
    console.log(hero, JSON.stringify({ basic: [R.basic.maxFx, R.basic.maxGfx, R.basic.fpsMin], A: R.branchA && [R.branchA.maxFx, R.branchA.maxCluster], melee: [R.melee.maxFx, R.melee.maxGfx, R.melee.maxCluster, R.melee.fpsMin, R.melee.fpsAvg], under: R.melee.under.length + R.basic.under.length, stuck: [...R.basic.stuck, ...R.melee.stuck].length, err: errs.length }));
    await p.context().close();
  }
} finally { writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1)); await b.close(); }
