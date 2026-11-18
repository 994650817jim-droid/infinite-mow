// 录无名随行（枪 / 刀 / 弓 / 谋）出手特效与混合伤害数字 GIF（电脑布局）。随行上限 3 人：刀 / 弓 / 谋，后半段刀客改成枪的出手。输出 assets/review/follower-dmg/<NAME>.gif。
// 用法：BASE=http://127.0.0.1:5173/ NAME=before node tools/record-follower-dmg-gif.mjs（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', NAME = process.env.NAME ?? 'follower-dmg', out = 'assets/review/follower-dmg', vid = `${out}/video-${NAME}`;
mkdirSync(vid, { recursive: true });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const heroes = { version: 1, migrated: true, attrSet: 3, heroes: {} };
const rec = (id, template) => ({ id, kind: 'common', name: { spear: '枪兵甲', blade: '刀客乙', bow: '弓手丙', strategist: '谋士丁' }[template], template, quality: 'blue', rank: 1, picks: [] });
const owned = [{ id: 'zhaoyun', kind: 'hero', hero: 'zhaoyun', name: 'zhaoyun', template: 'spear', quality: 'orange', rank: 1, picks: [] }, rec('r_1', 'spear'), rec('r_2', 'blade'), rec('r_3', 'bow'), rec('r_4', 'strategist')];
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned, followers: ['r_2', 'r_3', 'r_4'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 3 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.addInitScript(([w, h, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_heroes_v1', JSON.stringify(h)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, heroes, roster]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1500);
// 同 test-follower-weapons：写入名册后重启战斗，随行才按名册生成
await p.evaluate(r => { localStorage.setItem('im_roster_v1', JSON.stringify(r)); const s = window.__game.scene.getScene('GameScene'); window.__prevPlayer = s.player; s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'zhaoyun', weapon: undefined }); s.scene.restart(); }, roster);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prevPlayer && s.__DEV_ACTIONS && (s.followers?.members.length ?? 0) === 3; }, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const t0 = Date.now();
await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms));
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.spawnGem = () => {}; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40);
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
  for (const w of pl.weapons) w.cooldownLeft = 1e9; // 主将先不出手，只看随行
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, e = s.spawnEnemy('infantry', pl.x + Math.cos(a) * 110, pl.y + Math.sin(a) * 80, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } }
  await wait(2400);
  { const m = s.followers.members.find(x => x.template === 'blade'); if (m) m.template = 'spear'; } // 随行上限 3 人：后半段把刀客换成枪的出手，四种兵器都录到
  await wait(2200);
  // 混合伤害数字：普通、暴击、技艺法术、首领、治疗
  for (const w of pl.weapons) w.cooldownLeft = 0;
  const e0 = s.enemies.find(e => e.active && !e.isSupplySlot);
  for (let i = 0; i < 6; i++) { s.debugCrit = i % 3 === 0; s.hitEnemy(e0, 20 + i * 7, s.combatNow, 'melee', false, true); s.debugCrit = null; s.hitEnemy(e0, 14, s.combatNow, 'fire', false, false); pl.hp = Math.max(1, pl.hp - 8); pl.heal(6); await wait(260); }
  s.spawnBoss(); const boss = s.boss; boss.sprite.setPosition(pl.x + 70, pl.y - 30); boss.maxHp = boss.hp = 99999;
  for (let i = 0; i < 6; i++) { s.debugCrit = i % 2 === 0; s.hitEnemy(boss, 60 + i * 11, s.combatNow, 'melee', false, true); s.debugCrit = null; await wait(300); }
  await wait(1200);
});
const dur = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const gif = `${out}/${NAME}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur - .3), '-i', webm, '-vf', 'fps=12,crop=720:440:280:140,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=110:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${NAME}.webm`);
console.log('GIF:', gif, '时长', dur.toFixed(1), '秒');
