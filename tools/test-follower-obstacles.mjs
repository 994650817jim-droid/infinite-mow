// 随行认所有障碍（场景审查 B，用户 2026-11-18「随从站进城墙里」）：把随行武将直接放进障碍里，几帧后都应被推到障碍外。
// 关：1-1 广宗外围（树干）、2-1 汜水关（关墙 + 两端崖壁）、2-3 洛阳（董卓城墙）、7-2 落凤坡（山崖）、9-2 水淹七军（洪水边界）、9-3 麦城（突围通道）。
// 用法：BASE=http://127.0.0.1:5212/ node tools/test-follower-obstacles.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const rec = (id, kind = 'hero', template = 'spear', name = id, quality = 'orange') => ({ id, kind, hero: kind === 'hero' ? id : undefined, name, template, quality, rank: 1, picks: [] });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const roster = { version: 1, lord: 'zhaoyun', lordFinal: true, owned: [rec('zhaoyun'), rec('guanyu'), rec('r_1', 'common', 'spear', '武璋', 'green'), rec('r_2', 'common', 'bow', '萧朗', 'white')], followers: ['guanyu', 'r_1', 'r_2'], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 2, hall: 3 };
const CASES = [
  { key: '1-1 广宗外围（树干）', scene: 'GameScene', run: { chapter: 'huangjin', stage: 1 }, reg: {}, src: 'trees' },
  { key: '2-1 汜水关（关墙 / 崖壁）', scene: 'GameScene', run: { chapter: 'hulao', westStage: 1 }, reg: {}, src: 'boxes' },
  { key: '2-3 洛阳（董卓城墙）', scene: 'GameScene', run: { chapter: 'hulao', westStage: 3 }, reg: {}, src: 'dz' },
  { key: '7-2 落凤坡（山崖）', scene: 'ShuGameScene', run: { thirdStage: 2 }, reg: { shuStage: 2 }, src: 'boxes' },
  { key: '9-2 水淹七军（洪水边界）', scene: 'XiangfanGameScene', run: { thirdStage: 2 }, reg: { xiangfanStage: 2 }, src: 'boxes' },
  { key: '9-3 麦城（突围通道）', scene: 'XiangfanGameScene', run: { thirdStage: 3 }, reg: { xiangfanStage: 3 }, src: 'boxes' },
  // 场景审查 P3 新加的实心布景（content 会话）：每个碰撞框都试一遍（框的北边缘往里 10 像素当靶）
  { key: '1-2 下曲阳（张宝法坛营）', scene: 'GameScene', run: { chapter: 'huangjin', stage: 2 }, reg: {}, src: 'all' },
  { key: '5-2 赤壁（连环战船）', scene: 'ChibiGameScene', run: { thirdStage: 2 }, reg: { chibiStage: 2 }, src: 'all' },
  { key: '9-3 麦城（全部碰撞框：山崖 / 通道）', scene: 'XiangfanGameScene', run: { thirdStage: 3 }, reg: { xiangfanStage: 3 }, src: 'all' },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(([w, r]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); localStorage.setItem('im_roster_v1', JSON.stringify(r)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, [world, roster]);
  await p.goto(BASE + '?dev=1&layout=desktop&followers=1');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  for (const c of CASES) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    await p.evaluate(([key, run, reg]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.run, c.reg]);
    await p.waitForTimeout(500);
    const ok = await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.followers?.members.length; }, S, { timeout: 60000 }).then(() => true, () => false);
    if (!ok) { ck(`${c.key}：随行到场`, false, 'no followers'); continue; }
    for (let t = 0; t < 2500; t += 250) { await ev(() => 0); await p.waitForTimeout(250); }
    // 关前剧情要先跳过（剧情时战斗不更新）；董卓城墙在首领出阵时才建
    for (let i = 0; i < 120; i++) {
      const st = await ev((s, dz) => { if (s.mode === 'story' || s.mode === 'parley') { for (const o of s.children.list) { const btn = o.list?.find(q => /-(next|confirm)$/.test(q.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (dz && !s.dzLubu && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } return { mode: s.mode, dz: !!s.dzLubu }; }, c.src === 'dz');
      if (st.mode === 'none' && (c.src !== 'dz' || st.dz)) break; await p.waitForTimeout(250);
    }
    for (let t = 0; t < 800; t += 200) { await ev(() => 0); await p.waitForTimeout(200); }
    await ev(s => { s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const m of s.followers.members) m.maxHp = m.hp = 1e9; });
    // 选靶：障碍中心（树干 / 碰撞框，离主将近的几个）
    const targets = await ev((s, src) => {
      const p = s.player, near = arr => arr.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 4);
      if (src === 'trees') return near((s.terrain?.trees ?? []).filter(t => !t.burnt).map(t => ({ x: t.x, y: t.y, kind: 'tree' })));
      if (src === 'all') return (s.sishuiObstacles?.footprints ?? []).filter(b => b.right - b.left < 1400 && b.bottom - b.top < 1400).sort((a, b) => Math.hypot((a.left + a.right) / 2 - p.x, a.top - p.y) - Math.hypot((b.left + b.right) / 2 - p.x, b.top - p.y)).slice(0, 14).map(b => ({ x: (b.left + b.right) / 2, y: b.top + Math.min(10, (b.bottom - b.top) / 2), kind: 'box', w: Math.round(b.right - b.left), h: Math.round(b.bottom - b.top) }));
      const boxes = src === 'dz' ? (s.dzLubu?.obstacles.footprints ?? []) : (s.sishuiObstacles?.footprints ?? []);
      // 碰撞框里离主将最近的点往里挪 10 像素（深埋在大框里的点不现实；随行是从边上挤进去的）
      return near(boxes.map(b => { const qx = Math.max(b.left, Math.min(b.right, p.x)), qy = Math.max(b.top, Math.min(b.bottom, p.y)); return { x: qx + Math.sign((b.left + b.right) / 2 - qx) * Math.min(10, (b.right - b.left) / 2), y: qy + Math.sign((b.top + b.bottom) / 2 - qy) * Math.min(10, (b.bottom - b.top) / 2), kind: 'box' }; }));
    }, c.src);
    if (!targets.length) { ck(`${c.key}：找到障碍`, false, c.src); continue; }
    // 障碍夹在随行和阵位之间：随行放在障碍北边 70、主将按在南边 70，随行要走回阵位就得「穿过」障碍；逐帧取样随行是否站进障碍
    const inside = []; let samples = 0;
    for (const t of targets) {
      for (let k = 0; k < 16; k++) {
        const r = await ev((s, [t, src, k]) => {
          const pl = s.player; pl.sprite.setPosition(t.x, t.y + 70);
          if (k === 0) for (const m of s.followers.members) m.place(t.x + (Math.random() - .5) * 20, t.y - 70);
          const inBox = (x, y) => (src === 'dz' ? s.dzLubu.obstacles.footprints : s.sishuiObstacles.footprints).some(b => x > b.left + 2 && x < b.right - 2 && y > b.top + 2 && y < b.bottom - 2);
          const inTree = (x, y) => (s.terrain?.trees ?? []).some(tr => !tr.burnt && Math.hypot(tr.x - x, tr.y - y) < 12);
          return s.followers.members.filter(m => !m.downed).map(m => src === 'trees' ? inTree(m.x, m.y) : inBox(m.x, m.y));
        }, [t, c.src, k]);
        if (k > 0) { samples += r.length; if (r.some(Boolean)) inside.push({ t: [Math.round(t.x), Math.round(t.y)], k }); }
        await p.waitForTimeout(60);
      }
    }
    ck(`${c.key}：障碍夹在随行和阵位之间，随行绕 / 挤过去时一帧都没站进障碍（${targets.length} 处 × 16 帧）`, inside.length === 0 && samples > 0, { inside: inside.length, samples, first: inside.slice(0, 3) });
  }
  ck('无 pageerror', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length;
console.log(`SUMMARY: ${rows.length - bad}/${rows.length} passed`);
process.exit(bad ? 1 : 0);
