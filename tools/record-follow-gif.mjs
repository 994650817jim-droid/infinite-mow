// 录随行紧贴跟随的 GIF（电脑布局）：主公走方形路线，途中刷敌人；输出 assets/review/recruit/follow-tight.gif 并打印实测距离。
// 用法：BASE=http://127.0.0.1:5237/ node tools/record-follow-gif.mjs（需要开发服务器与 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit', vid = out + '/video';
mkdirSync(vid, { recursive: true });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [{ id: 'zhaoyun', kind: 'hero', hero: 'zhaoyun', name: '赵云', template: 'spear', quality: 'orange', rank: 1, picks: [] }, { id: 'zhangfei', kind: 'hero', hero: 'zhangfei', name: '张飞', template: 'spear', quality: 'orange', rank: 1, picks: [] }, { id: 'r_1', kind: 'common', name: '王勇', template: 'bow', quality: 'green', rank: 1, picks: [] }, { id: 'r_2', kind: 'named', name: '张郃', template: 'blade', quality: 'purple', rank: 1, picks: [] }], followers: ['zhangfei', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.addInitScript(([r, w]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [roster, world]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => x.style.display = 'none'); });
const t0 = Date.now();
const stats = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, f = s.followers; let max = 0, sum = 0, n = 0;
  const leg = async (dx, dy, ms, spawn) => {
    if (spawn) for (let i = 0; i < 6; i++) s.spawnEnemy('infantry', pl.x + dx * 60 + (i - 2.5) * 30, pl.y + dy * 60 + (i % 2) * 40 - 20, 2);
    const t = performance.now(); while (performance.now() - t < ms) { pl.sprite.setPosition(pl.x + dx * 3.6, pl.y + dy * 3.6); await new Promise(r => requestAnimationFrame(r)); for (const m of f.members) { const d = Math.hypot(m.x - pl.x, m.y - pl.y); max = Math.max(max, d); sum += d; n++; } }
  };
  await leg(1, 0, 1600, false); await leg(0, 1, 1100, true); await leg(-1, 0, 1600, true); await leg(0, -1, 1100, false);
  await new Promise(r => setTimeout(r, 1200));
  return { max: Math.round(max), avg: Math.round(sum / Math.max(1, n)), hits: f.stats.hits, teleports: f.stats.teleports, rest: f.members.map(m => Math.round(Math.hypot(m.x - pl.x, m.y - pl.y))) };
});
console.log(JSON.stringify(stats));
const elapsed = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop();
const startAt = Math.max(0, (await import('node:fs')).statSync(webm) && 0);
// 只取最后 elapsed 秒（前面是加载画面）
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm]).toString().trim();
const ss = Math.max(0, Number(dur) - elapsed - .2).toFixed(2);
execFileSync('ffmpeg', ['-y', '-ss', ss, '-i', webm, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', out + '/follow-tight.gif'], { stdio: 'ignore' });
renameSync(webm, out + '/follow-tight.webm');
console.log('gif ok', ss, dur, startAt);
