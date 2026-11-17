// 录庞统「凤雏连环令」特效 GIF（电脑布局）：边走边布雷拉铁索 → 敌人踩雷、引信后连环爆炸（火沿铁索走）→ 绕圈铁索连舟地火。
// 输出 assets/review/pangtong-fx/<NAME>.gif（NAME 默认 pangtong-fx）。需要开发服务器与 ffmpeg。
// 用法：BASE=http://127.0.0.1:5173/ NAME=before node tools/record-pangtong-gif.mjs
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/pangtong-fx', vid = out + '/video', NAME = process.env.NAME ?? 'pangtong-fx';
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'pangtong', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'pangtong' && s.__DEV_ACTIONS; }, null, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0), pl = s.player; pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => { x.style.display = 'none'; }); }, G);
const t0 = Date.now();
await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, w = pl.weapons[0];
  const mk = (x, y, stun = true) => { const e = s.spawnEnemy('infantry', x, y, 1); if (e) { e.hp = e.maxHp = 99999; if (stun) e.stunUntil = 1e12; } return e; };
  const walk = (steps, fn) => new Promise(res => { let i = 0; const bait = mk(pl.x, pl.y - 260); const h = setInterval(() => { const q = fn(i++); pl.sprite.x = q.x; pl.sprite.y = q.y; if (bait) { bait.sprite.x = pl.x; bait.sprite.y = pl.y - 260; } if (i === 1) w.cooldownLeft = 0; if (i >= steps) { clearInterval(h); bait?.deactivate(); res(); } }, 50); });
  // 1) Lv3：直线走，布雷拉铁索；然后一名敌人踩第一颗雷 → 引信 → 连环爆炸（火沿铁索走）
  w.level = 3; const x0 = pl.x, y0 = pl.y; w.cooldownLeft = 99;
  await walk(48, i => ({ x: x0 - 180 + i * 8, y: y0 }));
  w.cooldownLeft = 99;
  const mines = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).sort((a, b) => a.x - b.x);
  if (mines[0]) mk(mines[0].x, mines[0].y);
  for (const m of mines.slice(1, 3)) mk(m.x + 30, m.y + 18);
  await new Promise(r => setTimeout(r, 2600));
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  // 2) Lv5：绕一圈，铁索首尾相接 → 圈内地火 → 整圈齐爆
  w.level = 5; const cx = pl.x, cy = pl.y; w.cooldownLeft = 99;
  mk(cx, cy); mk(cx + 20, cy + 25);
  await walk(80, i => { const a = i * 8 / 95; return { x: cx + Math.cos(a) * 95, y: cy + Math.sin(a) * 95 }; });
  w.cooldownLeft = 99;
  await new Promise(r => setTimeout(r, 3800));
}, G);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${NAME}.gif`;
// 跳过加载阶段，只留演示部分；480 宽、10 帧（控制 GIF 体积）
const start = Math.max(0, (Date.now() - t0) / 1000 - dur - 0) ; void start;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=10,crop=880:500:200:110,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${NAME}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
