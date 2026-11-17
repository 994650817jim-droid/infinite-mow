// 随行攻击动作 + 倒地救援（用户 2026-11-17）。电脑布局；需要开发服务器。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-follower-revive.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [{ id: 'zhaoyun', kind: 'hero', hero: 'zhaoyun', name: '赵云', template: 'spear', quality: 'orange', rank: 1, picks: [] }, { id: 'guanyu', kind: 'hero', hero: 'guanyu', name: '关羽', template: 'blade', quality: 'orange', rank: 1, picks: [] }, { id: 'r_1', kind: 'common', name: '武璋', template: 'spear', quality: 'green', rank: 1, picks: [] }, { id: 'r_2', kind: 'common', name: '萧朗', template: 'strategist', quality: 'white', rank: 1, picks: [] }], followers: ['guanyu', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await p.addInitScript(([r, w]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [roster, world]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const G = "window.__game.scene.getScene('GameScene')";
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.weapons = []; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
const spawnRing = (r = 110, n = 12, hp = 8) => p.evaluate(([G0, r, n, hp]) => { const s = eval(G0), pl = s.player; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; s.spawnEnemy('infantry', pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, hp); } }, [G, r, n, hp]);

// 1. 攻击动作：三名随行出手时都切到攻击帧
await spawnRing();
const anim = await p.evaluate(async G0 => {
  const s = eval(G0), f = s.followers, seen = f.members.map(() => new Set()); const t0 = performance.now();
  while (performance.now() - t0 < 3500) { await new Promise(r => requestAnimationFrame(r)); f.members.forEach((m, i) => seen[i].add(m.sprite.texture.key.replace(/^readable_/, ''))); }
  return f.members.map((m, i) => ({ name: m.recruit.name, keys: [...seen[i]], hits: m.hits }));
}, G);
ck('名将关羽随行出手播自己的攻击动作（guanyu_actions）', anim[0].keys.includes('guanyu_actions') && anim[0].hits > 0, anim[0]);
ck('无名之辈武璋（枪）出手播长枪兵 v2 攻击帧（复用）', anim[1].keys.includes('shu_spearman_attack_sheet') && anim[1].hits > 0, anim[1]);
ck('无名之辈萧朗（谋）用军医长袍形象，出手播军医施术动作（复用）', anim[2].keys.includes('legion_medic_walk') && anim[2].keys.includes('legion_medic_action'), anim[2]);

// 2. 倒地：关羽播倒地动作定格，武璋（兵种）侧倒；原地不动、不攻击、不再受伤
const down = await p.evaluate(async G0 => {
  const s = eval(G0), f = s.followers, gy = f.members[0], wz = f.members[1];
  f.hurt(gy, 1e6, s.combatNow); f.hurt(wz, 1e6, s.combatNow);
  s.player.sprite.setPosition(s.player.x + 300, s.player.y); // 主将走开，免得马上被救
  const pos = [gy.x, gy.y], hits0 = gy.hits + wz.hits, downs0 = f.stats.downs;
  await new Promise(r => setTimeout(r, 1500));
  f.hurt(gy, 50, s.combatNow);
  return { gyDown: gy.downed, gyKey: gy.sprite.texture.key.replace(/^readable_/, ''), gyHold: gy.act?.hold, wzAngle: Math.round(wz.sprite.angle), wzDown: wz.downed, moved: Math.hypot(gy.x - pos[0], gy.y - pos[1]), hitsGain: gy.hits + wz.hits - hits0, hp: gy.hp, downsGain: f.stats.downs - downs0, vis: gy.sprite.visible && wz.sprite.visible, mark: !!gy.mark?.visible };
}, G);
ck('关羽倒地：播倒地动作并定格（guanyu_actions），原地不动、不消失', down.gyDown && down.gyKey === 'guanyu_actions' && down.gyHold && down.moved < 1 && down.vis, down);
ck('武璋倒地：兵种没有倒地帧，复用站立帧侧倒', down.wzDown && Math.abs(down.wzAngle) >= 80, down);
ck('倒地期间不攻击、不被补刀（再挨打生命仍 0、不重复记倒地），头上有「救」字', down.hitsGain === 0 && down.hp === 0 && down.downsGain === 0 && down.mark, down);
await p.screenshot({ path: `${out}/revive-downed-desktop.png` });

// 3. 救援读条：站在身边进度涨，离开按时长回退（不清零），满 5 秒救起，带 40% 生命
const res = await p.evaluate(async G0 => {
  const s = eval(G0), f = s.followers, gy = f.members[0], pl = s.player, o = {};
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
  const wait = async ms => { const c0 = s.combatNow; while (s.combatNow - c0 < ms) await new Promise(r => setTimeout(r, 40)); };
  pl.sprite.setPosition(gy.x + 30, gy.y); await wait(2500);
  o.p1 = +gy.reviveProgress.toFixed(2); o.ring = s.children.getByName('follower-rescue-text')?.visible; o.text = s.children.getByName('follower-rescue-text')?.text;
  pl.sprite.setPosition(gy.x + 200, gy.y); await wait(1000);
  o.p2 = +gy.reviveProgress.toFixed(2); o.ringGone = !s.children.getByName('follower-rescue-text')?.visible;
  pl.sprite.setPosition(gy.x + 30, gy.y); const c0 = s.combatNow;
  while (gy.downed && s.combatNow - c0 < 8000) await new Promise(r => setTimeout(r, 40));
  o.more = Math.round((s.combatNow - c0) / 100) / 10; o.up = !gy.downed; o.hp = Math.round(gy.hp / gy.maxHp * 100); o.revives = f.stats.revives;
  return o;
}, G);
ck('站在身边 2.5 秒：进度约 2.5 秒，主将头顶出现「救援 关羽」读条', Math.abs(res.p1 - 2.5) <= .4 && res.ring && /救援 关羽/.test(res.text ?? ''), res);
ck('离开 1 秒：进度回退约 1 秒（不清零），读条消失', res.p2 > .8 && Math.abs(res.p1 - res.p2 - 1) <= .4 && res.ringGone, res);
ck('回到身边再站满剩下的时间就救起，带 40% 生命', res.up && Math.abs(res.more - (5 - res.p2)) <= .5 && res.hp === 40 && res.revives >= 1, res);

// 4. 屏幕外方向箭头
const arrow = await p.evaluate(async G0 => {
  const s = eval(G0), f = s.followers, xl = f.members[2]; f.hurt(xl, 1e6, s.combatNow);
  s.player.sprite.setPosition(xl.x + 1400, xl.y); await new Promise(r => setTimeout(r, 600));
  const t = xl.arrowText, cam = s.cameras.main;
  const v = cam.worldView; // 箭头在世界坐标里，按可见范围核对（换算成相对可见范围左上角的像素）
  return { vis: !!t?.visible, rx: Math.round((t?.x ?? -1e4) - v.x), ry: Math.round((t?.y ?? -1e4) - v.y), vw: Math.round(v.width), vh: Math.round(v.height), inView: v.contains(xl.x, xl.y) };
}, G);
await p.screenshot({ path: `${out}/revive-arrow-desktop.png` });
ck('倒地武将在屏幕外：屏幕左边缘出「救」方向箭头，完整在画面内', arrow.vis && !arrow.inView && arrow.rx >= 10 && arrow.rx < arrow.vw * .15 && arrow.ry >= 10 && arrow.ry <= arrow.vh - 10, arrow);

// 5. 救起后的关羽恢复出手
await p.evaluate(G0 => { const s = eval(G0), gy = s.followers.members[0]; s.player.sprite.setPosition(gy.x + 40, gy.y); }, G);
await spawnRing(100, 10, 6);
const after = await p.evaluate(async G0 => { const s = eval(G0), gy = s.followers.members[0], h0 = gy.hits; await new Promise(r => setTimeout(r, 2500)); return { gain: gy.hits - h0, downed: gy.downed }; }, G);
ck('救起后的关羽恢复出手', !after.downed && after.gain > 0, after);

ck('无页面 / 控制台报错', errors.length === 0, errors.slice(0, 6));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
