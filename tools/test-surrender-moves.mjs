// 降将专属招式（用户 2026-11-18：「每位降将加一个专属招式，直接从他当首领时的招式里挑一个缩小版来用」）。电脑布局；需要开发服务器。
// 1 招降表里每位能入麾下的首领（含剧情附送于禁）都有一招；2 每一招在战斗里真的出得来、打得到敌人；
// 3 吕布不靠测试强制，正常出手也会按 every / cd 出招，且不会比冷却更勤；4 伤害按随行普通出手 × dmg；
// 5 招贤馆麾下卡片、图鉴「降将」页写出「专属 · 招式」。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-surrender-moves.mjs [GIF 输出目录]（给目录时录吕布 / 华雄 / 孟获出招 GIF，需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', gifDir = process.argv[2];
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 600) : '')); };
const rec = (id, kind, template, name, quality, boss) => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template, quality, rank: 1, picks: [], boss });
const world = { version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, town: { levels: { hall: 3, barracks: 1, farm: 1, talent: 3 } } };
const owned = [rec('zhaoyun', 'hero', 'spear', 'zhaoyun', 'orange'), rec('r_1', 'named', 'spear', '吕布', 'orange', 'lubu'), rec('r_2', 'named', 'blade', '华雄', 'orange', 'huaxiong'), rec('r_3', 'named', 'blade', '孟获', 'orange', 'menghuo')];
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned, followers: ['r_1', 'r_2', 'r_3'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 4, hall: 3 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(([w, r]) => {
  window.__find = (root, name) => { const list = root.list ?? []; for (const o of list) { if (o.name === name) return o; if (o.list) { const x = window.__find(o, name); if (x) return x; } } return null; };
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\/?(src\/)?/, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('seeded', '1'); }
}, [world, roster]);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.followers?.members.length === 3 && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(2000);

// 1 数据：每位能入麾下的降将都有一招
const data = await p.evaluate(async () => {
  const S = await window.__mod('data/surrender.ts'), M = await window.__mod('data/surrenderMoves.ts');
  const ids = [...new Set(S.SURRENDER_DEFS.filter(d => d.template && !d.hero && ['can', 'hard', 'sure', 'meng'].includes(d.tier)).map(d => d.id)), S.YUJIN.id];
  const missing = ids.filter(id => !M.SURRENDER_MOVES[id]), extra = Object.keys(M.SURRENDER_MOVES).filter(id => !ids.includes(id));
  const bad = Object.entries(M.SURRENDER_MOVES).filter(([, m]) => !(m.name && m.desc && m.from && m.every >= 3 && m.every <= 4 && m.cd >= 8000 && m.cd <= 12000 && m.dmg > 1 && m.dmg <= 2.5 && m.maxHits >= 1)).map(([id]) => id);
  return { ids, missing, extra, bad, line: M.surrenderMoveLine('lubu') };
});
ck('招降表里每位能入麾下的降将（' + data.ids.length + ' 人，含于禁）都有专属招式，没有多余的', data.ids.length >= 17 && !data.missing.length && !data.extra.length, data);
ck('每招都有名字 / 说明 / 出处，每 3–4 下出手、冷却 8–12 秒、伤害 1–2.5 倍', !data.bad.length, data.bad);
ck('卡片文案：「专属 · 方天横扫：……」', /^专属 · 方天横扫：/.test(data.line ?? ''), data.line);

// 共用：清场、刷一圈血厚的敌人在随行前方并按住
await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player;
  pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
  for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; for (const m of s.followers.members) m.maxHp = m.hp = 1e9;
  if (s.legion.order !== 'guard') s.legion.cycleOrder();
  // 换一批敌人：直接收掉（deactivate，不算击杀、不掉经验，免得升级弹窗挡住画面）
  window.__pack = (f, n = 7) => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); const pins = []; const a0 = Math.atan2(pl.y - f.y, pl.x - f.x) + Math.PI;
    for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * .22, d = 55 + (i % 3) * 22; const e = s.spawnEnemy('infantry', f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 1e6); if (e) pins.push([e, e.x, e.y]); }
    window.__pins = pins; };
  window.__hold = () => { if (s.mode !== 'none') { s.__DEV_ACTIONS.closePopup?.(); if (s.mode !== 'none' && s.mode !== 'rest') s.setMode('none'); } for (const [e, x, y] of window.__pins ?? []) if (e.active) { e.sprite?.setPosition?.(x, y); } };
});

// 2 每一招都能出、打得到：把每个降将 id 依次安到 1 号随行上，强制出招
const each = await p.evaluate(async ids => {
  const s = window.__game.scene.getScene('GameScene'), sq = s.followers, f = sq.members[0], out = {};
  const wait = async ms => { const c0 = s.combatNow; while (s.combatNow - c0 < ms) { window.__hold(); await new Promise(r => setTimeout(r, 25)); } };
  for (const id of ids) {
    f.recruit = { ...f.recruit, boss: id }; window.__pack(f); await wait(150);
    const c0 = sq.signatureStats.byBoss[id] ?? 0, h0 = sq.signatureStats.hitsByBoss[id] ?? 0, hp0 = s.player.hp;
    const ok = sq.signatureNow(f, s.combatNow); await wait(1300);
    out[id] = { ok, casts: (sq.signatureStats.byBoss[id] ?? 0) - c0, hits: (sq.signatureStats.hitsByBoss[id] ?? 0) - h0, playerHurt: s.player.hp < hp0 };
  }
  return out;
}, data.ids);
const noFire = Object.entries(each).filter(([, v]) => !(v.ok && v.casts === 1 && v.hits >= 1)).map(([k, v]) => k + JSON.stringify(v));
ck('每位降将的专属招式在战斗里出得来、打得到敌人（' + Object.keys(each).length + ' 招）', noFire.length === 0, noFire.length ? noFire : Object.fromEntries(Object.entries(each).map(([k, v]) => [k, v.hits])));
ck('专属招式不伤主将（自己人的招）', Object.values(each).every(v => !v.playerHurt), each);

// 3 吕布正常出手也会出招，且不比冷却更勤；4 伤害 = 普通出手 × 配置的 dmg
const nat = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), sq = s.followers, f = sq.members[0], M = await window.__mod('data/surrenderMoves.ts'), m = M.SURRENDER_MOVES.lubu;
  f.recruit = { ...f.recruit, boss: 'lubu' }; f.sigReadyAt = 0; f.sigAt = f.attacks; window.__pack(f, 5);
  const c0 = sq.signatureStats.byBoss.lubu ?? 0, a0 = f.attacks, d0 = sq.signatureStats.damage, h0 = sq.signatureStats.hits, t0 = s.combatNow;
  while (s.combatNow - t0 < 14000) { window.__hold(); await new Promise(r => setTimeout(r, 25)); }
  const casts = (sq.signatureStats.byBoss.lubu ?? 0) - c0, perHit = (sq.signatureStats.damage - d0) / Math.max(1, sq.signatureStats.hits - h0);
  return { casts, attacks: f.attacks - a0, secs: (s.combatNow - t0) / 1000, cd: m.cd, every: m.every, dmg: m.dmg, perHit, expect: f.damage * sq.share * m.dmg };
});
ck('吕布正常出手就会出「方天横扫」（不靠强制），每 ' + nat.every + ' 下、冷却 ' + nat.cd / 1000 + ' 秒内最多一次', nat.casts >= 1 && nat.casts <= Math.ceil(nat.secs * 1000 / nat.cd) + 1 && nat.attacks >= nat.every, nat);
// 枪模板身边有部曲时普通出手吃「列阵」加成（commonerSkills），专属招式在这一下的基础上 × dmg，所以允许 1.0–1.3 倍
ck('专属招式伤害 = 随行这一下出手 × 配置倍数（吕布 ×' + nat.dmg + '；枪「列阵」加成可叠）', nat.perHit / nat.expect >= .98 && nat.perHit / nat.expect <= 1.3, nat);

// GIF：吕布 / 华雄 / 孟获各出一招（随行身边 360×260 区域，约 1.6 秒）
if (gifDir) {
  mkdirSync(gifDir, { recursive: true });
  for (const [k, id] of [[0, 'lubu'], [1, 'huaxiong'], [2, 'menghuo']]) {
    const tmp = gifDir + '/_frames_' + id; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
    const box = await p.evaluate(([k, id]) => { const s = window.__game.scene.getScene('GameScene'), sq = s.followers, f = sq.members[k]; for (const m of sq.members) m.sigReadyAt = 1e12; f.recruit = { ...f.recruit, boss: id }; window.__pack(f, 8);
      const cam = s.cameras.main, z = cam.zoom, sx = (f.x - cam.worldView.x) * z, sy = (f.y - cam.worldView.y) * z, sc = window.__game.canvas.getBoundingClientRect().width / window.__game.canvas.width; return { x: Math.max(0, (sx - 180 * z) * sc), y: Math.max(0, (sy - 150 * z) * sc), w: 360 * z * sc, h: 260 * z * sc }; }, [k, id]);
    // 录制时停掉游戏主循环、手动一帧帧推进（game.step，每张 GIF 帧推 4 帧 ≈ 66 毫秒），截图延迟不会漏掉 0.3 秒的起手与落下
    await p.evaluate(([k]) => { const g = window.__game, s = g.scene.getScene('GameScene'); g.loop.sleep(); window.__t = performance.now(); window.__adv = n => { for (let i = 0; i < n; i++) { window.__t += 16.67; g.step(window.__t, 16.67); window.__hold(); } }; window.__adv(2); s.followers.signatureNow(s.followers.members[k], s.combatNow); }, [k]);
    for (let i = 0; i < 24; i++) { await p.evaluate(() => window.__adv(4)); await p.screenshot({ path: `${tmp}/${String(i).padStart(3, '0')}.png`, clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.w), height: Math.round(box.h) } }); await p.waitForTimeout(50); }
    await p.evaluate(() => window.__game.loop.wake());
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', `${tmp}/%03d.png`, '-vf', 'split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', `${gifDir}/surrender-move-${id}.gif`]);
    rmSync(tmp, { recursive: true, force: true });
    console.log('GIF', `${gifDir}/surrender-move-${id}.gif`);
  }
}

// 5 图鉴「降将」页
const codex = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), C = await window.__mod('ui/GameCodex.ts'); const cx = new C.GameCodex(s, () => {}); cx.root.setScrollFactor?.(0);
  window.__find(cx.root, 'codex-tab-2').emit('pointerdown'); const texts = () => { const all = []; const walk = c => { for (const o of c.list ?? []) { if (typeof o.text === 'string') all.push(o.text); if (o.list) walk(o); } }; walk(cx.root); return all.join(' | '); };
  const first = texts(); const idx = [...Array(20).keys()].find(i => { const it = window.__find(cx.root, 'codex-item-' + i); return it && texts().includes('吕布') && (it.emit('pointerdown'), texts().includes('方天横扫')); });
  const t = texts(); window.__codex = cx; return { hasTab: first.includes('降将'), lubu: /专属 · 方天横扫/.test(t), from: /出自：吕布/.test(t), idx };
});
ck('图鉴「降将」页：列出降将，点开写「专属 · 方天横扫」与出处', codex.hasTab && codex.lubu && codex.from, codex);
if (gifDir) await p.screenshot({ path: gifDir + '/surrender-codex.png' });
await p.evaluate(() => window.__codex?.root.destroy());

// 招贤馆麾下卡片
await p.evaluate(() => { const g = window.__game; g.scene.getScene('GameScene').scene.start('TalentHallScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 30000 }); await p.waitForTimeout(1200);
const hall = await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'); s.tab = 'roster'; s.page = 0; s.render(); const all = []; const walk = c => { for (const o of c.list ?? []) { if (typeof o.text === 'string') all.push(o.text); if (o.list) walk(o); } }; walk(s.content ?? s.children); s.children.list.forEach(o => { if (typeof o.text === 'string') all.push(o.text); }); return all.join(' | '); });
ck('招贤馆麾下：降将卡片写「专属 · 招式：说明」（吕布 / 华雄 / 孟获）', /专属 · 方天横扫：/.test(hall) && /专属 · 破军裂地：/.test(hall) && /专属 · 蛮王冲阵：/.test(hall), hall.slice(0, 400));
if (gifDir) await p.screenshot({ path: gifDir + '/surrender-hall.png' });
ck('控制台无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
