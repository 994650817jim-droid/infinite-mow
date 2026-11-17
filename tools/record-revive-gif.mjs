// 录随行攻击动作 + 倒地救援的 GIF（电脑布局）：输出 assets/review/recruit/follower-revive.gif。
// 用法：BASE=http://127.0.0.1:5237/ node tools/record-revive-gif.mjs（需要开发服务器与 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit', vid = out + '/video-revive';
mkdirSync(vid, { recursive: true });
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [{ id: 'zhaoyun', kind: 'hero', hero: 'zhaoyun', name: '赵云', template: 'spear', quality: 'orange', rank: 1, picks: [] }, { id: 'guanyu', kind: 'hero', hero: 'guanyu', name: '关羽', template: 'blade', quality: 'orange', rank: 1, picks: [] }, { id: 'r_1', kind: 'common', name: '武璋', template: 'spear', quality: 'green', rank: 1, picks: [] }, { id: 'r_2', kind: 'common', name: '萧朗', template: 'strategist', quality: 'white', rank: 1, picks: [] }], followers: ['guanyu', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.addInitScript(([r, w]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [roster, world]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const t0 = Date.now();
const log = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, f = s.followers, o = {};
  pl.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.weapons = []; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
  const frame = () => new Promise(r => requestAnimationFrame(r)), wait = ms => new Promise(r => setTimeout(r, ms));
  const walk = async (dx, dy, ms, speed = 2.4) => { const t = performance.now(); while (performance.now() - t < ms) { pl.sprite.setPosition(pl.x + dx * speed, pl.y + dy * speed); await frame(); } };
  // 1) 敌人围上来：三名随行出手（关羽自己的刀；武璋长枪兵攻击帧；萧朗军医施术）
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; s.spawnEnemy('infantry', pl.x + Math.cos(a) * 120, pl.y + Math.sin(a) * 120, 6); }
  await wait(2600);
  // 2) 关羽、武璋被打倒，倒在原地
  const gy = f.members[0], wz = f.members[1]; f.hurt(gy, 1e6, s.combatNow); f.hurt(wz, 1e6, s.combatNow);
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
  await wait(900);
  // 3) 主将先走开（倒地者留在原地），再回到关羽身边站满 5 秒救起
  await walk(1, 0, 900); await wait(300);
  const tx = gy.x + 26, ty = gy.y; while (Math.hypot(pl.x - tx, pl.y - ty) > 4) { const d = Math.hypot(tx - pl.x, ty - pl.y), st = Math.min(d, 2.6); pl.sprite.setPosition(pl.x + (tx - pl.x) / d * st, pl.y + (ty - pl.y) / d * st); await frame(); }
  const c0 = s.combatNow; while (gy.downed && s.combatNow - c0 < 8000) await frame();
  o.reviveSec = Math.round((s.combatNow - c0) / 100) / 10; o.hp = Math.round(gy.hp / gy.maxHp * 100);
  // 4) 救起后继续出手
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; s.spawnEnemy('infantry', pl.x + Math.cos(a) * 110, pl.y + Math.sin(a) * 110, 5); }
  await wait(1800);
  return o;
});
console.log(JSON.stringify(log));
const elapsed = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop();
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm]).toString().trim());
const ss = Math.max(0, dur - elapsed - .2).toFixed(2);
execFileSync('ffmpeg', ['-y', '-ss', ss, '-i', webm, '-vf', 'fps=9,scale=600:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=80[p];[b][p]paletteuse=dither=bayer:bayer_scale=5', out + '/follower-revive.gif'], { stdio: 'ignore' });
renameSync(webm, out + '/follower-revive.webm');
console.log('gif ok', ss, dur);
