// 智力「范围」加成接到所有武器（2026-11-17）：CharacterPassives.areaMul 经 rangeMultiplier 放大各武器的范围。
// 抽查：庞统火雷爆炸半径（Lv1 70）——敌人站在 95 像素处，倍率 1 时炸不到，倍率 1.3（半径 91）时炸得到；
//       马超落地范围（70）——旁边 85 像素的敌人同理。电脑布局。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-range-mul.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const open = async hero => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, hero]);
  await p.waitForTimeout(500);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 20000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); s.player.weapons[0].cooldownLeft = 99; }, G);
  return p;
};
// 庞统：脚下放一枚雷（直接调武器：布雷需要 320 内有敌人），踩雷者在雷上，旁观者在 80 像素处
{
  const p = await open('pangtong');
  const r = await p.evaluate(async G0 => {
    const s = eval(G0), pl = s.player, w = pl.weapons[0];
    const round = async mul => {
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      (await import('/src/weapons/heroWeapons.ts')).lianhuanClear(pl); pl.passive.areaMul = mul;
      const far = s.spawnEnemy('infantry', pl.x + 200, pl.y - 150, 1); far.hp = far.maxHp = 99999; far.stunUntil = 1e12; // 让武器有目标而布雷
      w.cooldownLeft = 0; await new Promise(r => setTimeout(r, 400)); w.cooldownLeft = 99;
      const mine = s.children.list.find(o => o.name === 'pangtong-mine' && o.active); if (!mine) return { mine: false };
      await new Promise(r => setTimeout(r, 600)); // 过了待发时间
      const side = s.spawnEnemy('infantry', mine.x + 95, mine.y, 1); // 判定为半径 + 敌人自身半径（14）：×1 约 84 够不到，×1.3 约 105 够得到 side.hp = side.maxHp = 99999; side.stunUntil = 1e12;
      const sx = side.x, sy = side.y, pin = setInterval(() => { side.sprite.x = sx; side.sprite.y = sy; }, 5); // 定身的敌人仍会被挤动：钉住旁观者
      const step = s.spawnEnemy('infantry', mine.x, mine.y, 1); step.hp = step.maxHp = 99999; step.stunUntil = 1e12;
      const t0 = performance.now(); while (performance.now() - t0 < 2500 && step.hp === step.maxHp) await new Promise(r => setTimeout(r, 20));
      await new Promise(r => setTimeout(r, 100)); clearInterval(pin);
      return { mine: true, stepHurt: step.maxHp - step.hp, sideHurt: side.maxHp - side.hp, enemyR: side.radius, mines: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length, sideD: Math.round(Math.hypot(side.x - mine.x, side.y - mine.y)), pl: Math.round(Math.hypot(pl.x - side.x, pl.y - side.y)) };
    };
    const one = await round(1), big = await round(1.3); pl.passive.areaMul = 1;
    return { one, big };
  }, G);
  ck('庞统火雷：智力范围 ×1.3 后，95 像素外的敌人也被炸到（×1 时炸不到）', r.one.mine && r.one.stepHurt > 0 && r.one.sideHurt === 0 && r.big.stepHurt > 0 && r.big.sideHurt > 0, r);
  await p.close();
}
// 马超：挑飞目标，落地范围波及 85 像素外的旁观者
{
  const p = await open('machao');
  const r = await p.evaluate(async G0 => {
    const s = eval(G0), pl = s.player, w = pl.weapons[0];
    const round = async mul => {
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      await new Promise(r => setTimeout(r, 100)); pl.passive.areaMul = mul; pl.passive.stacks = 0;
      const t = s.spawnEnemy('infantry', pl.x + 100, pl.y, 1); t.hp = t.maxHp = 99999; t.stunUntil = 1e12;
      const side = s.spawnEnemy('infantry', pl.x + 100 + 85, pl.y, 1); side.hp = side.maxHp = 99999; side.stunUntil = 1e12;
      w.cooldownLeft = 0; await new Promise(r => setTimeout(r, 120)); w.cooldownLeft = 99;
      await new Promise(r => setTimeout(r, 1000));
      return { targetHurt: t.maxHp - t.hp, sideHurt: side.maxHp - side.hp };
    };
    const one = await round(1), big = await round(1.3); pl.passive.areaMul = 1;
    return { one, big };
  }, G);
  ck('马超落地：智力范围 ×1.3 后，85 像素外的敌人也被砸到（×1 时砸不到）', r.one.targetHurt > 0 && r.one.sideHurt === 0 && r.big.sideHurt > 0, r);
  await p.close();
}
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
