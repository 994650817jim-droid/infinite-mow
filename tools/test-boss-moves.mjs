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
const CASES = [
  { id: 'zhangliang', scene: 'GameScene', run: { chapter: 'huangjin', stage: 1 }, reg: {}, ctl: 'moveset', mounted: true },
  { id: 'zhangbao', scene: 'GameScene', run: { chapter: 'huangjin', stage: 2 }, reg: {}, ctl: 'moveset', mounted: false },
  { id: 'lijue', scene: 'ThirdGameScene', run: { thirdStage: 1 }, reg: { thirdStage: 1 }, ctl: 'controller', mounted: true },
  { id: 'zhangxiu', scene: 'ThirdGameScene', run: { thirdStage: 2 }, reg: { thirdStage: 2 }, ctl: 'controller', mounted: true },
  { id: 'huaxiong', scene: 'GameScene', run: { chapter: 'hulao', westStage: 1 }, reg: {}, ctl: 'huaxiong', mounted: true, legacy: true },
  { id: 'lubu', scene: 'LubuGameScene', run: {}, reg: {}, ctl: 'lubu', mounted: true, legacy: true },
];
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  for (const c of CASES) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
    await p.evaluate(([key, run, reg]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); window.__phases = []; const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.run, c.reg]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1000);
    await ev(s => { s.player.damageImmune = true; s.events.on('boss-phase', e => window.__phases.push({ phase: e.phase, dismount: e.dismount, name: e.name })); if (!s.boss?.active) { if (s.devSetTime) s.devSetTime(999); else s.spawnBoss?.(); } });
    let ctl = null;
    for (let i = 0; i < 100 && !ctl; i++) { ctl = await ev((s, k) => { const o = s[k]; return o && s.boss?.active ? true : null; }, c.ctl); if (!ctl) await p.waitForTimeout(200); }
    ck(`${c.id}：首领出阵，控制器就位`, !!ctl, null);
    if (!ctl) continue;
    await wait(3200); // 出场名牌、马图载入
    const mount = await ev((s, k) => { const o = s[k], m = o.mount ?? s.bossMount; return { mounted: !!m?.mounted, horse: !!m?.hasHorse, crop: !!s.boss.sprite.isCropped }; }, c.ctl);
    if (c.mounted) ck(`${c.id}：一阶段骑马（马图在、骑者裁上半身）`, mount.mounted && mount.horse && mount.crop, mount);
    else ck(`${c.id}：不骑马（术士）`, !mount.mounted, mount);
    if (!c.legacy) {
      // 一阶段每招都放一遍
      const names = await ev((s, k) => [...s[k].debug.moves], c.ctl);
      for (let i = 0; i < names.length; i++) { await ev((s, [k, i]) => { const b = s.boss; b.sprite.x = s.player.x + 160; b.sprite.y = s.player.y; s[k].debug.force(i, s.combatNow); }, [c.ctl, i]); await wait(i === 0 ? 900 : 2600); if (i === 0) await p.screenshot({ path: `${OUT}/${c.id}-p1.png` }); }
      const m1 = await ev((s, k) => s[k].snapshot(), c.ctl);
      ck(`${c.id}：一阶段招式都放出（${names.join('、')}）`, names.every(n => m1.metrics[n] > 0), m1.metrics);
    } else await p.screenshot({ path: `${OUT}/${c.id}-p1.png` });
    // 半血 → 二阶段
    await ev((s, k) => { const b = s.boss; b.hp = Math.floor(b.maxHp * .48); s.hitEnemy(b, 1, s.combatNow, 'melee', false, false); }, c.ctl);
    await wait(2500);
    const ph = await p.evaluate(() => window.__phases);
    const after = await ev((s, k) => { const o = s[k], m = o.mount ?? s.bossMount; return { phase2: !!o.phase2, mounted: !!m?.mounted, crop: !!s.boss.sprite.isCropped, horse: s.children.list.filter(x => x.name === 'boss-horse' && x.active).length }; }, c.ctl);
    ck(`${c.id}：半血换二阶段，发 boss-phase 事件`, after.phase2 && ph.some(e => e.phase === 2), { after, ph });
    if (c.mounted) ck(`${c.id}：坠马 → 步战（马跑开、骑者恢复整身）`, !after.mounted && !after.crop && ph.some(e => e.phase === 2 && e.dismount), { after, ph });
    if (!c.legacy) {
      const names = await ev((s, k) => [...s[k].debug.moves], c.ctl);
      for (let i = 0; i < names.length; i++) { await ev((s, [k, i]) => { const b = s.boss; b.sprite.x = s.player.x + 160; b.sprite.y = s.player.y; s[k].debug.force(i, s.combatNow); }, [c.ctl, i]); await wait(i === 0 ? 900 : 2600); if (i === 0) await p.screenshot({ path: `${OUT}/${c.id}-p2.png` }); }
      const m2 = await ev((s, k) => s[k].snapshot(), c.ctl);
      ck(`${c.id}：二阶段换招（${names.join('、')}）`, names.every(n => m2.metrics[n] > 0), m2.metrics);
    } else await p.screenshot({ path: `${OUT}/${c.id}-p2.png` });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
