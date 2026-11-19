// 2-3 洛阳友军攻势：录「义军小队从后方打掉一座营寨」GIF（电脑布局，需要开发服务器与 ffmpeg）。
// 镜头停在营寨上方（不跟主将），营寨血量先压到 35%（GIF 不至于太长），录像时停刷兵（只看小队行军、砍营寨），放一队义军，录到营寨塌掉。
// 用法：BASE=http://127.0.0.1:5241/ node tools/gif-ally-push.mjs   → assets/review/luoyang/ally-push.gif
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/luoyang', VID = OUT + '/video-push';
mkdirSync(VID, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VID, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); const tPage = Date.now();
await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
await p.goto(BASE + '?dev=1&layout=desktop&story=off');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 3 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene')?.allyPush, null, { timeout: 120000 });
const ev = (fn, a) => p.evaluate(([f, a]) => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 8 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'result' && s.mode !== 'story') s.setMode?.('none'); } } return eval('(' + f + ')')(s, a); }, [String(fn), a]);
await ev(s => { s.player.damageImmune = true; document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none'); });
await p.waitForTimeout(1200);
// 选左下那座营寨：主将走远（右边），镜头钉在营寨南边一点（看得到后方来的义军）
const info = await ev(s => {
  const camps = s.objective.standing, c = camps.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x))[0]; window.__gc = c;
  s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && !e.invulnerable) { e.hp = 0; s.killEnemy(e); } /* 录像时不刷兵：GIF 只看小队走到营寨、砍塌 */ c.hp = Math.round(c.maxHp * .35); s.player.sprite.setPosition(c.x + 120, c.y + 1100);
  s.allyPush.clear(); // 停掉自动出队，下面手动放一队
  const cam = s.cameras.main; s.updateCamera = () => {}; cam.centerOn(c.x, c.y + 70);
  return { x: Math.round(c.x), y: Math.round(c.y), hp: c.hp };
});
await p.waitForTimeout(400);
// 手动放一队（allyPush.clear() 停了自动出队；这里重新开一个只放一次）
const t0 = Date.now();
await ev(s => { const z = s.allyPush; z.h.scene.events.on('update', z.tick, z); z.nextAt = 1e15; z.lastNow = s.combatNow; const q = z.spawn(); q.target = window.__gc; q.life = window.__gc.spawnId; });
let gone = false; for (let i = 0; i < 60 && !gone; i++) { await p.waitForTimeout(250); gone = await ev(s => !window.__gc.active || window.__gc.spawnId !== s.objective.standing.find(e => e === window.__gc)?.spawnId); }
await p.waitForTimeout(1200);
const t1 = Date.now();
const st = await ev(s => ({ ...s.allyPush.stats, destroyed: s.objective.progress }));
console.log('营寨', info, '塌了：', gone, st);
await ctx.close(); await b.close();
const v = readdirSync(VID).find(f => f.endsWith('.webm'));
if (v) {
  const src = `${VID}/${v}`, ss = Math.max(0, (t0 - tPage) / 1000 - .1), dur = (t1 - t0) / 1000 + .3;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss.toFixed(2), '-t', dur.toFixed(2), '-i', src, '-vf', 'fps=10,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', `${OUT}/ally-push.gif`]);
  rmSync(VID, { recursive: true, force: true });
  console.log('GIF：', `${OUT}/ally-push.gif`, '长', dur.toFixed(1), '秒');
}
process.exit(gone ? 0 : 1);
