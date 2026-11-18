// 首领专属招式 · 二阶段 · 骑马（第一批：第 1–3 章）冒烟：
//  - 张梁 / 张宝（第一章，行走表画面）、李傕 / 张绣（第三章，4×8 首领图）用新招式框架：每招都放得出来、半血换二阶段、骑马的半血坠马转步战；
//  - 华雄 / 吕布（已有专属控制器）补骑马：一阶段在马上，半血坠马；
//  - 阶段切换统一发 boss-phase 事件（打击感会话接这个）。每位首领 1280×720 截一阶段（马上）与二阶段。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-boss-moves.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/boss-moves';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const SIZES = {};
const CASES = [
  { id: 'zhangliang', scene: 'GameScene', run: { chapter: 'huangjin', stage: 1 }, reg: {}, ctl: 'moveset', mounted: false, rage: true }, // 2026-11-18 用户：第一章首领不骑马
  { id: 'zhangbao', scene: 'GameScene', run: { chapter: 'huangjin', stage: 2 }, reg: {}, ctl: 'moveset', mounted: false },
  { id: 'lijue', scene: 'ThirdGameScene', run: { thirdStage: 1 }, reg: { thirdStage: 1 }, ctl: 'controller', mounted: true },
  { id: 'zhangxiu', scene: 'ThirdGameScene', run: { thirdStage: 2 }, reg: { thirdStage: 2 }, ctl: 'controller', mounted: true },
  { id: 'huaxiong', scene: 'GameScene', run: { chapter: 'hulao', westStage: 1 }, reg: {}, ctl: 'huaxiong', mounted: true, legacy: true },
  { id: 'lubu', scene: 'LubuGameScene', run: {}, reg: {}, ctl: 'lubu', mounted: true, legacy: true },
  // 第二批：第四章骑马补丁、第五章、第六章
  { id: 'yanliang', scene: 'GuanduGameScene', run: {}, reg: { guanduStage: 1 }, ctl: 'controller', mounted: true, legacy: true },
  { id: 'wenchou', scene: 'GuanduGameScene', run: {}, reg: { guanduStage: 2 }, ctl: 'controller', mounted: true, legacy: true },
  { id: 'caochun', scene: 'ChibiGameScene', run: { thirdStage: 1 }, reg: { chibiStage: 1 }, ctl: 'controller', mounted: true },
  { id: 'caimao', scene: 'ChibiGameScene', run: { thirdStage: 2 }, reg: { chibiStage: 2 }, ctl: 'controller', mounted: false },
  { id: 'zhaofan', scene: 'JingnanGameScene', run: { thirdStage: 1 }, reg: { jingnanStage: 1 }, ctl: 'controller', mounted: false },
  { id: 'liudu', scene: 'JingnanGameScene', run: { thirdStage: 2 }, reg: { jingnanStage: 2 }, ctl: 'controller', mounted: false },
  { id: 'huangzhong', scene: 'JingnanGameScene', run: { thirdStage: 3 }, reg: { jingnanStage: 3 }, ctl: 'controller', mounted: true },
  // 韩玄：长沙先战黄忠（劝降后）才出阵
  { id: 'hanxuan', scene: 'JingnanGameScene', run: { thirdStage: 3 }, reg: { jingnanStage: 3 }, ctl: 'controller', mounted: false, pre: 'huangzhong' },
  // 第三批：第八章、第十章、第十二章
  { id: 'zhanghe', scene: 'HanzhongGameScene', run: { thirdStage: 1 }, reg: { hanzhongStage: 1 }, ctl: 'controller', mounted: true },
  { id: 'xiahouyuan', scene: 'HanzhongGameScene', run: { thirdStage: 2 }, reg: { hanzhongStage: 2 }, ctl: 'controller', mounted: true },
  { id: 'caocao', scene: 'HanzhongGameScene', run: { thirdStage: 3 }, reg: { hanzhongStage: 3 }, ctl: 'controller', mounted: true },
  { id: 'sunhuan', scene: 'YilingGameScene', run: { thirdStage: 1 }, reg: { yilingStage: 1 }, ctl: 'controller', mounted: true },
  { id: 'zhuran', scene: 'YilingGameScene', run: { thirdStage: 2 }, reg: { yilingStage: 2 }, ctl: 'controller', mounted: true },
  { id: 'haozhao', scene: 'BeifaGameScene', run: { thirdStage: 2 }, reg: { beifaStage: 2 }, ctl: 'controller', mounted: false, prep: 's => { s.siege?.gate?.deactivate(); }' },
  // 第四批：第七章、第九章、第十一章（场地机制照常；prep 每轮都跑，推进到首领出场）
  { id: 'yanghuai', scene: 'ShuGameScene', run: { thirdStage: 1 }, reg: { shuStage: 1 }, ctl: 'controller', mounted: false },
  { id: 'zhangren', scene: 'ShuGameScene', run: { thirdStage: 2 }, reg: { shuStage: 2 }, ctl: 'controller', mounted: true },
  { id: 'liuzhang', scene: 'ShuGameScene', run: { thirdStage: 3 }, reg: { shuStage: 3 }, ctl: 'controller', mounted: false, prep: "s => { const m = s.shuMid; if (!m) return; if (m.phase === 'outside') m.hitGate(1e6); if (m.phase === 'street') for (const pt of m.points) pt.state = 'secured'; }" },
  { id: 'caoren', scene: 'XiangfanGameScene', run: { thirdStage: 1 }, reg: { xiangfanStage: 1 }, ctl: 'controller', mounted: false },
  { id: 'pangde', scene: 'XiangfanGameScene', run: { thirdStage: 2 }, reg: { xiangfanStage: 2 }, ctl: 'controller', mounted: true },
  { id: 'lvmeng', scene: 'XiangfanGameScene', run: { thirdStage: 3 }, reg: { xiangfanStage: 3 }, ctl: 'controller', mounted: false, prep: 's => { if (!s.boss?.active) s.player.sprite.setPosition(0, -1800); }' },
  { id: 'mangyachang', scene: 'NanzhengGameScene', run: { thirdStage: 1 }, reg: { nanzhengStage: 1 }, ctl: 'controller', mounted: false },
  { id: 'wutugu', scene: 'NanzhengGameScene', run: { thirdStage: 2 }, reg: { nanzhengStage: 2 }, ctl: 'controller', mounted: false },
  { id: 'menghuo', scene: 'NanzhengGameScene', run: { thirdStage: 3 }, reg: { nanzhengStage: 3 }, ctl: 'controller', mounted: false },
];
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // 本测试看单首领招式表：4-2 文丑、8-2 夏侯渊关掉双首领（双将关另见 test-dual-boss）
  await p.goto(BASE + '?dev=1&layout=desktop&dual=0');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
  for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.id))) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
    await p.evaluate(([key, run, reg]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); window.__phases = []; const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.run, c.reg]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1000);
    if (c.prep) { await p.waitForTimeout(800); await ev(c.prep); }
    await ev(s => { s.player.damageImmune = true; s.events.on('boss-phase', e => window.__phases.push({ phase: e.phase, dismount: e.dismount, name: e.name })); if (!s.boss?.active) { const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); else s.spawnBoss?.(); } });
    let ctl = null;
    if (c.pre) {
      for (let i = 0; i < 100; i++) { if (await ev((s, k) => false, c.ctl)) break; if (await ev(s => s.controller?.def?.id === 'huangzhong' && s.boss?.active)) break; await p.waitForTimeout(200); }
      await wait(2500);
      await ev(s => { s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, false); });
      await wait(800);
      await ev(s => { if (s.mode === 'parley') s.choose('persuade'); });
      await wait(600);
    }
    for (let i = 0; i < 150 && !ctl; i++) { ctl = await ev((s, [k, id, legacy]) => { const o = s[k]; return o && s.boss?.active && (legacy || o.def?.id === id) ? true : null; }, [c.ctl, c.id, !!c.legacy]); if (!ctl) { if (c.prep) await ev(c.prep); await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (s.mode === 'parley') s.choose('persuade'); if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } }); await p.waitForTimeout(200); } }
    ck(`${c.id}：首领出阵，控制器就位`, !!ctl, null);
    if (!ctl) continue;
    await wait(3200); // 出场名牌、马图载入
    const mount = await ev((s, k) => { const o = s[k], m = o.mount ?? s.bossMount; return { mounted: !!m?.mounted, horse: !!m?.hasHorse, crop: !!s.boss.sprite.isCropped, ride: !!m?.usesRideArt }; }, c.ctl);
    const RIDE_ART = ['lubu', 'huaxiong'];
    if (c.mounted && RIDE_ART.includes(c.id)) { const r = await ev((s, k) => { const o = s[k], m = o.mount ?? s.bossMount; return { ride: !!m?.usesRideArt, tex: s.boss.sprite.texture.key, horse: !!m?.hasHorse }; }, c.ctl); ck(`${c.id}：一阶段骑马用正式首领骑乘图`, r.ride && r.horse && r.tex === 'ride_v2_boss_' + c.id, r); }
    else if (c.mounted) ck(`${c.id}：一阶段骑马（马图在、骑者裁上半身或用首领骑乘图）`, mount.mounted && mount.horse && (mount.crop || mount.ride), mount);
    else ck(`${c.id}：不骑马（步战 / 术士）`, !mount.mounted, mount);
    if (!c.legacy) {
      // 一阶段每招都放一遍
      for (let w = 0; w < 50 && !(await ev((s, [k, id]) => s[k]?.def?.id === id && s.boss?.active, [c.ctl, c.id])); w++) { if (c.prep) await ev(c.prep); await p.waitForTimeout(200); } // 攻城转场等场景过渡时控制器会短暂重建
      const names = await ev((s, k) => [...s[k].debug.moves], c.ctl);
      for (let i = 0; i < names.length; i++) { await ev((s, [k, i]) => { const b = s.boss; b.sprite.x = s.player.x + 160; b.sprite.y = s.player.y; s[k].debug.force(i, s.combatNow); }, [c.ctl, i]); await wait(i === 0 ? 900 : 2600); if (i === 0) await p.screenshot({ path: `${OUT}/${c.id}-p1.png` }); }
      const m1 = await ev((s, k) => s[k].snapshot(), c.ctl);
      ck(`${c.id}：一阶段招式都放出（${names.join('、')}）`, names.every(n => m1.metrics[n] > 0), m1.metrics);
    } else { await ev(s => { const b = s.boss; b.sprite.x = s.player.x + 170; b.sprite.y = s.player.y - 20; }); await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/${c.id}-p1.png` }); }
    if (c.id === 'lijue') {
      // 冲锋穿过部曲：每名士兵吃一整下（不再按帧摊成几乎无伤）
      await ev(s => { s.legion.recruit('swordsman', 6, true); const b = s.boss, p = s.player; b.sprite.x = p.x + 300; b.sprite.y = p.y; s.allies.filter(u => u.active).forEach((u, i) => { u.setPosition(p.x + 60 + i * 35, p.y); u.hp = u.maxHp; u.bossImmuneUntil = 0; }); s.controller.debug.force(0, s.combatNow); });
      await wait(2400);
      const tr = await ev(s => s.allies.filter(u => u.active || u.hp <= 0).map(u => Math.round((1 - Math.max(0, u.hp) / u.maxHp) * 100)));
      ck('李傕冲锋穿过部曲：士兵各吃一整下', tr.filter(x => x >= 15).length >= 3, tr);
    }
    // 半血 → 二阶段
    await ev((s, k) => { const b = s.boss; b.sprite.x = s.player.x + 170; b.sprite.y = s.player.y - 20; b.hp = Math.floor(b.maxHp * .48); s.hitEnemy(b, 1, s.combatNow, 'melee', false, false); }, c.ctl);
    await p.waitForTimeout(250);
    const fall = await ev(s => s.children.list.some(o => o.name === 'boss-fall'));
    if (c.rage) { // 步战首领狂暴：旗倒（含身后大旗）、大吼、黄色气焰，不播坠马
      await p.waitForTimeout(150);
      const rg = await ev((s, k) => ({ rage: s[k].metrics.rage ?? 0, flags: s.children.list.filter(o => o.name === 'boss-rage-flag').length, wave: s[k].metrics.rageWave ?? 0, aura: s[k].metrics.rageAura ?? 0, roar: s.children.list.find(o => o.name === 'boss-rage-roar')?.text, horse: s.children.list.some(o => o.name === 'boss-horse' && o.active), fall: s.children.list.some(o => o.name === 'boss-fall') }), c.ctl);
      await p.screenshot({ path: `${OUT}/${c.id}-rage.png` });
      ck(`${c.id}：二阶段「旗倒人狂」——旗帜倒下、大吼声浪、黄色气焰，没有马也不播坠马`, rg.rage === 1 && rg.flags >= 1 && rg.wave >= 1 && rg.aura >= 1 && !!rg.roar && !rg.horse && !rg.fall, rg);
    }
    if (c.mounted && ['lubu', 'huaxiong'].includes(c.id)) { await p.screenshot({ path: `${OUT}/${c.id}-fall.png` }); ck(`${c.id}：坠马播骑乘图第 9 行坠马帧`, fall, fall); }
    await wait(2250);
    const ph = await p.evaluate(() => window.__phases);
    // 步战体型 / 染色 / 清晰度（11-18 用户「张梁画风」：首领步战按 v2 统一标准，跟华雄、吕布一致）：二阶段（已坠马）取样 8 次
    { const smp = []; for (let i = 0; i < 8; i++) { smp.push(await ev(s => { const sp = s.boss.sprite, fr = sp.frame, c = window.__bc ?? (window.__bc = document.createElement('canvas')); c.width = fr.cutWidth; c.height = fr.cutHeight; const g = c.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, c.width, c.height); g.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight); const d = g.getImageData(0, 0, c.width, c.height).data; let top = -1, bot = -1; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (top < 0) top = y; bot = y; }
        const ps = s.player.sprite, pf = ps.frame; return { h: (bot - top + 1) * Math.abs(sp.scaleY) * (s.presence ? 1.4 : 1), key: sp.texture.key, cell: fr.height, tint: sp.isTinted && !sp.tintFill ? sp.tintTopLeft.toString(16) : '', filter: sp.texture.source[0].scaleMode, pfilter: ps.texture.source[0].scaleMode, fill: (bot - top + 1) / fr.height }; })); await p.waitForTimeout(120); }
      // 首领合集图用的单人截图（以脚底为下边、站在主将旁）
      { const c2 = await ev(s => { const cam = s.cameras.main, b = s.boss, W = window.innerWidth / s.scale.width; return { x: (b.x - cam.worldView.x) * cam.zoom * W, y: (b.y - cam.worldView.y) * cam.zoom * W }; }); await p.screenshot({ path: `${OUT}/size-${c.id}.png`, clip: { x: Math.max(0, Math.min(1280 - 240, c2.x - 120)), y: Math.max(0, Math.min(720 - 260, c2.y - 230)), width: 240, height: 260 } }); }
      const hs = smp.map(x => x.h).sort((a, c) => a - c); SIZES[c.id] = { h: +hs[hs.length >> 1].toFixed(1), key: smp[0].key, cell: smp[0].cell, tint: smp.every(x => x.tint) ? smp[0].tint : '', filter: smp[0].filter, pfilter: smp[0].pfilter, fill: +smp[0].fill.toFixed(2) }; }
    const after = await ev((s, k) => { const o = s[k], m = o.mount ?? s.bossMount; return { phase2: !!o.phase2, mounted: !!m?.mounted, crop: !!s.boss.sprite.isCropped, horse: s.children.list.filter(x => x.name === 'boss-horse' && x.active).length }; }, c.ctl);
    if (!c.legacy) ck(`${c.id}：换阶段撤掉一阶段旗阵`, (await ev((s, k) => s[k].snapshot().flags, c.ctl)) === 0, null);
    ck(`${c.id}：半血换二阶段，发 boss-phase 事件`, after.phase2 && ph.some(e => e.phase === 2), { after, ph });
    if (c.mounted) ck(`${c.id}：坠马 → 步战（马跑开、骑者恢复整身）`, !after.mounted && !after.crop && ph.some(e => e.phase === 2 && e.dismount), { after, ph });
    if (c.rage) ck(`${c.id}：步战首领全程无马、boss-phase 不带坠马`, !after.mounted && !after.horse && ph.some(e => e.phase === 2 && !e.dismount), { after, ph });
    if (c.rage) { const n = await ev((s, k) => s[k].metrics.rageAura ?? 0, c.ctl); ck(`${c.id}：二阶段身上反复腾起黄色气焰`, n >= 2, n); }
    if (!c.legacy) {
      for (let w = 0; w < 50 && !(await ev((s, [k, id]) => s[k]?.def?.id === id && s.boss?.active, [c.ctl, c.id])); w++) { if (c.prep) await ev(c.prep); await p.waitForTimeout(200); } // 攻城转场等场景过渡时控制器会短暂重建
      const names = await ev((s, k) => [...s[k].debug.moves], c.ctl);
      for (let i = 0; i < names.length; i++) { await ev((s, [k, i]) => { const b = s.boss; b.sprite.x = s.player.x + 160; b.sprite.y = s.player.y; s[k].debug.force(i, s.combatNow); }, [c.ctl, i]); await wait(i === 0 ? 900 : 2600); if (i === 0) await p.screenshot({ path: `${OUT}/${c.id}-p2.png` }); }
      const m2 = await ev((s, k) => s[k].snapshot(), c.ctl);
      ck(`${c.id}：二阶段换招（${names.join('、')}）`, names.every(n => m2.metrics[n] > 0), m2.metrics);
    } else await p.screenshot({ path: `${OUT}/${c.id}-p2.png` });
  }
  // 步战体型统一：以华雄 / 吕布（v2 首领标准：288 格 × 0.5、存在感 ×1.4）为准，各首领画面身高相差 ≤12%（姿势取样有起伏）；无残留染色；纹理过滤与主将一致
  { const ids = Object.keys(SIZES); if (ids.length) { const ref = ['huaxiong', 'lubu'].map(k => SIZES[k]?.h).filter(Boolean), std = ref.length ? ref.reduce((a, c) => a + c, 0) / ref.length : null;
    console.log('首领步战画面身高（世界像素，含 ×1.4）：' + ids.map(k => `${k} ${SIZES[k].h}${SIZES[k].tint ? ' tint ' + SIZES[k].tint : ''}`).join(' · ') + (std ? ` · 标准 ${std.toFixed(1)}` : ''));
    for (const k of ids) { const z = SIZES[k]; ck(`${k}：步战画面身高与华雄 / 吕布一致（±12%）、无残留染色、纹理过滤同主将`, (!std || Math.abs(z.h / std - 1) <= .12) && !z.tint && z.filter === z.pfilter, { ...z, std }); } } }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
