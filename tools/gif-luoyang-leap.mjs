// 2-3 洛阳：录「吕布跃下城头」GIF + 城头特写截图 + 城下战吕布时的行走帧检查（电脑布局，需要开发服务器与 ffmpeg）。
// 用法：BASE=http://127.0.0.1:5241/ node tools/gif-luoyang-leap.mjs   → assets/review/luoyang/{wall-close.png, lubu-leap.gif}
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/luoyang', VID = OUT + '/video';
mkdirSync(VID, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VID, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); const tPage = Date.now(); // 录像从这一刻起
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(BASE + '?dev=1&layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene')?.dzLubu, null, { timeout: 120000 });
const ev = (fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
await ev(s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none'); });
// 主将站到城墙下（城门右边），镜头上让后城头的董卓、吕布都在画面里
await ev(s => { const z = s.dzLubu; s.player.sprite.setPosition(z.dongzhuo.x + 330, z.dongzhuo.y + 260); });
for (let i = 0; i < 10; i++) { await ev(s => { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && e !== s.dzLubu.lubu) e.hp = 0; }); await p.waitForTimeout(200); }
await p.screenshot({ path: `${OUT}/wall-close.png` });
const t0 = Date.now();
await ev(s => { for (const t of [...s.objective.targets]) if (t.e.active) { t.e.hp = 0; s.killEnemy(t.e); } });
await p.waitForTimeout(2600);
const t1 = Date.now();
// 城下战吕布：行走帧有没有在换（用户「吕布不会动」）
const frames = new Set(); for (let i = 0; i < 20; i++) { const f = await ev(s => { const l = s.dzLubu.lubu; return l?.active ? String(l.sprite.frame.name) + '@' + Math.round(l.x) : null; }); if (f) frames.add(f.split('@')[0]); await p.waitForTimeout(150); }
console.log('城下吕布行走帧：', [...frames].join(' '), frames.size >= 3 ? 'OK（在换帧）' : 'FROZEN?');
const startSec = Math.max(0, (t0 - Date.now()) / 1000);
await ctx.close(); await b.close();
const v = readdirSync(VID).find(f => f.endsWith('.webm'));
if (v) {
  const src = `${VID}/${v}`, dur = (t1 - t0) / 1000 + .6;
  // 视频从页面打开算起：取跃下前 0.3 秒开始的 dur 秒
  const ss = Math.max(0, (t0 - tPage) / 1000 - .2);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(ss.toFixed(2)), '-t', String(dur.toFixed(2)), '-i', src, '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', `${OUT}/lubu-leap.gif`]);
  renameSync(src, `${OUT}/lubu-leap.webm`); rmSync(VID, { recursive: true, force: true });
  console.log('GIF：', `${OUT}/lubu-leap.gif`, '起点', ss.toFixed(2), '秒，长', dur.toFixed(2), '秒');
}
void startSec;
