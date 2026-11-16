// 主将步态（src/systems/WalkGait.ts）：行走帧随移动推进、步频与移速挂钩（上限 15 帧/秒）、身体起伏与阴影变化、
// 斜向优先侧面帧、停下后四个方向都回到站立帧、落脚扬尘。逐帧 game.step（固定 60fps），不受机器负载影响。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5197/ node tools/test-walk-anim.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const CASES = [
  { hero: 'zhaoyun', weapon: 'spear_orbit', layout: 'mobile', view: { width: 390, height: 844 } },
  { hero: 'guanyu', weapon: 'guandao', layout: 'desktop', view: { width: 1280, height: 720 } },
  { hero: 'diaochan', weapon: 'flame_banner', layout: 'mobile', view: { width: 390, height: 844 } },
];
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const c of CASES) {
  const tag = `${c.hero}(${c.layout})`;
  const p = await b.newPage({ viewport: c.view });
  p.on('pageerror', e => errors.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(tag + ' ' + m.text()); });
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${c.layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(([G0, id, w]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: w }); s.scene.restart(); }, [G, c.hero, c.weapon]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, c.hero, { timeout: 60000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await p.waitForTimeout(400);
  // 接管时钟与输入；普攻帧会覆盖行走帧，这里把武器冷却压住，只看行走层
  await p.evaluate(G0 => {
    const g = window.__game, s = eval(G0); g.loop.sleep(); window.__T = performance.now(); window.__v = new Phaser.Math.Vector2(0, 0);
    s.readMove = () => window.__v.clone().normalize();
    window.__run = (vx, vy, n, hold = true) => { window.__v.set(vx, vy); const rows = [];
      // 不压冷却时放一个原地不动的木桩在主将前方，让普攻在行走中出手
      let dummy = null; if (!hold) { for (const w of s.player.weapons) w.cooldownLeft = 0; dummy = s.spawnEnemy('infantry', s.player.x + 60, s.player.y, 1); if (dummy) { dummy.hp = dummy.maxHp = 1e9; dummy.speed = 0; } }
      for (let i = 0; i < n; i++) { window.__T += 1000 / 60; if (hold) for (const w of s.player.weapons) w.cooldownLeft = 99; g.step(window.__T, 1000 / 60); if (dummy?.active) { dummy.sprite.x = s.player.x + 60; dummy.sprite.y = s.player.y; dummy.hp = 1e9; }
        for (const e of s.enemies) if (e.active && !e.isSupplySlot && e !== dummy) e.hp = 0;
        const pl = s.player, sp = pl.sprite; rows.push({ f: String(sp.frame.name), tex: sp.texture.key, oy: sp.originY, dh: sp.displayHeight, sx: sp.scaleX, sy: sp.scaleY, rot: sp.rotation, shW: pl.shadow.displayWidth, x: pl.x, fps: pl.gait.fps, amount: pl.gait.amount, dust: pl.gait.activeDust, act: pl.currentAction, steps: pl.gait.steps }); }
      if (dummy) dummy.hp = 0; return rows; };
  }, G);
  const run = (vx, vy, n, hold = true) => p.evaluate(([a, b2, n2, h]) => window.__run(a, b2, n2, h), [vx, vy, n, hold]);
  const walkFrames = rows => rows.filter(r => /^(down|up|left|right)_\d$/.test(r.f)).map(r => r.f);

  // 1. 行走帧推进：右走 1.5 秒，4 帧都出现、按顺序循环
  const right = await run(1, 0, 90);
  const rf = walkFrames(right), uniq = [...new Set(rf)].sort();
  const changes = rf.filter((f, i) => i && f !== rf[i - 1]).length;
  ck(`${tag}：向右行走帧推进（4 帧循环，1.5 秒内换帧 ≥12 次）`, uniq.join() === 'right_0,right_1,right_2,right_3' && changes >= 12, { uniq, changes });

  // 2. 步频与移速挂钩：基础 / ×1.3 / ×1.6（上限 14 帧/秒）
  const fpsAt = async mul => { await p.evaluate(([G0, m]) => { const s = eval(G0); s.player.stats.moveMul = m; }, [G, mul]); const r = await run(1, 0, 40); return { fps: r.at(-1).fps, speed: await p.evaluate(G0 => eval(G0).player.speed, G) }; };
  const f1 = await fpsAt(1), f13 = await fpsAt(1.3), f16 = await fpsAt(1.6);
  await p.evaluate(G0 => { eval(G0).player.stats.moveMul = 1; }, G);
  const ratio = f13.fps / f1.fps, sratio = f13.speed / f1.speed;
  ck(`${tag}：步频随移速提高（×1.3 移速 → 步频 ×${ratio.toFixed(2)}），且不超过 15 帧/秒`, f1.fps >= 6 && f1.fps <= 14 && (Math.abs(ratio - sratio) < .03 || f13.fps === 15) && f16.fps <= 15 && f16.fps >= f13.fps, { f1, f13, f16 });

  // 3. 身体起伏、落脚压扁、阴影随步伐变化、横向前倾
  const steady = (await run(1, 0, 60)).filter(r => !r.act);
  const lifts = steady.map(r => (r.oy - .5) * r.dh); // 抬起像素（含基准锚点偏移）
  const liftRange = Math.max(...lifts) - Math.min(...lifts), shRange = Math.max(...steady.map(r => r.shW)) - Math.min(...steady.map(r => r.shW));
  const syRange = Math.max(...steady.map(r => r.sy)) / Math.min(...steady.map(r => r.sy)) - 1, lean = Math.max(...steady.map(r => r.rot));
  ck(`${tag}：行走时身体上下起伏 ≥1.3px、阴影宽度变化 ≥3px、落脚压扁、向右前倾`, liftRange >= 1.3 && shRange >= 3 && syRange > .015 && lean > .02, { liftRange: +liftRange.toFixed(2), shRange: +shRange.toFixed(2), syRange: +syRange.toFixed(3), lean: +lean.toFixed(3) });
  const dustWalking = Math.max(...steady.map(r => r.dust));
  ck(`${tag}：落脚扬尘`, dustWalking >= 1, { dustWalking, steps: steady.at(-1).steps });

  // 4. 斜向优先侧面帧
  const dr = walkFrames(await run(1, 1, 40)), dl = walkFrames(await run(-1, -1, 40));
  ck(`${tag}：斜向移动用侧面行（右下 → right_*，左上 → left_*）`, dr.slice(5).every(f => f.startsWith('right_')) && dl.slice(5).every(f => f.startsWith('left_')), { dr: [...new Set(dr)], dl: [...new Set(dl)] });

  // 5. 停下：四个方向都回到站立帧（朝下有待机动作时播待机帧），起伏在 0.25 秒内归零，扬尘散去
  const stops = {};
  for (const [dir, v] of [['right', [1, 0]], ['left', [-1, 0]], ['up', [0, -1]], ['down', [0, 1]]]) {
    await run(v[0], v[1], 23);
    const st = await run(0, 0, 40);
    const first = st[1], last = st.at(-1);
    const standing = r => r.f === `${dir}_0` || (dir === 'down' && r.tex.endsWith('_actions'));
    stops[dir] = { first: first.f, last: last.f, amount: +last.amount.toFixed(2), sy: +last.sy.toFixed(4), rot: last.rot, dust: last.dust, lift: +((st[15].oy - .5) * st[15].dh).toFixed(2) };
    stops[dir].ok = standing(first) && standing(last) && last.amount === 0 && last.rot === 0 && last.dust === 0;
  }
  ck(`${tag}：停下后四个方向都回到站立帧、姿态复原`, Object.values(stops).every(s => s.ok), stops);

  // 6. 移动中出手：攻击帧也随步伐起伏
  const atk = (await run(1, 0, 120, false)).filter(r => r.act === 'attack');
  const atkLift = atk.length ? Math.max(...atk.map(r => r.oy * r.dh)) - Math.min(...atk.map(r => r.oy * r.dh)) : 0;
  ck(`${tag}：移动中攻击帧也带起伏`, atk.length >= 5 && atkLift > .5, { attackFrames: atk.length, atkLift: +atkLift.toFixed(2) });
  await p.close();
}
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
