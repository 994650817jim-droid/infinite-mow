// 第 3~12 章关隘 / 城池障碍物整改（data/arcForts.ts）：
//  关隘（阳平关 8-1、猇亭 10-1、江陵 5-3、长沙 6-3）= 关墙 + 关门 + 两座可互动箭楼；城池（长安 3-1、桂阳 6-1）= 城墙 + 城门；
//  长坂 5-1、街亭 12-1、陈仓 12-2、汉水 8-3、火烧连营 10-3 去掉场中城门。首领出阵时关门 / 城门洞开、带亲卫杀出。电脑布局，每关截图。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-arc-forts.mjs   （ONLY=hanzhong.1,qunxiong.1 只跑这几关）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/arc-forts';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const CASES = [
  { key: 'qunxiong.1', name: '3-1 长安', scene: 'ThirdGameScene', reg: { thirdStage: 1 }, kind: 'city', boss: true },
  { key: 'chibi.1', name: '5-1 长坂', scene: 'ChibiGameScene', reg: { chibiStage: 1 }, kind: 'clear' },
  { key: 'chibi.3', name: '5-3 江陵', scene: 'ChibiGameScene', reg: { chibiStage: 3 }, kind: 'pass' },
  { key: 'jingnan.1', name: '6-1 桂阳', scene: 'JingnanGameScene', reg: { jingnanStage: 1 }, kind: 'city', boss: true },
  { key: 'jingnan.3', name: '6-3 长沙', scene: 'JingnanGameScene', reg: { jingnanStage: 3 }, kind: 'pass' },
  { key: 'hanzhong.1', name: '8-1 阳平关', scene: 'HanzhongGameScene', reg: { hanzhongStage: 1 }, kind: 'pass', boss: true, tower: true },
  { key: 'hanzhong.3', name: '8-3 汉水', scene: 'HanzhongGameScene', reg: { hanzhongStage: 3 }, kind: 'clear' },
  { key: 'yiling.1', name: '10-1 猇亭', scene: 'YilingGameScene', reg: { yilingStage: 1 }, kind: 'camp', boss: true }, // 全场景审查 P2：野战连营，木栅 + 辕门
  { key: 'yiling.3', name: '10-3 火烧连营', scene: 'YilingGameScene', reg: { yilingStage: 3 }, kind: 'clear' },
  { key: 'beifa.1', name: '12-1 街亭', scene: 'BeifaGameScene', reg: { beifaStage: 1 }, kind: 'clear' },
  { key: 'beifa.2', name: '12-2 陈仓', scene: 'BeifaGameScene', reg: { beifaStage: 2 }, kind: 'clear' },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
  for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.key))) {
    const S = `window.__game.scene.getScene('${c.scene}')`;
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S, String(fn), arg]);
    const wait = async ms => { for (let t = 0; t < ms; t += 200) { await ev(() => 0); await p.waitForTimeout(200); } };
    await p.evaluate(([key, reg, st]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: st }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [c.scene, c.reg, Object.values(c.reg)[0]]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await wait(1500);
    const lay = await ev(s => ({
      name: s.chapter.name, fort: s.fort?.kind ?? null, pass: s.sishuiPass?.snapshot() ?? null,
      walls: s.children.list.filter(o => o.name === 'fort-wall').length, gate: !!s.children.getByName('fort-gate'),
      oldGate: s.children.list.some(o => o.texture?.key === 'sishui_props_refined' && (o.frame?.name === 0 || o.frame?.name === 1) && o.y < -150 && o.y > -400 && !s.enemies.some(e => e.sprite === o)), // 攻城关（陈仓）的城门 / 箭楼是可打的敌人，不算
      boxes: s.sishuiObstacles?.footprints.length ?? 0,
    }));
    await ev(s => { s.player.damageImmune = true; s.player.sprite.setPosition(0, -470); }); await wait(700);
    await p.screenshot({ path: `${OUT}/${c.key}.png` });
    if (c.kind === 'clear') ck(`${c.name}：场中城门去掉、不加关墙`, lay.fort === 'clear' && !lay.pass && !lay.gate && !lay.oldGate && lay.walls === 0, lay);
    else ck(`${c.name}：${c.kind === 'pass' ? '关墙 + 关门 + 两座箭楼' : c.kind === 'camp' ? '营栅 + 辕门（无箭楼）' : '城墙 + 城门（无箭楼）'}，场中旧城门去掉`, lay.fort === c.kind && lay.pass && lay.walls >= 8 && lay.gate && !lay.oldGate && lay.pass.towers === (c.kind === 'pass' ? 2 : 0) && !lay.pass.gateOpen && lay.pass.tentsPlaced === false, lay);
    if (c.tower) {
      await wait(6000);
      const v = await ev(s => s.sishuiPass.snapshot());
      ck(`${c.name}：箭楼朝主将放箭雨`, v.metrics.volleys >= 1, v);
      const m0 = await ev(s => s.runMerit.elite);
      await ev(s => { const t = s.sishuiPass.towers[0]; s.hitEnemy(t.e, 1e6, s.combatNow, 'melee', false, false); });
      for (let i = 0; i < 20 && (await ev(s => s.sishuiPass.snapshot().towers)) > 1; i++) await wait(200);
      const td = await ev(s => ({ ...s.sishuiPass.snapshot(), merit: s.runMerit.elite, ruin: s.children.list.some(o => o.name === 'fort-tower-ruin') }));
      await p.screenshot({ path: `${OUT}/${c.key}-tower-down.png` });
      ck(`${c.name}：打塌箭楼 → 毁坏图、战功 +1、攻击加成`, td.towers === 1 && td.ruin && td.merit === m0 + 1 && td.buffed, td);
    }
    if (c.boss) {
      let up = false;
      for (let i = 0; i < 120 && !up; i++) {
        up = await ev(s => { if (s.mode === 'story' || s.mode === 'parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } return !!s.boss?.active; });
        if (!up) await p.waitForTimeout(200);
      }
      await wait(600);
      const g = await ev(s => { const gate = s.children.getByName('fort-gate'); return { ...s.sishuiPass.snapshot(), frame: gate?.frame.name, gx: Math.round(gate?.x), gy: Math.round(gate?.y), bx: Math.round(s.boss.x), by: Math.round(s.boss.y) }; });
      await ev(s => { s.player.sprite.setPosition(0, -470); }); await wait(500);
      await p.screenshot({ path: `${OUT}/${c.key}-gate-open.png` });
      ck(`${c.name}：首领出阵 → 门洞开（破门图、门洞可通行），首领从门里杀出`, g.gateOpen && g.frame === (c.kind === 'camp' ? 7 : 2) /* 营寨辕门一直可通行、不换破门图 */ && Math.hypot(g.bx - g.gx, g.by - g.gy) < 220, g);
    }
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
