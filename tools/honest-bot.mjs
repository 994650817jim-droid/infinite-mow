// 不作弊的自动试玩（总制作人派单 2026-11-21，用户批准「做，玩完再跑」）：night-journey.mjs 在 HONEST=1 时用这里的打法代替作弊打法。
// 不回血、不改首领血量、不跳时间、不强推攻城段；倍速只用 SPEED（默认 1，即逻辑步长不变）。操作像人：
//  - 走位：首领在场先打首领；其次城门 / 营帐 / 攻城目标 / 突围出口 / 首领宝箱；否则最近的敌人。离目标 > 78 靠近，≤ 78 横移（每 2 秒换方向）；62 以内的敌人按距离排斥。
//  - 血量 < 55% 去最近的回血点 / 干粮；< 35% 拉开到 120 以外。原地 2 秒走不动（被栅栏挡）就侧移 1 秒找路。
//  - 升级三选一：伤害 > 攻速 > 范围 > 生存，兵器类加分；流派不超过两个。兵器专职选第一项。属性点全加主属性。
//  - 战斗支援必须领兵（chooseRecruit，最多 3 次）；劝降先劝、劝不动就斩。
// 移动输入走 GameScene.debugMove（和摇杆一样只是输入，正式模式下不算调试局、不影响存档）。
// 参考：共享笔记 honest-bot.md（总制作人在浏览器里验证过的走位参数）。

/** 每拍在页面里跑：处理面板、走位、记统计。返回当前状态。 */
export function honestTick(p, key) {
  return p.evaluate(k => {
    const g = window.__game, s = g.scene.getScene(k);
    if (!s || !s.sys.isActive()) return { gone: true, scenes: g.scene.getScenes(true).map(x => x.scene.key) };
    const pl = s.player, m = s.mode, H = (window.__hs ??= {}); let did = '';
    const all = []; const walk = l => { for (const x of l) { all.push(x); if (x.list) walk(x.list); } }; walk(s.children.list);
    const click = o => { o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); };
    // 属性点：全加主属性（没有主属性就轮流）
    try { const gr = pl?.growth; if (gr && gr.unallocated > 0 && s.attributeAdd) { const ids = ['strength', 'agility', 'intellect', 'command']; for (let i = 0; i < 8 && gr.unallocated > 0; i++) { const pr = window.__primary ?? null; if (!(pr && s.attributeAdd(pr)) && !s.attributeAdd(ids[i % 4])) break; } } } catch { /* 面板未就绪 */ }
    // 剧情卷轴 / 章末卷轴：点确认 / 下一页
    const sc = all.find(x => /^story-.*(confirm|next)$|-opening-next$/.test(x.name ?? '') && x.active && x.visible !== false && x.input?.enabled);
    if (sc && m !== 'none') { click(sc); did = 'scroll'; }
    else if (m === 'levelup' || m === 'bossloot') {
      const opts = s.upgradeOptions ?? [], schools = new Set(window.__schools ?? []);
      const score = o => { const t = (o.name ?? '') + (o.desc ?? ''); let v = 0;
        if (/伤害|攻击|暴击|威力|破甲|斩|击杀/.test(t)) v += 5; if (/攻速|冷却|频率|连发|出手/.test(t)) v += 4; if (/范围|数量|弹|穿透|扩大|半径/.test(t)) v += 3.5; if (/生命|护甲|减伤|回复|吸血|护盾|闪避|格挡/.test(t)) v += 2;
        if (o.kind === 'weapon') v += 1.5; if (o.school && !schools.has(o.school) && schools.size >= 2) v -= 100; return v; };
      let bi = 0, bv = -1e9; opts.forEach((o, i) => { const v = score(o); if (v > bv) { bv = v; bi = i; } });
      const o = opts[bi]; if (o?.school) { schools.add(o.school); window.__schools = [...schools]; }
      s.chooseUpgrade(bi); did = 'pick:' + (o?.name ?? bi); H.picks = (H.picks | 0) + 1;
    }
    else if (m === 'branch') { s.chooseBranch?.(0); did = 'branch'; }
    else if (m === 'recruit') { // 战斗支援：必须领兵
      H.rc = (H.rc | 0) + 1; const before = s.legion?.count ?? s.allies?.filter(a => a.active).length ?? 0;
      if (s.recruitOptions?.length && H.rc <= 3) { s.chooseRecruit(0); did = 'recruit'; }
      if (s.mode === 'recruit' && H.rc > 3) { const sk = all.find(x => /recruit-(skip|close)|skip/.test(x.name ?? '') && x.input?.enabled); if (sk) click(sk); did = 'recruit-done'; }
      H.troopsGot = (H.troopsGot | 0) + Math.max(0, (s.legion?.count ?? 0) - before);
    }
    else if (m === 'parley') { const tries = (H.parleyTry = (H.parleyTry | 0) + 1); s.choose(tries % 2 ? 'persuade' : 'execute'); did = 'parley'; }
    else if (m === 'story' || m === 'fortune') { const hits = s.input._list.filter(o => o.active && o.visible !== false && o.input?.enabled && !/battle-map/.test(o.name ?? '')); const top = hits.filter(o => /next|confirm|continue|skip|accept/.test(o.name ?? '')).at(-1) ?? hits.at(-1); if (top) click(top); did = m; }
    else if (m === 'none' && !s.over && pl?.alive) {
      H.rc = 0; H.parleyTry = 0;
      const now = s.combatNow, en = s.enemies.filter(e => e.active && !e.isSupplySlot && e.hp > 0), hpR = pl.hp / pl.maxHp;
      H.minHp = Math.min(H.minHp ?? 1, hpR); H.peak = Math.max(H.peak | 0, en.length);
      if (s.bossSpawned && H.bossAt == null) H.bossAt = s.elapsed; if (s.bossKilled && H.bossEnd == null) H.bossEnd = s.elapsed;
      if (s.bossPhase2 || s.zhangjiao?.phase2 || s.controller?.phase2) H.rage = true;
      (H.names ??= []).includes(s.chapter?.name) || H.names.push(s.chapter?.name);
      const near = (list, x = pl.x, y = pl.y) => { let best = null, bd = 1e9; for (const e of list) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } } return best; };
      let goal = null, kind = '';
      if (hpR < .35) { const c = near(en); if (c && Math.hypot(c.x - pl.x, c.y - pl.y) < 120) { const ax = pl.x - c.x, ay = pl.y - c.y, d = Math.hypot(ax, ay) || 1; goal = { x: pl.x + ax / d * 160, y: pl.y + ay / d * 160, flee: true }; kind = 'flee'; } }
      if (!goal && hpR < .55) { const bh = s.battleHeal, heal = [...(bh?.spots ?? []), ...(bh?.foods ?? []).filter(f => f.active && !f.flying)]; const h = near(heal); if (h) { goal = { x: h.x, y: h.y, walk: true }; kind = 'heal'; } }
      if (!goal) {
        const chest = (s.bossChests ?? []).find(c => c.ready && !c.done);
        const bosses = [s.boss, s.dzLubu?.lubu, ...(s.dual?.alive?.map(x => x.enemy) ?? [])].filter(e => e?.active && !e.invulnerable && e.hp > 0);
        const gates = [...(s.gateSet ?? [])].filter(e => e.active && e.hp > 0), tents = (s.luoyangCamps?.camps ?? []).filter(c => c.tent?.active && !c.destroyed).map(c => c.tent);
        const mid = (s.siegeMid ?? s.mid)?.priorityTarget?.(1600) ?? null, B = s.breakout;
        if (chest) { goal = { x: chest.x, y: chest.y, walk: true }; kind = 'chest'; }
        else if (bosses.length) { goal = near(bosses); kind = 'boss'; }
        else if (mid) { goal = mid; kind = 'siege'; }
        else if (gates.length) { goal = near(gates); kind = 'gate'; }
        else if (tents.length) { goal = near(tents); kind = 'camp'; }
        else if (B && !B.exited) { goal = { x: pl.x * .7, y: pl.y - 400, walk: true }; kind = 'breakout'; }
        else { const e = near(en); if (e) { goal = e; kind = 'enemy'; } }
      }
      let vx = 0, vy = 0;
      if (goal) {
        const dx = goal.x - pl.x, dy = goal.y - pl.y, d = Math.hypot(dx, dy) || 1;
        if (goal.walk || goal.flee || d > 78) { vx = dx / d; vy = dy / d; }
        else { const sgn = Math.floor(now / 2000) % 2 ? 1 : -1; vx = -dy / d * sgn; vy = dx / d * sgn; } // 贴近后横移
      }
      if (kind !== 'heal' && kind !== 'chest') for (const e of en) { const ex = pl.x - e.x, ey = pl.y - e.y, d = Math.hypot(ex, ey); if (d > 0 && d < 62) { const w = (62 - d) / 62 * 1.5; vx += ex / d * w; vy += ey / d * w; } }
      // 被挡（原地 2 秒走不动）：侧移 1 秒找路
      const moved = Math.hypot(pl.x - (H.lx ?? pl.x), pl.y - (H.ly ?? pl.y)); H.lx = pl.x; H.ly = pl.y;
      if (Math.hypot(vx, vy) > .3 && moved < .5) { H.stillMs = (H.stillMs ?? 0) + 120; } else if (moved > 2) H.stillMs = 0;
      if ((H.stillMs ?? 0) > 2000) { H.sideUntil = now + 1000; H.sideSgn = -(H.sideSgn ?? 1); H.stillMs = 0; H.blocked = (H.blocked | 0) + 1; }
      if (now < (H.sideUntil ?? 0)) { const l = Math.hypot(vx, vy) || 1; const ox = vx / l, oy = vy / l; vx = -oy * H.sideSgn + ox * .3; vy = ox * H.sideSgn + oy * .3; }
      const len = Math.hypot(vx, vy);
      if (len > .05) { s.debugMove.set(vx / len, vy / len); s.debugMoveActive = true; } else { s.debugMove.set(0, 0); s.debugMoveActive = false; }
      did = 'fight:' + kind;
    } else { s.debugMoveActive = false; }
    return { mode: s.mode, over: s.over, victory: s.victory, elapsed: Math.round(s.elapsed), hp: pl ? Math.round(pl.hp / pl.maxHp * 100) : null, alive: !!pl?.alive,
      enemies: s.enemies.filter(e => e.active && !e.isSupplySlot).length, fps: Math.round(g.loop.actualFps), name: s.chapter?.name, did, boss: !!s.boss?.active, bossHp: s.boss ? Math.round(s.boss.hp / s.boss.maxHp * 100) : null };
  }, key);
}

/** 一关开始时：清统计、记构筑（看阵亡重进后构筑是否清空）、主属性、倍速。 */
export function honestStart(p, key, speed) {
  return p.evaluate(async ([k, speed]) => {
    const s = window.__game.scene.getScene(k); window.__hs = {};
    try { const A = await import('/src/data/attributes.ts'); window.__primary = A.primaryAttribute(s.runConfig?.character) ?? null; } catch { window.__primary = null; }
    if (speed > 1) s.devTimeScale = speed;
    const w = (s.player?.weapons ?? []).map(x => x.id + ':' + x.level).join(',');
    return { hero: s.runConfig?.character, build: w, level: s.player?.level, troops: s.legion?.count ?? 0 };
  }, [key, speed]);
}

/** 一关结束时的记录（通关与否由调用方给）。 */
export function honestStats(p, key) {
  return p.evaluate(k => {
    const s = window.__game.scene.getScene(k), H = window.__hs ?? {}, w = JSON.parse(localStorage.getItem('im_world_v1') ?? 'null');
    let items = null; try { const it = JSON.parse(localStorage.getItem('im_items_v2') ?? localStorage.getItem('im_items_v1') ?? 'null'); items = it ? (it.bag?.length ?? it.items?.length ?? it.owned?.length ?? null) : null; } catch { /* */ }
    return { kills: s?.kills ?? null, minHp: H.minHp != null ? Math.round(H.minHp * 100) : null, peak: H.peak ?? 0, level: s?.player?.level ?? null, food: s?.legion?.food ?? null,
      grain: w?.provisions ?? null, merits: w?.merits ?? null, items, bossSec: H.bossAt != null ? Math.round((H.bossEnd ?? s?.elapsed ?? 0) - H.bossAt) : null,
      frontline: (H.names ?? []).length > 1 ? H.names : null, rage: !!H.rage, picks: H.picks ?? 0, troopsGot: H.troopsGot ?? 0, blocked: H.blocked ?? 0,
      build: (s?.player?.weapons ?? []).map(x => x.id + ':' + x.level).join(',') };
  }, key);
}

/** 行营休整：先军医（能治就治），再用随军粮补兵（刀盾 / 长枪 / 弓箭轮流，买到买不起为止）。 */
export function honestCamp(p, key) {
  return p.evaluate(k => {
    const s = window.__game.scene.getScene(k); if (!s?.sys.isActive() || s.mode !== 'rest') return null;
    const out = { medic: 0, troops: 0, foodBefore: s.legion?.food ?? null };
    // 军医按钮只在军医页渲染：逐个切页签，每切一次重扫一遍，点到能点的「治疗」按钮（不可用的按钮没挂点击，点了无效）
    const scan = () => { const re = []; const w2 = l => { for (const x of l) { re.push(x); if (x.list) w2(x.list); } }; w2(s.children.list); return re; };
    for (let i = 0; i < 7; i++) { const t = scan().find(x => x.name === 'camp-tab-' + i); if (!t) continue; t.emit('pointerdown');
      for (const b of scan().filter(x => /^camp-medic-/.test(x.name ?? '') && x.input?.enabled)) { b.emit('pointerdown'); out.medic++; } }
    scan().find(x => x.name === 'camp-tab-0')?.emit('pointerdown'); // 切回招兵营
    const kinds = ['swordsman', 'spearman', 'archer'];
    for (let i = 0; i < 24; i++) { if (!s.legion?.recruit?.(kinds[i % 3], 1)) break; out.troops++; }
    out.foodAfter = s.legion?.food ?? null; return out;
  }, key);
}

/** 天下地图上花军粮（平衡会话建议的顺序）：军营 → 科技 → 练兵 → 招武将。用的是营寨 / 招贤馆界面调的同一组函数。 */
export function spendWorld(p) {
  return p.evaluate(async () => {
    const out = { before: null, after: null, did: [] };
    try {
      const W = await import('/src/world/WorldStore.ts'), T = await import('/src/data/tech.ts'), R = await import('/src/systems/RosterStore.ts'), C = await import('/src/data/characters.ts');
      out.before = W.loadWorld().provisions;
      for (let i = 0; i < 3; i++) { const r = W.upgradeBuilding('barracks'); if (!r?.ok) break; out.did.push('军营'); }
      for (const id of Object.keys(T.TECHS)) for (let i = 0; i < 5; i++) { const r = W.researchTech(id); if (!r?.ok) break; out.did.push('科技:' + id); }
      for (let i = 0; i < 5; i++) { const r = W.trainTroops(); if (!r?.ok) break; out.did.push('练兵'); }
      for (const c of C.CHARACTERS) { const r = R.hireHero(c.id); if (r?.ok) out.did.push('招:' + c.id); }
      out.after = W.loadWorld().provisions;
    } catch (e) { out.err = String(e).slice(0, 160); }
    return out;
  });
}

/** 结算面板：阵亡后点「再战」（result-restart）。返回是否点到。 */
export function honestRetry(p, key) {
  return p.evaluate(k => { const s = window.__game.scene.getScene(k); const b = s?.resultPanel?.getByName?.('result-restart'); if (!b || !b.input?.enabled) return false; b.emit('pointerdown', { x: b.x, y: b.y }); b.emit('pointerup', { x: b.x, y: b.y }); return true; }, key);
}

/** 按章生成共享笔记 honest-journey.md（按章列表 + 卡关点 + 经济曲线）。 */
export function honestReport(stagesLog, issues, errors) {
  const L = ['# 不作弊全流程自动试玩（honest-journey）', '', `> 生成：${new Date().toISOString()} · 关数 ${stagesLog.length} · 问题 ${issues.length} · 控制台报错 ${errors.length}`, '', '## 每关', '',
    '| 关 | 结果 | 尝试 | 用时(s) | 击杀 | 最低血% | 敌峰值 | 等级 | 随军粮 | 军粮 | 战功 | 兵装 | 首领战(s) | 战线推进 | 震怒 | 卡墙 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of stagesLog) L.push(`| ${r.name ?? r.tag} | ${r.result} | ${r.attempt ?? 1} | ${r.elapsed ?? ''} | ${r.kills ?? ''} | ${r.minHp ?? ''} | ${r.peak ?? ''} | ${r.level ?? ''} | ${r.food ?? ''} | ${r.grain ?? ''} | ${r.merits ?? ''} | ${r.items ?? ''} | ${r.bossSec ?? ''} | ${r.frontline ? r.frontline.join('→') : ''} | ${r.rage ? '是' : ''} | ${r.blocked || ''} |`);
  L.push('', '## 卡关点', '');
  const stuck = stagesLog.filter(r => r.result !== 'win' && r.result !== 'rest');
  if (!stuck.length) L.push('- 无'); else for (const r of stuck) L.push(`- ${r.name ?? r.tag}：${r.result}（第 ${r.attempt ?? 1} 次，主将 ${r.hero ?? ''}）`);
  L.push('', '## 经济曲线（每关结束时军粮）', '', '```', stagesLog.map(r => `${(r.name ?? r.tag).padEnd(10)} ${String(r.grain ?? '').padStart(6)} ${'█'.repeat(Math.max(0, Math.round((r.grain ?? 0) / 300)))}`).join('\n'), '```');
  L.push('', '## 问题', ''); if (!issues.length) L.push('- 无'); else for (const i of issues) L.push(`- [${i.sev}] ${i.where}：${i.what}`);
  L.push('', '## 对照项（派单要求）', '', '- 首领倒下后主将仍被打死（玩法组在修）：看「结果」列里通关关的最低血% 和问题表里的「首领倒下后阵亡」。',
    '- 1-1 密度（平衡组方案 B）：看 1-1 的敌峰值、最低血%。', '- 阵亡重进后构筑清空：看问题表「重进后构筑」一项（每次重进对比开局兵器等级）。');
  return L.join('\n') + '\n';
}
