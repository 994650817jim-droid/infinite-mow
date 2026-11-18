// 障碍物整改第 3、4 批：
//  4-1 白马 / 4-2 延津：北面袁军大营（木栅 + 辕门 + 4 顶营帐，「第 2 波」起营帐出兵、可烧毁、全毁后刷兵变稀），颜良 / 文丑出阵时从辕门杀出，原场中白马城门去掉。
//  2-2 荥阳：四角徐荣伏兵营帐，扬尘示警后伏兵冲出，烧掉营帐断其伏兵；原场中营帐杂物去掉。电脑布局，截图。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-camp-ambush.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/camp-ambush';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const open = async (key, reg, run) => {
    await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'guanduTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [key, reg, run]);
    await p.waitForTimeout(500);
    const S = `window.__game.scene.getScene('${key}')`;
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.sishuiPass; }, S, { timeout: 90000 });
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
    await wait(1500); await ev(s => { s.player.damageImmune = true; });
    return { ev, wait };
  };
  // —— 4-1 白马 / 4-2 延津 ——
  for (const st of [1, 2]) {
    const tag = st === 1 ? '4-1 白马' : '4-2 延津';
    const { ev, wait } = await open('GuanduGameScene', { guanduStage: st }, {});
    for (let i = 0; i < 20 && !(await ev(s => s.sishuiPass.snapshot().tentsPlaced)); i++) await wait(200);
    const lay = await ev(s => ({ ...s.sishuiPass.snapshot(), walls: s.children.list.filter(o => o.name === 'yuan-wall').length, wallTex: s.children.list.find(o => o.name === 'yuan-wall')?.texture.key, gate: s.children.getByName('yuan-gate')?.frame.name, oldGate: s.children.list.some(o => o.texture?.key === 'sishui_props_refined' && (o.frame?.name === 0 || o.frame?.name === 1) && o.y < -150 && o.y > -400) }));
    await ev(s => { s.player.sprite.setPosition(0, -470); }); await wait(700);
    await p.screenshot({ path: `${OUT}/guandu-${st}-camp.png` });
    ck(`${tag}：北面袁军木栅 + 辕门（可通行）+ 4 顶营帐，原场中城门去掉`, lay.walls >= 12 && lay.wallTex === 'props_v2_yuan' && lay.gate === 7 && lay.tents === 4 && lay.towers === 0 && !lay.oldGate && lay.foot === 2, lay);
    await ev(s => { s.devSetTime?.(46); }); await wait(4500);
    const rd = await ev(s => s.sishuiPass.snapshot());
    ck(`${tag}：第 2 波起营帐出兵`, rd.metrics.rides >= 2, rd);
    for (let i = 0; i < 8 && (await ev(s => s.sishuiPass.snapshot().tents)) > 0; i++) { await ev(s => { for (const t of s.sishuiPass.tents) if (t.e?.active) s.hitEnemy(t.e, 1e6, s.combatNow, 'melee', false, false); }); await wait(500); }
    const tn = await ev(s => s.sishuiPass.snapshot());
    ck(`${tag}：营帐全烧 → 刷兵变稀`, tn.tents === 0 && tn.spawnMul > 1.3, tn);
    let up = false;
    for (let i = 0; i < 80 && !up; i++) { up = await ev(s => { if (s.mode === 'story') { for (const c of s.children.list) { const btn = c.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter.waves; s.devSetTime?.(w[w.length - 1].start + 1); } return !!s.boss?.active; }); if (!up) await p.waitForTimeout(200); }
    await wait(300);
    const g = await ev(s => { const gate = s.children.getByName('yuan-gate'); return { open: s.sishuiPass.snapshot().gateOpen, gx: Math.round(gate.x), gy: Math.round(gate.y), bx: Math.round(s.boss.x), by: Math.round(s.boss.y) }; });
    await ev(s => { s.player.sprite.setPosition(0, -470); }); await wait(400);
    await p.screenshot({ path: `${OUT}/guandu-${st}-boss.png` });
    ck(`${tag}：首领出阵 → 从辕门杀出`, g.open && Math.hypot(g.bx - g.gx, g.by - g.gy) < 260, g);
  }
  // —— 2-2 荥阳 ——
  {
    const { ev, wait } = await open('GameScene', {}, { chapter: 'hulao', westStage: 2 });
    for (let i = 0; i < 20 && !(await ev(s => s.sishuiPass.snapshot().tentsPlaced)); i++) await wait(200);
    const lay = await ev(s => ({ ...s.sishuiPass.snapshot(), name: s.chapter.name, walls: s.children.list.filter(o => /-wall$/.test(o.name ?? '')).length, center: s.children.list.filter(o => o.texture?.key === 'sishui_props_refined' && Math.abs(o.x) < 400 && Math.abs(o.y) < 300 && o.type === 'Image' && !s.enemies.some(e => e.sprite === o)).length, spots: s.sishuiPass.tents.map(t => [Math.round(t.x), Math.round(t.y)]) }));
    ck('2-2 荥阳：四角 4 顶伏兵营帐，不画关墙，场中营帐杂物去掉', lay.name.startsWith('2-2') && lay.tents === 4 && lay.walls === 0 && lay.foot === 0 && lay.center === 0 && lay.spots.every(([x]) => Math.abs(x) >= 600), lay);
    await ev(s => { s.devSetTime?.(46); });
    let warned = null;
    for (let i = 0; i < 40 && !warned; i++) { warned = await ev(s => { const m = s.sishuiPass.snapshot().metrics; return m.warns >= 1 ? { m, fx: s.children.list.some(o => o.name === 'xurong-tent-warn') } : null; }); if (!warned) await p.waitForTimeout(150); }
    const t0 = await ev(s => { const t = s.sishuiPass.tents.find(t => t.warned) ?? s.sishuiPass.tents[0]; s.player.sprite.setPosition(t.x + (t.x > 0 ? -260 : 260), t.y + 60); return 0; });
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/xingyang-warn.png` });
    ck('2-2：伏兵出帐前营帐扬尘示警（手绘扬尘）+「营中有伏兵」', warned && warned.fx, warned);
    await wait(1600);
    const rd = await ev(s => s.sishuiPass.snapshot());
    await p.screenshot({ path: `${OUT}/xingyang-burst.png` });
    ck('2-2：示警后伏兵从帐里冲出（每次 3 名）', rd.metrics.rides >= 3, rd);
    for (let i = 0; i < 8 && (await ev(s => s.sishuiPass.snapshot().tents)) > 0; i++) { await ev(s => { for (const t of s.sishuiPass.tents) if (t.e?.active) s.hitEnemy(t.e, 1e6, s.combatNow, 'melee', false, false); }); await wait(500); }
    const r1 = await ev(s => s.sishuiPass.snapshot().metrics.rides); await wait(10000);
    const tn = await ev(s => s.sishuiPass.snapshot());
    ck('2-2：伏兵营帐全烧 → 不再出伏兵、刷兵变稀', tn.tents === 0 && tn.metrics.rides === r1 && tn.spawnMul > 1.3, { r1, tn });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
