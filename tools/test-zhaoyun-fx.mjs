// 赵云被动「七进七出」手绘特效（龙鳞层数 / 满层流光 / 触发白龙枪芒 + 绕身一闪 + 突进残影 / 掉层熄灭 / 对象池）。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-zhaoyun-fx.mjs   （需要 ffmpeg 出 GIF：assets/review/hero-fx/zhaoyun-passive.gif）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hero-fx', vid = `${out}/video-zhaoyun-passive`;
rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true }); // 清掉上次的录像，GIF 只取这一次
let pass = 0, fail = 0; const ck = (name, ok, info) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' · ' + JSON.stringify(info)}`); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(), errors = [];
p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1200);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'zhaoyun', weapon: undefined }); window.__prev = s.player; s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prev && s.runConfig?.character === 'zhaoyun' && s.__DEV_ACTIONS && s.zhaoyunFx; }, null, { timeout: 60000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.player.passive.stacks = 0; }, G);
await p.waitForTimeout(400);
const t0 = Date.now();
const r = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, fx = s.zhaoyunFx, ps = pl.passive, w = pl.weapons.find(x => x.id === 'spear_orbit'), wait = ms => new Promise(r => setTimeout(r, ms)), o = {};
  const mk = (x, y) => { const e = s.spawnEnemy('infantry', x, y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } return e; };
  const scales = () => s.children.list.filter(x => x.name?.startsWith('zhaoyun-scale-'));
  o.idle = fx.debug(); o.idleCount = scales().length;
  // 叠层：一层一层点亮（直接拨层数，避免依赖命中节奏）
  for (let k = 1; k <= 3; k++) { ps.stacks = k; await wait(120); }
  await wait(300); o.three = fx.debug(); o.statsLit3 = fx.stats.lit;
  // 位置：都在脚下（不挡人物、不碰头顶标记）
  o.pos = scales().map(x => [Math.round(x.x - pl.x), Math.round(x.y - pl.y), Math.round(x.displayWidth)]);
  // 满层：7 枚一齐流光
  for (let k = 4; k <= 7; k++) { ps.stacks = k; await wait(150); }
  await wait(320); o.full = fx.debug(); await wait(130); o.full2 = fx.debug();
  // 触发：放一个敌人进枪程，等下一枪
  w.cooldownLeft = 0; mk(pl.x + 110, pl.y + 6);
  const b0 = fx.stats.bursts, start = Date.now();
  while (fx.stats.bursts === b0 && Date.now() - start < 5000) await wait(16);
  o.burst = fx.stats.bursts - b0; o.stacksAfter = ps.snapshot(s.combatNow).stacks;
  await wait(60);
  o.during = { dbg: fx.debug(), thrust: s.children.list.filter(x => x.name === 'zhaoyun-fx-zhaoyun_thrust' && x.visible).map(x => [Math.round(x.displayWidth), +x.rotation.toFixed(2)]), aura: s.children.list.filter(x => x.name === 'zhaoyun-fx-zhaoyun_aura' && x.visible).length, ghosts: s.children.list.filter(x => x.name === 'zhaoyun-ghost' && x.visible).length };
  await wait(700); o.after = fx.debug(); o.afterStacks = ps.snapshot(s.combatNow).stacks; o.objs1 = s.children.list.filter(x => /^zhaoyun-(fx|ghost)/.test(x.name)).length;
  // 再叠满、再触发一次：一次性特效走对象池，不新建
  await wait(500); ps.stacks = 7; await wait(400); w.cooldownLeft = 0; const b1 = fx.stats.bursts, st2 = Date.now();
  while (fx.stats.bursts === b1 && Date.now() - st2 < 5000) await wait(16);
  await wait(800); o.objs2 = s.children.list.filter(x => /^zhaoyun-(fx|ghost)/.test(x.name)).length; o.bursts = fx.stats.bursts;
  // 掉层（被动停止 / 换人）：亮着的龙鳞熄灭
  ps.stacks = 4; await wait(400); ps.stop(); await wait(60); o.stopped = fx.debug(); o.outAll = fx.stats.out;
  await wait(500); o.stopped2 = fx.debug();
  // 换成别的武将：龙鳞不显示
  ps.reset('guanyu', s.combatNow); await wait(120); o.other = fx.debug();
  ps.reset('zhaoyun', s.combatNow); await wait(120); o.back = fx.debug();
  return o;
}, G);
const dur = (Date.now() - t0) / 1000;
ck('开局 0 层：脚下 7 枚龙鳞都是熄灭态（帧 0）', r.idleCount === 7 && r.idle.visible && r.idle.modes.every(m => m === 'idle') && r.idle.frames.every(f => f === 0), r.idle);
ck('叠 3 层：前 3 枚点亮（稳定帧 5），其余熄灭，点亮动画播了 3 次', r.three.modes.slice(0, 3).every(m => m === 'lit') && r.three.frames.slice(0, 3).every(f => f === 5) && r.three.modes.slice(3).every(m => m === 'idle') && r.statsLit3 === 3, r);
ck('龙鳞排在脚下前半圈（不挡人物、不碰头顶标记）：都在脚底（原点下 26~42 像素）、左右 ±32 内、每枚 ≤ 16 像素', r.pos.length === 7 && r.pos.every(([dx, dy, w]) => Math.abs(dx) <= 32 && dy >= 26 && dy <= 42 && w <= 16), r.pos);
ck('满 7 层：7 枚一齐流光（第 3 行帧 12–17，逐帧在走）', r.full.modes.every(m => m === 'lit') && r.full.frames.every(f => f >= 12 && f <= 17) && r.full.frames.join() !== r.full2.frames.join(), [r.full, r.full2]);
ck('满层那一枪触发特效：白龙枪芒朝敌人方向（≈0 弧度）+ 白龙绕身 + 疾风拖尾 + 3 个残影；层数清零', r.burst === 1 && r.stacksAfter === 0 && r.during.thrust.length === 1 && Math.abs(r.during.thrust[0][1]) < .4 && r.during.thrust[0][0] <= 300 && r.during.aura === 2 && r.during.ghosts === 3, r.during);
ck('触发后掉层：7 枚龙鳞走熄灭（化光屑；这一枪命中马上又叠 1 层时第 1 枚重新点亮）；之后只有重新叠上的层数亮着，其余回到熄灭态', r.during.dbg.modes.slice(1).every(m => m === 'out') && ['out', 'light'].includes(r.during.dbg.modes[0]) && r.after.modes.every((m, i) => i < r.afterStacks ? m === 'lit' || m === 'light' : m === 'idle' && r.after.frames[i] === 0), [r.during.dbg, r.after, r.afterStacks]);
ck('一次性特效播完回池：0.7 秒后场上没有在播的', r.after.live === 0 && r.after.ghosts === 0 && r.after.pool >= 6, r.after);
ck('对象池复用：第二次触发不新建精灵', r.bursts === 2 && r.objs2 === r.objs1, { objs1: r.objs1, objs2: r.objs2, bursts: r.bursts });
ck('被动停止（掉层）：亮着的 4 枚熄灭，0.5 秒后全是熄灭态', r.stopped.modes.slice(0, 4).every(m => m === 'out') && r.stopped2.modes.every(m => m === 'idle'), [r.stopped, r.stopped2]);
ck('换成别的武将不显示龙鳞，换回赵云重新显示', !r.other.visible && r.back.visible, [r.other.visible, r.back.visible]);
// 「Texture key already in use: bag_*」是重开场景时行囊贴图重复登记（与本特效无关，偶发），不计
const errs = errors.filter(e => !/Texture key already in use: bag_/.test(e));
ck('无页面 / 控制台报错', errs.length === 0, errs.slice(0, 5));
await p.screenshot({ path: `${out}/zhaoyun-passive-desktop.png` }).catch(() => {});
await p.close(); await ctx.close(); await b.close();
try {
  const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
  execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=12,crop=520:340:380:190,scale=520:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', `${out}/zhaoyun-passive.gif`], { stdio: 'ignore' });
  renameSync(webm, `${vid}/zhaoyun-passive.webm`); console.log('GIF:', `${out}/zhaoyun-passive.gif`, dur.toFixed(1) + ' 秒');
} catch (e) { console.log('GIF 失败：', String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
