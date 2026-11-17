// 录武将攻击特效 GIF（电脑布局）：按 HERO 跑一段固定演示，输出 assets/review/hero-fx/<HERO>-<NAME>.gif（需要开发服务器与 ffmpeg）。
// 用法：BASE=http://127.0.0.1:5173/ HERO=weiyan NAME=before node tools/record-hero-fx-gif.mjs
// HERO：weiyan / machao / huangzhong / sunshangxiang / zhangfei / diaochan / liubei / zhuge
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', HERO = process.env.HERO ?? 'weiyan', NAME = process.env.NAME ?? 'fx';
const out = 'assets/review/hero-fx', vid = `${out}/video-${HERO}-${NAME}`;
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, HERO]);
await p.waitForTimeout(500);
await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, HERO, { timeout: 30000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); }, G);
const t0 = Date.now();
await p.evaluate(async ([G0, hero]) => {
  const s = eval(G0), pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms));
  const mk = (x, y, kind = 'infantry') => { const e = s.spawnEnemy(kind, x, y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } return e; };
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); };
  if (hero === 'weiyan') { for (let i = 0; i < 5; i++) mk(pl.x + 50 + i * 36, pl.y + (i % 2 ? 10 : -10)); for (let i = 0; i < 3; i++) mk(pl.x - 60 - i * 30, pl.y + 20); await wait(3500); pl.passive.stacks = 5; await wait(2200); }
  if (hero === 'machao') { mk(pl.x + 100, pl.y); mk(pl.x + 135, pl.y + 25); mk(pl.x + 130, pl.y - 30); await wait(2600); clear(); await wait(200); pl.heading.x = 1; pl.heading.y = 0; mk(pl.x + 170, pl.y + 10); pl.passive.stacks = 0; await wait(80); w.cooldownLeft = 0; pl.passive.stacks = 6; await wait(2200); }
  if (hero === 'huangzhong') { for (let i = 0; i < 5; i++) mk(pl.x + 300 + (i % 2) * 30, pl.y - 70 + i * 32); pl.growth.masteries.jingxin = 3; await wait(1800); pl.passive.onDamage(s.combatNow); w.cooldownLeft = .3; await wait(150); pl.passive.grantSharp(s.combatNow, 0); await wait(2600); pl.growth.masteries.laoji = 3; const el = mk(pl.x + 220, pl.y + 60, 'elite'); el.hp = 1; await wait(2000); }
  if (hero === 'sunshangxiang') { mk(pl.x + 40, pl.y + 10); mk(pl.x - 45, pl.y - 10); mk(pl.x + 10, pl.y + 50); pl.passive.stacks = 6; w.cooldownLeft = 0; await wait(4200); }
  if (hero === 'zhangfei') { mk(pl.x + 110, pl.y); mk(pl.x + 90, pl.y + 40); mk(pl.x - 100, pl.y); await wait(4200); }
  if (hero === 'diaochan') { mk(pl.x + 150, pl.y); mk(pl.x + 120, pl.y + 50); mk(pl.x - 80, pl.y + 30); await wait(1500); pl.passive.stacks = 5; w.cooldownLeft = 0; await wait(3200); }
  if (hero === 'liubei') { mk(pl.x - 70, pl.y); mk(pl.x + 70, pl.y); await wait(1500); pl.passive.stacks = 4; await wait(2800); }
  if (hero === 'zhuge') { for (let i = 0; i < 4; i++) mk(pl.x + 120 + (i % 2) * 30, pl.y - 30 + i * 22); await wait(4500); }
}, [G, HERO]);
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${HERO}-${NAME}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=10,crop=720:420:280:150,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${HERO}-${NAME}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
