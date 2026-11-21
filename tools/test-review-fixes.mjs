// 第 3–12 章检查报告剩余问题（统筹 11-21）：
// ① 9-3 麦城突围自己的段落表（180 秒内：马忠 70 秒出、吕蒙 125 秒），7-3 成都段落跟攻城进度走（街巷出刘循、首领段要进州府）；章节成长倍率不变
// ② 第六章荆南：敌兵青灰（f_jingnan_）、营具换色（FACTION_PROPS[7]）
// ③ 世界坐标名牌靠屏幕边时收进 HUD 安全区（副将 / 首领名牌）
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-review-fixes.mjs   截图 assets/review/review-fixes/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/review-fixes'; mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
async function open(key, reg, st) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&followers=0&story=off');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 });
  await p.evaluate(([key, reg, st]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer'); s0.registry.set(reg, st); s0.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'GameScene') s.scene.stop(); s0.scene.start(key); }, [key, reg, st]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.elapsed > 1 && s.elapsed < 10; }, key, { timeout: 120000 });
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); window.__S = s; s.player.damageImmune = true;
    window.__calm = () => { for (let i = 0; i < 16 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup' || s.mode === 'bossloot') s.chooseUpgrade?.(0); else { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none'); } } }; window.__calm(); }, key);
  return p;
}
const calm = async (p, n = 4) => { for (let i = 0; i < n; i++) { await p.waitForTimeout(300); await p.evaluate(() => window.__calm()); } };

// ① 9-3 麦城突围
{
  const p = await open('XiangfanGameScene', 'xiangfanStage', 3); await calm(p, 3);
  const a = await p.evaluate(async () => { const s = window.__S, P = await import('/src/data/stagePhases.ts'), pl = s.phasePlan; return { phases: pl?.phases.map(x => x.kind + '@' + x.start).join(' '), lt: pl?.lieutenant, tune: pl && P.planLen(pl), bossMul: s.chapter.growth?.bossHp, want: P.PHASES.bossHpMul(pl.chapter, 5) }; });
  await p.waitForFunction(() => !!window.__S.phaseRunner, null, { timeout: 10000 }).catch(() => {});
  await p.evaluate(() => { window.__S.elapsed = 71; }); await calm(p, 6);
  const lt = await p.evaluate(() => ({ name: window.__S.phaseRunner?.stats.lieutenant, wave: window.__S.waveIndex }));
  ck('9-3：自己的段落表压进 180 秒（0 / 35 / 70 马忠 / 125 吕蒙），70 秒副将马忠出场；首领血量倍率仍按五段', a.phases === 'vanguard@0 elite@35 lieutenant@70 boss@125' && a.lt === '马忠' && a.tune === 5 && lt.name === '马忠', { ...a, lt });
  await p.close();
}
// ① 7-3 成都
{
  const p = await open('ShuGameScene', 'shuStage', 3); await calm(p, 4);
  const r = await p.evaluate(async () => {
    const s = window.__S, wait = ms => new Promise(r => setTimeout(r, ms)), pl = s.phasePlan;
    const a = { phases: pl?.phases.map(x => x.kind + '@' + x.start).join(' '), progress: !!pl?.progress, lt: pl?.lieutenant };
    s.elapsed = 300; await wait(700); window.__calm(); const timeOnly = s.waveIndex; // 只过时间、没破门：不进副将 / 首领段
    if (s.mid) s.mid.phase = 'street'; await wait(900); window.__calm(); await wait(600);
    const street = { wave: s.waveIndex, lt: s.phaseRunner?.stats.lieutenant };
    return { ...a, timeOnly, street, bossSpawned: s.bossSpawned };
  });
  ck('7-3：段落跟攻城进度走（城外 → 街巷出副将刘循 → 州府首领）；只过时间不切段', r.progress && r.phases === 'vanguard@0 lieutenant@150 boss@330' && r.timeOnly === 0 && r.street.wave === 1 && r.street.lt === '刘循' && !r.bossSpawned, r);
  await p.close();
}
// ② 第六章荆南配色 + 营具
{
  const p = await open('JingnanGameScene', 'jingnanStage', 1); await calm(p, 6);
  const r = await p.evaluate(() => { const s = window.__S; s.elapsed = 70; return null; }); await calm(p, 6); await p.waitForTimeout(2500); await p.evaluate(() => window.__calm());
  const t = await p.evaluate(() => { const s = window.__S, en = s.enemies.filter(e => e.active && !e.isSupplySlot && e.kind !== 'boss'); return { tex: [...new Set(en.map(e => e.def.walkVisual?.texture ?? e.def.texture))].slice(0, 8), props: s.textures.exists('f_jingnan_props_v2_xiliang'), fac: s.sceneFaction?.() }; });
  await p.screenshot({ path: `${OUT}/6-1-jingnan.png` });
  ck('第六章：敌兵荆南青灰（f_jingnan_），营具换色（FACTION_PROPS[7]），没有凉州 / 西凉旧色', t.tex.some(k => /^f_jingnan_/.test(k)) && !t.tex.some(k => /^f_liangzhou_|^xiliang_/.test(k)) && t.props && t.fac === 7, t);
  await p.close();
}
// ③ 名牌收进 HUD 安全区（5-2 副将张允在右上角）
{
  const p = await open('ChibiGameScene', 'chibiStage', 2); await calm(p, 4);
  await p.waitForFunction(() => !!window.__S.phaseRunner?.ltArt?.() || true, null, { timeout: 5000 }).catch(() => {});
  await p.evaluate(() => { window.__S.elapsed = 186; }); await calm(p, 6);
  const r = await p.evaluate(async () => {
    const s = window.__S, wait = ms => new Promise(r => setTimeout(r, ms)), R = s.phaseRunner, e = R?.lt?.e; if (!e) return { none: true };
    e.def = { ...e.def, speed: 0 }; const v = s.cameras.main.worldView; e.sprite.setPosition(v.right - 40, v.top + 90); await wait(400); window.__calm();
    const tag = R.lt.tag, k = Number(s.sys.game.config.width) / s.cameras.main.worldView.width, b = tag.getBounds(), W = s.cameras.main.worldView;
    const sc = { l: (b.left - W.x) * k, r: (b.right - W.x) * k, t: (b.top - W.y) * k, bt: (b.bottom - W.y) * k };
    const GW = Number(s.sys.game.config.width), GH = Number(s.sys.game.config.height), S = { left: 140, top: 108, right: GW - 130, bottom: GH - 120 }; /* 同 ui/SafeLabel hudSafe（测试里另起的模块实例拿不到运行时布局，直接按场景尺寸算） */
    return { text: tag.text, sc: Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, Math.round(v)])), inside: sc.l >= S.left - 1 && sc.r <= S.right + 1 && sc.t >= S.top - 1 && sc.bt <= S.bottom + 1 };
  });
  await p.screenshot({ path: `${OUT}/5-2-nameplate.png` });
  ck('5-2：副将名牌在屏幕右上角时收进 HUD 安全区（不压舆图卷轴 / 右侧圆钮）', r.inside && /张允/.test(r.text ?? ''), r);
  await p.close();
}
ck('全程无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${fail} failed`);
await b.close();
