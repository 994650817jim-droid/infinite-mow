// 2-1 汜水关重做冒烟：关墙横在北面、关门居中、两座箭楼放箭雨（可打塌，掉战功 + 短时攻击加成）、
// 西凉营帐在关前两翼（西凉列阵波起出骑，打塌不再出、全塌后刷兵变稀）、华雄出阵关门洞开、关羽在队 30 秒内斩华雄 →「温酒斩华雄」。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-sishui-pass.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/sishui-pass';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
  const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const start = async hero => {
    await p.evaluate(h => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.set('runConfig', { character: h, chapter: 'hulao', westStage: 1 }); const cur = g.scene.getScene('GameScene'); if (cur && g.scene.isActive('GameScene')) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); } }, hero);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive() && s.sishuiPass; }, S, { timeout: 90000 }); await wait(1500);
  };
  await start('zhaoyun');
  const s0 = await ev(s => ({ ...s.sishuiPass.snapshot(), walls: s.children.list.filter(o => o.name === 'sishui-wall').length, gate: !!s.children.getByName('sishui-gate'), chapter: s.chapter.name }));
  await ev(s => { s.player.damageImmune = true; s.player.sprite.setPosition(0, -250); }); await wait(900); // 镜头对准关墙
  await p.screenshot({ path: `${OUT}/1-layout.png` });
  ck('2-1：关墙横在北面（城墙段一排）、关门居中、门两侧两座箭楼', s0.chapter.startsWith('2-1') && s0.walls >= 8 && s0.gate && s0.towers === 2 && !s0.gateOpen && s0.foot === 3, s0);
  const s1 = await ev(s => s.sishuiPass.snapshot());
  ck('西凉营帐 4 顶摆在关前两翼（可破坏）', s1.tentsPlaced && s1.tents === 4, s1);
  await wait(6000);
  const v = await ev(s => s.sishuiPass.snapshot());
  await p.screenshot({ path: `${OUT}/2-tower-volley.png` });
  ck('箭楼定时朝主将放箭雨（手绘预警圈）', v.metrics.volleys >= 1, v);
  // 打塌一座箭楼
  const m0 = await ev(s => s.runMerit.elite);
  await ev(s => { const t = s.sishuiPass.towers[0]; s.hitEnemy(t.e, 1e6, s.combatNow, 'melee', false, false); });
  for (let i = 0; i < 20 && (await ev(s => s.sishuiPass.snapshot().towers)) > 1; i++) await wait(200); // 弹窗开着时箭楼倒塌等回到战斗才结算
  const td = await ev(s => ({ ...s.sishuiPass.snapshot(), merit: s.runMerit.elite, ruin: s.children.list.some(o => o.name === 'sishui-tower-ruin') }));
  await p.screenshot({ path: `${OUT}/3-tower-down.png` });
  ck('打塌箭楼：换毁坏图、战功 +1、主将短时攻击加成', td.towers === 1 && td.ruin && td.merit === m0 + 1 && td.buffed, td);
  // 西凉列阵波：营帐出骑
  await ev(s => s.devSetTime?.(46)); await wait(4500);
  const rd = await ev(s => s.sishuiPass.snapshot());
  ck('「西凉列阵」波起，营帐出西凉铁骑', rd.metrics.rides >= 2, rd);
  for (let i = 0; i < 8 && (await ev(s => s.sishuiPass.snapshot().tents)) > 0; i++) { await ev(s => { for (const t of s.sishuiPass.tents) if (t.e?.active) s.hitEnemy(t.e, 1e6, s.combatNow, 'melee', false, false); }); await wait(500); }
  await wait(800);
  const tn = await ev(s => s.sishuiPass.snapshot());
  await p.screenshot({ path: `${OUT}/4-tents-burned.png` });
  ck('营帐全打塌：不再出骑，余下刷兵变稀（间隔 ×1.35）', tn.tents === 0 && tn.spawnMul > 1.3, tn);
  // 华雄出阵：关门洞开
  await ev(s => s.devSetTime?.(91));
  for (let i = 0; i < 40 && !(await ev(s => !!s.boss?.active)); i++) await wait(200);
  await ev(s => { s.player.sprite.setPosition(0, -250); }); await wait(700);
  const g = await ev(s => ({ ...s.sishuiPass.snapshot(), bx: Math.round(s.boss.x), by: Math.round(s.boss.y), gateY: Math.round(s.children.getByName('sishui-gate').y), frame: s.children.getByName('sishui-gate').frame.name }));
  await p.screenshot({ path: `${OUT}/5-gate-open.png` });
  ck('华雄出阵：关门洞开（换城门破图、门洞可通行），华雄从门里杀出', g.gateOpen && g.frame === 2 && g.foot === 2 && Math.abs(g.by - g.gateY) < 120 && Math.abs(g.bx) < 120, g);
  await ev(s => { s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, false); }); await wait(600);
  ck('赵云斩华雄：不触发「温酒斩华雄」（关羽不在队）', !(await ev(s => s.sishuiPass?.snapshot().wenjiu ?? false)), null);
  // 关羽：30 秒内斩华雄 → 温酒斩华雄
  await start('guanyu');
  await ev(s => { s.player.damageImmune = true; s.devSetTime?.(91); });
  for (let i = 0; i < 40 && !(await ev(s => !!s.boss?.active)); i++) await wait(200);
  await wait(800);
  const mb = await ev(s => s.runMerit.boss);
  await ev(s => { s.boss.hp = 1; s.hitEnemy(s.boss, 50, s.combatNow, 'melee', false, false); }); await wait(500);
  const w = await ev(s => ({ wenjiu: s.sishuiPass.snapshot().wenjiu, boss: s.runMerit.boss }));
  await p.screenshot({ path: `${OUT}/6-wenjiu.png` });
  ck('关羽 30 秒内斩华雄 →「温酒斩华雄」，战功加赏', w.wenjiu && w.boss >= mb + 3, { mb, w });
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
