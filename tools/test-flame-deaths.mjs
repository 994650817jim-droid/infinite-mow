// 诸葛亮「烈焰战旗」新美术（战旗挥动 / 八卦火阵预警 / 6 帧爆炸）＋ 我方士兵倒地帧与尸体留存 60 秒。需要开发服务器 5173。
// 用法：node tools/test-flame-deaths.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/flame-deaths';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const battle = async hero => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=mobile');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS);
  if (hero) { await p.evaluate(([G0, h]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: h, weapon: 'flame_banner' }); s.scene.restart(); }, [G, hero]); await p.waitForTimeout(400); await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.__DEV_ACTIONS; }, hero); }
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; s.player.weapons[0].cooldownLeft = 1e9; }, G);
  await p.waitForTimeout(300); return p;
};
// —— 烈焰战旗 ——
{
  const p = await battle('zhuge');
  ck('战旗 / 地纹 / 爆炸素材已加载', await p.evaluate(G0 => ['zhuge_banner', 'fire_sigil', 'flame_burst'].every(k => eval(G0).textures.exists(k)), G));
  await p.evaluate(G0 => { const s = eval(G0), pl = s.player; for (let i = 0; i < 4; i++) { const e = s.spawnEnemy('infantry', pl.x + 80 + i * 14, pl.y + (i % 2 ? 18 : -18), 1); e.hp = e.maxHp = 1e6; e.speed = 0; } pl.weapons[0].cooldownLeft = 0; }, G);
  const seen = { banner: false, sigil: false, frames: new Set() }, shots = [];
  for (let i = 0; i < 26; i++) {
    const st = await p.evaluate(G0 => { const s = eval(G0); const list = s.children.list; return { banner: list.some(o => o.texture?.key === 'zhuge_banner' && o.visible), sigil: list.some(o => o.name === 'fire-sigil'), burst: list.filter(o => o.name === 'flame-burst').map(o => String(o.frame.name)) }; }, G);
    seen.banner ||= st.banner; seen.sigil ||= st.sigil; st.burst.forEach(f => seen.frames.add(f));
    if ([2, 9, 13, 16, 19].includes(i)) { const f = `${out}/flame-${i}.png`; await p.screenshot({ path: f, clip: { x: 90, y: 330, width: 260, height: 200 } }); shots.push(f); }
    if (i === 3) await p.evaluate(G0 => { eval(G0).player.weapons[0].cooldownLeft = 1e9; }, G);
    await p.waitForTimeout(40);
  }
  ck('出手时挥动正式战旗（zhuge_banner）', seen.banner);
  ck('默认不铺八卦火阵（只保留关键提示，SHOW_OWN_RANGE_FX 关；2026-11-17）', !seen.sigil);
  ck('爆炸播放多帧火焰序列', seen.frames.size >= 3, [...seen.frames]);
  ck('旧的放大火球不再出现', await p.evaluate(G0 => !eval(G0).children.list.some(o => o.texture?.key === 'flame' && o.visible), G));
  const mp = await b.newPage({ viewport: { width: 5 * 262, height: 210 } });
  await mp.setContent(`<body style="margin:0;background:#222;display:flex;gap:2px">${shots.map(f => `<img src="data:image/png;base64,${readFileSync(f).toString('base64')}" style="width:260px">`).join('')}</body>`);
  await mp.waitForTimeout(150); await mp.screenshot({ path: `${out}/flame-sequence.png` }); await mp.close();
  await p.close();
}
// —— 士兵阵亡 ——
{
  const p = await battle();
  const r = await p.evaluate(async G0 => {
    const s = eval(G0), L = s.legion, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const kinds = ['swordsman', 'spearman', 'archer', 'crossbowman', 'guardian', 'rider', 'halberdier', 'medic'];
    for (const u of s.allies) if (u.active) { u.active = false; u.release(); }
    kinds.forEach(k => L.recruit(k, 1, true)); await wait(400);
    const alive = kinds.map(k => s.allies.find(u => u.active && u.kind === k));
    alive.forEach((u, i) => { u.x = s.player.x - 120 + (i % 4) * 80; u.y = s.player.y + 60 + Math.floor(i / 4) * 70; if (u.view) u.view.sprite.setPosition(u.x, u.y); });
    await wait(120);
    alive.forEach((u, i) => { u.dir = i === 1 ? 'left' : 'right'; }); // 同一帧内设朝向后立即阵亡
    for (const u of alive) L.hurt(u, 99999, s.combatNow);
    const c = L.corpses; out.count = c.count;
    await wait(80); out.early = c.pool.filter(x => x.active).map(x => String(x.image.frame.name));
    await wait(800); out.final = c.pool.filter(x => x.active).map(x => ({ key: x.key, frame: String(x.image.frame.name), flip: x.image.flipX, visible: x.image.visible }));
    out.dead = L.dead;
    return out;
  }, G);
  ck('8 名士兵阵亡：生成 8 具尸体', r.count === 8, r.count);
  ck('各兵种用自己的倒地行并停在最后一帧（3/7/11/15）', JSON.stringify(r.final.map(x => x.key + ':' + x.frame)) === JSON.stringify(['troop_deaths_a:3', 'troop_deaths_a:7', 'troop_deaths_a:11', 'troop_deaths_a:15', 'troop_deaths_b:3', 'troop_deaths_b:7', 'troop_deaths_b:11', 'troop_deaths_b:15']), r.final);
  ck('倒地动画逐帧播放（初期不是最后一帧）', r.early.some(f => !['3', '7', '11', '15'].includes(f)), r.early);
  ck('面朝左阵亡的尸体镜像', r.final[1].flip === true && r.final[0].flip === false, r.final.slice(0, 2));
  await p.screenshot({ path: `${out}/corpses.png`, clip: { x: 40, y: 380, width: 320, height: 200 } });
  const life = await p.evaluate(async G0 => { const s = eval(G0), c = s.legion.corpses, wait = ms => new Promise(r => setTimeout(r, ms));
    const a = c.pool.find(x => x.active); a.start = s.combatNow - 59000; await wait(100); const at59 = { visible: a.image.visible, alpha: +a.image.alpha.toFixed(2) };
    a.start = s.combatNow - 61500; await wait(100); const at61 = { active: a.active, visible: a.image.visible };
    return { at59, at61, left: c.count }; }, G);
  ck('尸体 59 秒时仍在、61 秒后消失', life.at59.visible && life.at59.alpha === 1 && !life.at61.active && !life.at61.visible && life.left === 7, life);
  const cap = await p.evaluate(async G0 => { const s = eval(G0), L = s.legion; for (let i = 0; i < 30; i++) { L.recruit('swordsman', 1, true); } await new Promise(r => setTimeout(r, 300)); for (const u of s.allies.filter(u => u.active)) L.hurt(u, 99999, s.combatNow); return { count: L.corpses.count, pool: L.corpses.pool.length }; }, G);
  ck('尸体最多 24 具（超出时最旧的让位）', cap.count <= 24 && cap.pool <= 24, cap);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
