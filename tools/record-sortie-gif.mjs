// 录随行「护阵 → 出击 → 护阵」GIF（电脑布局）：输出 assets/review/recruit/follower-sortie.gif。
// 用法：BASE=... node tools/record-sortie-gif.mjs（需要开发服务器与 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit', vid = out + '/video-sortie';
rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true });
const rec = (id, kind = 'hero', template = 'spear', name = id, quality = 'orange') => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template, quality, rank: 1, picks: [] });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [rec('zhaoyun'), rec('guanyu'), rec('r_1', 'common', 'spear', '武璋', 'green'), rec('r_2', 'common', 'bow', '萧朗', 'white')], followers: ['guanyu', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const t0 = Date.now();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.addInitScript(([r, w]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [roster, world]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const start = (Date.now() - t0) / 1000;
const log = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, sq = s.followers, o = [];
  pl.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = [];
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; for (const m of sq.members) m.maxHp = m.hp = 1e9;
  if (s.legion.order !== 'guard') s.legion.cycleOrder();
  const label = s.add.text(pl.x, pl.y - 120, '', { fontFamily: 'sans-serif', fontSize: '20px', color: '#ffe9b0', backgroundColor: '#2a1408cc', padding: { x: 8, y: 3 } }).setOrigin(.5).setDepth(9999);
  const wait = ms => new Promise(r => setTimeout(r, ms)), d = () => Math.max(...sq.members.map(m => Math.round(Math.hypot(m.x - pl.x, m.y - pl.y))));
  // 敌人：右上一名精锐、左下一群小兵（按住不动，免得冲到主将身边）
  s.spawnEnemy('elite', pl.x + 200, pl.y - 150, 30); for (let i = 0; i < 6; i++) s.spawnEnemy('infantry', pl.x - 180 - (i % 3) * 26, pl.y + 120 + Math.floor(i / 3) * 30, 12);
  const pins = s.enemies.filter(e => e.active && !e.isSupplySlot).map(e => [e, e.x, e.y]);
  const hold = async ms => { const t = performance.now(); let m = 0; while (performance.now() - t < ms) { for (const [e, x, y] of pins) if (e.active) e.sprite.setPosition(x, y); await wait(30); m = Math.max(m, d()); } return m; };
  label.setText('护阵（E）'); o.push(['护阵', await hold(2200)]);
  s.legion.cycleOrder(); label.setText('出击（E）'); o.push(['出击', await hold(3800)]);
  s.legion.cycleOrder(); label.setText('护阵（E）'); o.push(['护阵', await hold(2000)]);
  return o;
});
const end = (Date.now() - t0) / 1000;
console.log(JSON.stringify(log));
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop();
execFileSync('ffmpeg', ['-y', '-ss', start.toFixed(2), '-t', (end - start).toFixed(2), '-i', webm, '-vf', 'fps=9,crop=800:450:240:135,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=5', out + '/follower-sortie.gif'], { stdio: 'ignore' });
rmSync(vid, { recursive: true, force: true });
console.log('gif ok');
