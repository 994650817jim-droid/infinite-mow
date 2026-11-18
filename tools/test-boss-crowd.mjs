// 首领被杂兵包围时的绘制层（用户 2026-11-18「华雄穿模，可能其他 boss 也是」）：首领合集（取 test-boss-moves 的 CASES）逐个检查。
// 每位首领：首领摆在主将右侧，四周一圈 + 身前一排杂兵（按住不动），取样几帧：
//  1. 没有任何杂兵（或精英）画在首领上面又和首领身体框大面积重叠（重叠面积 ≥ 该兵框的 30%）——首领始终看得清；
//  2. 首领的几层（骑乘：马 / 骑手 / 马头前景，都贴着首领精灵）中间没有插进任何敌人；
//  3. 名牌贴在身体最高点上方（plateGap 0~30）或靠近屏幕顶时放脚下；
//  另：汜水关华雄出阵后 20 秒内的杂兵数（首领在场按 BALANCE.bossSpawn 减量）只记录，超过上限判失败。
// 用法：BASE=http://127.0.0.1:5212/ OUT=assets/review/boss-crowd node tools/test-boss-crowd.mjs   （ONLY=huaxiong,lubu）
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = process.env.OUT ?? 'assets/review/boss-crowd';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const src = readFileSync(new URL('./test-boss-moves.mjs', import.meta.url), 'utf8');
const CASES = eval('(' + src.slice(src.indexOf('const CASES = [') + 'const CASES = '.length, src.search(/\];\r?\ntry/) + 1) + ')');
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.id))) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
    await p.evaluate(([key, run, reg]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.run, c.reg]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1000);
    if (c.prep) { await p.waitForTimeout(800); await ev(c.prep); }
    await ev(s => { s.player.damageImmune = true; if (!s.boss?.active) { const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); else s.spawnBoss?.(); } });
    let up = false;
    for (let i = 0; i < 150 && !up; i++) {
      up = await ev(s => !!s.boss?.active);
      if (!up) { if (c.prep) await ev(c.prep); await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (s.mode === 'parley') s.choose('persuade'); if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } }); await p.waitForTimeout(200); }
    }
    ck(`${c.id}：首领出阵`, up, null); if (!up) continue;
    // 汜水关：首领在场 20 秒内的杂兵数（不按住、照常刷兵）
    if (c.id === 'huaxiong') {
      const cap = await p.evaluate(async () => { const { BALANCE } = await import('/src/config.ts'); return Math.round(BALANCE.enemyCap * BALANCE.bossSpawn.capMul); });
      let max = 0, at0 = await ev(s => s.activeEnemyCount());
      for (let t = 0; t < 20000; t += 1000) { await wait(1000); max = Math.max(max, await ev(s => s.activeEnemyCount())); }
      const info = { cap };
      console.log(`INFO huaxiong 出阵时杂兵 ${at0}，之后 20 秒最多 ${max}（首领在场上限按 BALANCE.bossSpawn = enemyCap × capMul）`, JSON.stringify(info));
      ck('汜水关：华雄在场 20 秒内杂兵不超过「首领在场上限」+ 亲卫 4', max <= cap + 4 || max <= at0, { at0, max, cap });
    }
    await wait(2500); // 出场名牌、马图载入
    // 包围：首领在主将右侧 200，杂兵一圈 + 身前一排；按住位置取样
    await ev(s => {
      s.spawnTimer = s.eliteTimer = 1e9;
      for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate?.();
      const B = s.boss, bx = s.player.x + 200, by = s.player.y; B.sprite.setPosition(bx, by);
      const pins = [];
      for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2, r = 46 + (k % 3) * 28; pins.push([bx + Math.cos(a) * r, by + Math.sin(a) * r * .6]); }
      for (let k = 0; k < 7; k++) pins.push([bx - 60 + k * 20, by + 22 + (k % 2) * 30]);
      window.__pins = [];
      for (const [x, y] of pins) { const e = s.spawnEnemy(Math.random() < .25 ? 'elite' : 'infantry', x, y, 40); if (e) window.__pins.push([e, x, y]); }
      window.__bossPin = [bx, by];
    });
    const samples = [];
    for (let k = 0; k < 6; k++) {
      await ev(s => { const [bx, by] = window.__bossPin; s.boss.sprite.setPosition(bx, by); for (const [e, x, y] of window.__pins) if (e.active) e.sprite.setPosition(x, y); });
      await p.waitForTimeout(160);
      samples.push(await ev(s => {
        const B = s.boss, bd = B.sprite.depth, bb = B.sprite.getBounds();
        // 首领的几层：位置贴着首领精灵、深度在 [bd-0.0025, bd+0.0015] 的图
        const layers = s.children.list.filter(o => o.visible && o !== B.sprite && typeof o.depth === 'number' && Math.abs(o.depth - bd) < .0026 && Math.abs((o.x ?? 1e9) - B.sprite.x) < 3 && Math.abs((o.y ?? 1e9) - B.sprite.y) < 40);
        const R = r => ({ l: r.x, t: r.y, r: r.x + r.width, b: r.y + r.height }); let box = R(bb); for (const o of layers) if (o.getBounds) { const q = R(o.getBounds()); box = { l: Math.min(box.l, q.l), t: Math.min(box.t, q.t), r: Math.max(box.r, q.r), b: Math.max(box.b, q.b) }; }
        const lo = Math.min(bd, ...layers.map(o => o.depth)), hi = Math.max(bd, ...layers.map(o => o.depth));
        const foes = s.enemies.filter(e => e.active && e !== B && !e.isSupplySlot && e.sprite.visible);
        const cover = [], inside = [];
        for (const e of foes) {
          const eb = R(e.sprite.getBounds()), area = Math.max(0, Math.min(box.r, eb.r) - Math.max(box.l, eb.l)) * Math.max(0, Math.min(box.b, eb.b) - Math.max(box.t, eb.t)), own = (eb.r - eb.l) * (eb.b - eb.t);
          if (e.sprite.depth > hi && own > 0 && area / own >= .3) cover.push({ kind: e.kind, d: +e.sprite.depth.toFixed(4), dy: Math.round(e.y - B.y), dx: Math.round(e.x - B.x), frac: +(area / own).toFixed(2) });
          if (e.sprite.depth >= lo && e.sprite.depth <= hi) inside.push({ kind: e.kind, d: e.sprite.depth });
        }
        const st = s.presence?.stats ?? {};
        return { bd: +bd.toFixed(4), layers: layers.length, cover, inside, plate: !!st.plate, gap: st.plateGap, below: !!st.plateBelow, top: Math.round(box.t - B.y) };
      }));
    }
    await p.screenshot({ path: `${OUT}/${c.id}.png` });
    const worst = samples.reduce((a, x) => x.cover.length >= a.cover.length ? x : a, samples[0]);
    ck(`${c.id}${c.mounted ? '（骑马）' : ''}：被一圈杂兵包围时没有兵盖在首领身上`, samples.every(x => x.cover.length === 0), { bd: worst.bd, cover: worst.cover.slice(0, 4), n: worst.cover.length });
    ck(`${c.id}：首领几层之间没有插进敌人（层数 ${samples[0].layers + 1}）`, samples.every(x => x.inside.length === 0), samples.find(x => x.inside.length)?.inside.slice(0, 4));
    // 树冠：地图有树时把首领放到最近一棵树正后方，树冠应变半透明（用户 2026-11-18 场景审查 E：11-3 孟获被树冠盖住）
    const tree = await ev(s => { const ts = (s.terrain?.trees ?? []).filter(t => t.img && !t.burnt); if (!ts.length) return null; const p = s.player; ts.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)); const t = ts[0]; window.__tree = t; window.__bossPin = [t.x, t.y - t.size * .4]; s.player.sprite.setPosition(t.x + 400, t.y + 300); return { x: t.x, y: t.y }; });
    if (tree) {
      for (let k = 0; k < 4; k++) { await ev(s => { const [bx, by] = window.__bossPin; s.boss.sprite.setPosition(bx, by); }); await p.waitForTimeout(120); }
      const al = await ev(s => +window.__tree.img.alpha.toFixed(2));
      ck(`${c.id}：站到树后面时树冠变半透明（主将不在旁边）`, al < 1, { alpha: al, tree });
    }
    const pl = samples[samples.length - 1];
    ck(`${c.id}：名牌贴身体最高点上方（或贴顶时放脚下）`, pl.plate && (pl.below || (pl.gap >= 0 && pl.gap <= 30)), pl);
  }
  ck('无 pageerror', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length;
console.log(`SUMMARY: ${rows.length - bad}/${rows.length} passed`);
process.exit(bad ? 1 : 0);
