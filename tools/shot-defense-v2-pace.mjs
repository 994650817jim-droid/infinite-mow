// 守城 v2 节奏实测（总制作人 c 段验收第 1 条）：一键预览入口（?dev=1&defenseV2=1&defensePreview=1）进中城守城，两种打法各打一局（3 倍速，主将免死）：
//  A 只守云梯不管门：哪段立了梯就去推，梯子没立先放滚木；不泼油、不出城、不修门、不站门楼。
//  B 只守门不管云梯：守在门楼——冲车到门前就泼油，每波出城去砸冲车，喘息时修门；不推梯、不放滚木。
//  C 认真守（推梯 / 滚木 / 泼油 / 喘息修门，不出城；像真人一样走过去）：主将不免死，近似总制作人那局（39 级赵云 527 血、伤害 ×6、35 个兵）；报登城数、主将最低血量、城门结束耐久。
// 报：城门破的时间（第几波）、城门伤害来源（冲车 / 步兵砍 / 主将）、失守段数、从城头下城的敌兵、每波部曲阵亡、城外同屏峰值、结束时间 / 结局。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-defense-v2-pace.mjs [A|B]  → 输出 JSON 一行一局；截图 assets/review/defense-v2/pace-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/defense-v2', only = process.argv[2];
mkdirSync(OUT, { recursive: true });
const SPEED = 3, REAL_CAP_MS = 240000;
const errors = [];
async function run(style) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(style + ': ' + e.message.slice(0, 200)));
  const ev = (f, a) => p.evaluate(f, a), wait = ms => p.waitForTimeout(ms);
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('im_story', 'off'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_defense_v2_guide_v1', '["start","ladder","ram","sortie","rest","gate"]'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(BASE + '?dev=1&defenseV2=1&defensePreview=1&layout=desktop&story=off', { timeout: 180000 });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene') && s.defenseAssault && s.elapsed > .3; }, null, { timeout: 180000 });
  const entry = await ev(style => { const s = window.__game.scene.getScene('SiegeGameScene'); window.__S = s; s.player.damageImmune = style !== 'C'; s.devTimeScale = 3; window.__minHp = 1;
    if (style === 'C') { s.player.stats.maxHpBonus += 527 - s.player.maxHp; s.player.hp = s.player.maxHp; s.player.stats.damageMul *= 6; for (const [k, n] of [['archer', 5], ['swordsman', 5], ['spearman', 5]]) s.legion.recruit(k, n, true); s.defenseV2.assignAll(true); } /* 近似总制作人那局：39 级赵云（527 血、伤害约 ×6）、35 个兵 */ return { army: s.legion.count, city: s.registry.get('siegeCity'), waves: s.chapter.waves.length, preview: !!s.registry.get('defensePreview'), heroHp: s.player.maxHp }; }, style);
  const log = { style, entry, waveDead: [], peakOutside: 0, firstLost: null, end: null };
  let lastWave = -1, lastPhase = '', deadAt = 0, sortieT = 0, repairT = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < REAL_CAP_MS) {
    const st = await ev(([style, sortieT, repairT]) => {
      const s = window.__S, A = s.defenseAssault, g = s.defenseV2.g, D = s.defenseAssault;
      // 解开会停战斗的面板（升级三选一 / 专职 / 战斗支援招兵 / 加点）
      for (let i = 0; i < 6 && s.mode !== 'none' && !s.over; i++) { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'branch') s.chooseBranch?.(1); else if (s.mode === 'recruit') { const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => x.name === 'recruit-close' && x.input?.enabled); if (o) { o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); } else s.setMode('none'); } else if (['story', 'attributes', 'bossloot'].includes(s.mode)) s.setMode('none'); else break; }
      s.devTimeScale = 3;
      const put = (x, y) => s.player.sprite.setPosition(x, y), sp = { gate: { x: g.gx, y: g.top + 72 }, oil: { x: g.gx, y: g.W - 52 } };
      let act = '';
      if (!s.over && s.mode === 'none') {
        const now = s.combatNow, ramAt = A.rams.find(r => r.atGate && r.e.active);
        const pushLadder = () => { if (A.pushing) { s.v2Held.add('KeyF'); return 'pushing'; } s.v2Held.delete('KeyF'); const up = A.ladders.find(l => l.state === 'up'); if (!up) return ''; put(up.x, g.W - 40); s.v2Held.add('KeyF'); s.interactOverride(); return 'push' + up.seg; };
        if (style === 'C') { // 认真守：泼油（冲车在撞门）> 推梯 > 滚木 > 喘息修门；像真人一样走过去（基础移速 178），不瞬移
          const moveTo = (x, y) => { const d = Math.hypot(x - s.player.x, y - s.player.y), step = 178 * Math.max(.05, s.elapsed - (window.__lastEl ?? s.elapsed)); if (d <= Math.max(step, 6)) { put(x, y); return true; } put(s.player.x + (x - s.player.x) / d * step, s.player.y + (y - s.player.y) / d * step); return false; };
          if (A.pushing) { s.v2Held.add('KeyF'); act = 'pushing'; }
          else {
            s.v2Held.delete('KeyF'); const up = A.ladders.find(l => l.state === 'up'); let target = null, kind = '';
            if (ramAt && A.oil.charges > 0 && now >= A.oil.cd) { target = sp.oil; kind = 'oil'; }
            else if (up) { target = { x: up.x, y: g.W - 40 }; kind = 'push'; }
            else { const warn = A.ladders.find(l => l.state === 'warn' || l.state === 'down'); if (warn && A.logs[warn.seg] > 0) { target = { x: g.segs[warn.seg].ladderX + 84, y: g.W - 48 }; kind = 'log'; } else if (A.phase === 'rest' && !A.sortieReady() && A.gate.hp < A.gate.max && now >= A.repairCd) { target = sp.gate; kind = 'repair'; } }
            if (target) { if (moveTo(target.x, target.y)) { if (kind === 'push') s.v2Held.add('KeyF'); if (!(kind === 'repair' && A.channel)) s.interactOverride(); act = kind; } else act = 'walk-' + kind; }
            else if (!A.channel) moveTo(g.gx - 300, g.W - 90);
          }
          window.__lastEl = s.elapsed;
        } else if (style === 'A') { // 只守云梯
          const pa = pushLadder();
          if (pa) act = pa;
          else { const warn = A.ladders.find(l => l.state === 'warn' || l.state === 'down'); if (warn && A.logs[warn.seg] > 0) { put(g.segs[warn.seg].ladderX + 84, g.W - 48); s.interactOverride(); act = 'log' + warn.seg; } else put(g.segs[0].x1, g.W - 90); }
        } else { // 只守门
          if (A.sortieOpen) { const t = A.rams.find(r => r.e.active) ?? A.ladders.find(l => l.cart.active && l.state === 'drive'); if (t && now < A.sortie.until - 5000) { put(t.x ?? t.cart.x, (t.e ?? t.cart).y - 40); act = 'sortie-hit'; } else { put(g.gx, g.F + 20); act = 'sortie-back'; } }
          else if (ramAt && A.oil.charges > 0 && now >= A.oil.cd) { put(sp.oil.x, sp.oil.y); s.interactOverride(); act = 'oil'; }
          else if (A.sortieReady() && (A.rams.some(r => r.e.active) || A.ladders.some(l => l.cart.active && l.state === 'drive'))) { put(sp.gate.x, sp.gate.y); s.interactOverride(); act = 'sortie'; }
          else if (A.phase === 'rest' && A.gate.hp < A.gate.max && now >= A.repairCd) { put(sp.gate.x, sp.gate.y); if (!A.channel) s.interactOverride(); act = 'repair'; }
          else if (!A.channel) put(g.gx + 40, g.W - 100); // 站门楼上（门楼放箭）
        }
      }
      window.__minHp = Math.min(window.__minHp, s.player.hp / s.player.maxHp);
      let outside = 0; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.y > g.F - 30) outside++;
      return { el: +s.elapsed.toFixed(1), wave: A.wave, phase: A.phase, gate: Math.round(A.gate.hp / A.gate.max * 100), gateOpen: A.gate.open, keep: Math.round(A.keep.hp / A.keep.max * 100), captured: A.segmentsCaptured.filter(Boolean).length,
        captures: A.stats.captures, landed: A.stats.landed, minHp: Math.round(window.__minHp * 100), heroHp: Math.round(s.player.hp), wallDown: A.stats.wallDown, dead: s.legion.dead ?? 0, troops: s.legion.count, outside, over: s.over, victory: !!s.victory, stats: { ...A.stats }, act };
    }, [style, sortieT, repairT]);
    log.peakOutside = Math.max(log.peakOutside, st.outside);
    if (st.captures > 0 && !log.firstLost) log.firstLost = { el: st.el, wave: st.wave + 1 };
    if (st.wave !== lastWave || st.phase !== lastPhase) { if (lastPhase === 'attack' || lastPhase === 'final') log.waveDead.push({ wave: lastWave + 1, dead: st.dead - deadAt, troops: st.troops }); if (st.phase === 'attack' || st.phase === 'final') deadAt = st.dead; lastWave = st.wave; lastPhase = st.phase; }
    if (st.over || st.phase === 'done') { log.end = st; break; }
    await wait(450);
  }
  if (!log.end) log.end = await ev(() => { const s = window.__S, A = s.defenseAssault; return { el: +s.elapsed.toFixed(1), wave: A.wave, phase: A.phase, gate: Math.round(A.gate.hp / A.gate.max * 100), gateOpen: A.gate.open, keep: Math.round(A.keep.hp / A.keep.max * 100), over: s.over, stats: { ...A.stats }, timeout: true }; });
  await wait(1200); await p.screenshot({ path: OUT + '/pace-' + style + '.png' });
  await b.close();
  const S = log.end.stats ?? {}, W = 85, waveOf = el => el < 0 ? null : Math.min(4, Math.floor(el / W) + 1);
  return { style, entry: log.entry, landed: S.landed, heroMinHpPct: log.end.minHp ?? null, pushBroken: S.pushBroken, gateBroke: S.gateBrokeAt >= 0 ? { el: Math.round(S.gateBrokeAt), wave: waveOf(S.gateBrokeAt), late: S.gateBrokeAt % W > 45 } : null,
    gateDmg: { ram: Math.round(S.ramDmg), chop: Math.round(S.chopDmg), boss: Math.round(S.bossDmg) }, captures: S.captures, firstLost: log.firstLost, wallDown: S.wallDown, keepHits: S.keepHits,
    waveDead: log.waveDead, peakOutside: log.peakOutside, end: { el: log.end.el, gate: log.end.gate, keep: log.end.keep, over: log.end.over, timeout: !!log.end.timeout, result: log.end.over ? (log.end.keep <= 0 ? '府衙失守' : '守住 / 结束') : '未结束' },
    acts: { pushed: S.pushed, logs: S.logs, oil: S.oil, sorties: S.sorties, repairs: S.repairs, gateShots: S.gateShots, ramsBroken: S.ramsBroken } };
}
const out = [];
for (const st of only ? [only] : ['A', 'B', 'C']) { const r = await run(st); out.push(r); console.log(JSON.stringify(r)); }
console.log(errors.length ? 'ERRORS ' + JSON.stringify(errors.slice(0, 3)) : 'NO ERRORS');
