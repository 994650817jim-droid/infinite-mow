// 第七 / 九 / 十一章「三关打到底」冒烟（照 test-beifa-full 的打法，2026-11-22 章节卡关排查补的，共享笔记 chapter-softlock-1122.md）：
// 章节选关 → 每关 4 倍速、主将无敌、真实波次，弹窗自动关、剧情卷轴自动点、残血劝降面板按斩杀（不行再按劝降）、首领每拍掉血、走过去捡宝箱，直到告捷 / 转营。
// 各章特殊段：7-3 成都攻城（破门 → 巷战据点 → 州府刘璋，不跳时间，避开中城限时）；9-3 麦城突围（走到出口引吕蒙，打完再冲出口，不跳时间）；
// 11-3 七擒孟获（前两次倒地逃走再杀回，第三次才倒）。其它关首领没出就用 DEV「到首领」拨到首领时刻前 3 秒（不拨 999：会越过超时线）。电脑布局。
// 用法：BASE=http://127.0.0.1:5187/ node tools/test-arc-thru.mjs [shu] [xiangfan] [nanzheng]（不写就三章都跑）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/arc-thru';
mkdirSync(OUT, { recursive: true });
const ARCS = { shu: { ch: 7, scene: 'Shu' }, xiangfan: { ch: 9, scene: 'Xiangfan' }, nanzheng: { ch: 11, scene: 'Nanzheng' } };
const pick = process.argv.slice(2).filter(a => ARCS[a]); const arcs = pick.length ? pick : Object.keys(ARCS);
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info).slice(0, 600)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  for (const arc of arcs) {
    const { ch, scene } = ARCS[arc], KEY = scene + 'GameScene', S = `window.__game.scene.getScene('${KEY}')`;
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await p.goto(BASE + '?dev=1&layout=desktop', { timeout: 180000 });
    await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
    await p.evaluate(k => window.__game.scene.getScene('MenuScene').scene.start(k), scene + 'ChapterScene');
    await p.waitForFunction(k => window.__game.scene.isActive(k), scene + 'ChapterScene', { timeout: 90000 }); await p.waitForTimeout(800);
    ck(`第${ch}章选关界面`, await p.evaluate(k => window.__game.scene.isActive(k), scene + 'ChapterScene'));
    for (const stage of [1, 2, 3]) {
      await p.evaluate(([arc, KEY, st]) => { const g = window.__game; g.registry.set(arc + 'Stage', st); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); g.registry.remove(arc + 'Transfer');
        const cur = g.scene.getScene(KEY); if (cur && g.scene.isActive(KEY)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(KEY); } }, [arc, KEY, stage]);
      await p.waitForTimeout(500);
      await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 120000 }); await p.waitForTimeout(1200);
      const info = await p.evaluate(S0 => { const s = eval(S0); s.devTimeScale = 4; s.player.damageImmune = true; return { name: s.chapter.name, boss: s.chapter.bossName }; }, S);
      ck(`${ch}-${stage}：进入 ${info.name}（${info.boss}）`, info.name.startsWith(ch + '-' + stage), info);
      let chest = false, end = null, bossSeen = false, parleys = 0, last = null;
      const deadline = Date.now() + 420000; // 墙钟 7 分钟
      for (let t = 0; Date.now() < deadline && !end; t++) {
        const st = await p.evaluate(([S0, arc, stage]) => {
          const s = eval(S0); if (!s || !s.scene.isActive()) return { gone: true };
          if (s.mode === 'levelup' || s.mode === 'recruit' || s.mode === 'bossloot') s.__DEV_ACTIONS?.closePopup?.();
          // 剧情卷轴 / 对白：点「下一页 / 确定」（开场、落凤坡结局、章末卷轴都是 <名字>-next / <名字>-confirm）
          for (const c of s.children.list) if (c.name && c.list) { const btn = c.list.find(o => o.name === c.name + '-next' || o.name === c.name + '-confirm'); if (btn && btn.active !== false) btn.emit('pointerup'); }
          // 残血劝降面板：游戏停在 mode 'parley' 等玩家点。先按斩杀，下一拍还在就按劝降（孟获「七擒七纵」那类只给劝降）
          let parley = false; if (s.children.getByName('parley-panel')) { parley = true; s.__tried = (s.__tried ?? 0) + 1; s.choose(s.__tried % 2 ? 'execute' : 'persuade'); } else s.__tried = 0;
          const pl = s.player, mv = (x, y, v) => { const dx = x - pl.x, dy = y - pl.y, d = Math.hypot(dx, dy) || 1; pl.sprite.x += dx / d * Math.min(d, v); pl.sprite.y += dy / d * Math.min(d, v); };
          const c = s.bossChests?.find(c => !c.done && c.ready);
          const mid = s.shuMid, bo = s.xfState?.breakout ?? null;
          if (c) mv(c.x, c.y, 18);
          else if (s.boss?.active) { const dx = s.boss.x - pl.x, dy = s.boss.y - pl.y; if (Math.hypot(dx, dy) > 120) mv(s.boss.x, s.boss.y, 10); if (!s.boss.invulnerable) { s.boss.hp -= s.boss.maxHp * .012; if (s.boss.hp <= 0) s.hitEnemy(s.boss, 10, s.combatNow, 'melee', false, false); } }
          else if (bo && s.xfState.pendingWin) pl.sprite.setPosition(0, -2440); // 9-3：吕蒙已败 → 冲进出口
          else if (bo && !s.bossSpawned) mv(0, -1800, 30); // 9-3：往出口突围，近出口吕蒙截道
          else if (mid && !s.bossSpawned) { if (mid.phase === 'outside') mid.hitGate(5000); else if (mid.phase === 'street') for (const pt of mid.points) pt.state = 'secured'; } // 7-3 成都：破门 → 巷战据点
          else if (!s.bossSpawned && !(arc === 'nanzheng' && stage === 3 && s.nzState?.captured)) s.__DEV_ACTIONS?.toBoss?.(); // 拨到首领时刻前 3 秒（同 DEV 面板「到首领」）。直接拨 999 会越过「首领时刻 + 60 秒还没出 = 超时」，首领入场有延迟的关（7-1 / 7-2）当场判负
          return { el: Math.round(s.elapsed), mode: s.mode, over: s.over, victory: s.victory, rest: s.mode === 'rest', boss: !!s.boss?.active, inv: !!s.boss?.invulnerable, chests: s.bossChests?.length ?? 0, parley,
            mid: mid?.phase ?? null, bo: bo ? { left: bo.left, boss: bo.boss, gate: bo.gate, win: s.xfState.pendingWin } : null, nz: s.nzState ? { cap: s.nzState.captured, hid: s.nzState.hidden } : null };
        }, [S, arc, stage]);
        if (st.gone) { end = st; break; }
        last = st;
        if (st.boss) bossSeen = true;
        if (st.chests) chest = true;
        if (st.parley) parleys++;
        if (st.over || st.rest) end = st;
        await p.waitForTimeout(200);
      }
      // 11-3 孟获第三擒、7-3 / 9-3 首领倒地照常掉宝箱；章末若是「直接结算」的关没有宝箱也算过（只要告捷），宝箱另记
      ck(`${ch}-${stage}：首领出阵 → 倒地（宝箱 ${chest ? '有' : '无'}）→ 告捷`, bossSeen && end && (end.victory || end.rest), { bossSeen, chest, parleys, end, last });
      if (arc === 'nanzheng' && stage === 3) ck('11-3：孟获三擒才倒', end?.nz?.cap >= 3, end?.nz);
      await p.screenshot({ path: `${OUT}/${arc}-${stage}-end.png` });
    }
    ck(`第${ch}章无页面报错`, !errs.length, errs.slice(0, 3));
    await p.close();
  }
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
