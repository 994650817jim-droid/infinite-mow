// 首领杀我方小兵有多快（2026-11-17 用户：「我感觉boss杀我方小兵太快了」）：
// 各关只留首领，主将（免伤）带 刀盾 / 长枪 / 弓 各 4 名在首领身边约 110 像素绕圈，跑 45 秒游戏时间，
// 记录每名士兵活了多久、被哪个招式打死、同一时刻（同一招）一次打死几个。
// 用法：BASE=http://127.0.0.1:5195/ node tools/measure-boss-troops.mjs [--tag before] [--stages hj1,hulao,t1,g1] [--secs 45]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = arg('tag', 'latest'), secs = Number(arg('secs', 45)), hero = arg('hero', 'guanyu');
const STAGES = {
  hj1: { label: '1-1 张梁', key: 'GameScene', cfg: { chapter: 'huangjin', stage: 1 } },
  hulao: { label: '虎牢关 吕布', key: 'GameScene', cfg: { chapter: 'hulao' } },
  t1: { label: '3-1 李傕', key: 'ThirdGameScene', reg: { thirdStage: 1 }, cfg: { thirdStage: 1 } },
  g1: { label: '4-1 颜良', key: 'GuanduGameScene', reg: { guanduStage: 1 }, cfg: {} },
};
const stages = arg('stages', 'hj1,hulao,t1,g1').split(',');
const out = 'assets/review/balance'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const report = {};
for (const st of stages) {
  const S = STAGES[st], p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 90000 });
  await p.evaluate(([S, h]) => {
    const g = window.__game, s0 = g.scene.getScene('GameScene');
    s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer');
    for (const [k, v] of Object.entries(S.reg ?? {})) s0.registry.set(k, v);
    s0.registry.set('runConfig', { character: h, ...S.cfg }); s0.scene.start(S.key);
  }, [S, hero]);
  await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return s?.player && s.elapsed < 3 && window.__game.scene.isActive(k); }, S.key, { timeout: 60000 });
  await p.waitForTimeout(800);
  const res = await p.evaluate(async ([key, secs]) => {
    const s = window.__game.scene.getScene(key), pl = s.player, L = s.legion;
    s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none');
    pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
    for (const k of ['swordsman', 'spearman', 'archer']) L.recruit(k, 4, true);
    s.spawnBoss();
    const boss = s.boss; if (!boss) return { error: 'no boss' };
    boss.maxHp = boss.hp = 1e9; // 只看首领怎么打兵，不让它死
    pl.sprite.x = boss.x - 110; pl.sprite.y = boss.y;
    const t0 = s.combatNow, born = new Map(), log = [];
    for (const u of L.units) if (u.active) born.set(u.id + ':' + u.lifeId, { kind: u.kind, t: t0 });
    const where = () => { const st = (new Error().stack ?? '').split('\n').slice(2).map(l => l.trim().replace(/^at /, '').replace(/ \(.*$/, '')); return st.slice(0, 8).filter(n => !/\bhurt\b|^Array|^Object\.|anonymous|^new |^eval|^async /.test(n)).slice(0, 2).join(' ← ') || st[0]; };
    const orig = L.hurt.bind(L);
    L.hurt = (u, raw, now, src) => {
      const id = u.id + ':' + u.lifeId, hp0 = u.hp, ok = orig(u, raw, now, src);
      if (ok && born.has(id)) { let w = where(); if (/Legion\.update/.test(w)) w = s.boss && Math.hypot(s.boss.x - u.x, s.boss.y - u.y) < 160 ? '首领近身横扫' : '小兵近身'; log.push({ t: now - t0, id, kind: u.kind, dmg: hp0 - u.hp, died: !u.active, src: w, raw: Math.round(raw), maxHp: u.maxHp ?? u.def?.hp }); }
      return ok;
    };
    s.devTimeScale = 3;
    let a = 0; const stopAt = t0 + secs * 1000;
    while (s.combatNow < stopAt && !s.over) {
      if (s.mode !== 'none') { s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'levelup') s.chooseUpgrade?.(0); if (s.mode !== 'none') s.setMode?.('none'); }
      const bz = s.boss; if (bz?.active) { a += .12; const tx = bz.x + Math.cos(a) * 110, ty = bz.y + Math.sin(a) * 110, dx = tx - pl.x, dy = ty - pl.y, d = Math.hypot(dx, dy) || 1; window.__IM.setMove(dx / d, dy / d); }
      await new Promise(r => setTimeout(r, 120));
    }
    window.__IM.setMove(0, 0); s.devTimeScale = .0001;
    const dur = s.combatNow - t0, deaths = log.filter(x => x.died), life = { swordsman: [], spearman: [], archer: [] };
    for (const [id, bn] of born) { const d = deaths.find(x => x.id === id); life[bn.kind]?.push(d ? d.t / 1000 : dur / 1000); }
    const bySrc = {}; for (const x of log) { const r = bySrc[x.src] ??= { hits: 0, kills: 0, dmg: 0, maxRaw: 0, burst: {} }; r.hits++; r.dmg += x.dmg; r.maxRaw = Math.max(r.maxRaw, x.raw); if (x.died) { r.kills++; const k = Math.round(x.t / 50); r.burst[k] = (r.burst[k] ?? 0) + 1; } }
    for (const r of Object.values(bySrc)) { r.maxKillsOnce = Math.max(0, ...Object.values(r.burst)); delete r.burst; }
    const hp = {}; for (const u of L.units) hp[u.kind] ??= u.maxHp ?? u.def?.hp;
    return { dur: dur / 1000, boss: s.boss?.def?.name ?? s.chapter?.bossName, life, alive: L.units.filter(u => u.active).length, total: born.size, bySrc, hp, firstDeath: deaths[0]?.t / 1000 ?? null };
  }, [S.key, secs]);
  report[st] = { label: S.label, ...res, errors: errors.slice(0, 3) };
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—';
  console.log(`== ${S.label}（${res.dur?.toFixed(0)} 秒，存活 ${res.alive}/${res.total}，第一个阵亡 ${res.firstDeath == null ? '—' : res.firstDeath.toFixed(1) + 's'}）`);
  if (res.life) console.log(`   平均存活（秒，没死记满）：刀盾 ${avg(res.life.swordsman)} · 长枪 ${avg(res.life.spearman)} · 弓 ${avg(res.life.archer)}`);
  for (const [k, r] of Object.entries(res.bySrc ?? {}).sort((x, y) => y[1].kills - x[1].kills)) console.log(`   ${k}：命中 ${r.hits} 次，打死 ${r.kills}，一次最多打死 ${r.maxKillsOnce}，单次原始伤害最高 ${r.maxRaw}`);
  if (errors.length) console.log('   错误：', errors[0]);
  await p.close();
}
writeFileSync(`${out}/boss-troops-${tag}.json`, JSON.stringify(report, null, 1));
await b.close();
