// 武将出手不得有「程序绘制」特效（2026-11-18，全游戏审计 S4；用户规则：特效必须是手绘透明序列帧）。
// 每位武将打 2.5 秒普攻，再把被动清零后叠满三次触发招牌技；期间包住场景的 add.circle / rectangle / ellipse / triangle / star / polygon / line / arc
// 与 Graphics 的画图方法，只要调用来自 src/weapons 或 src/systems（武器 / 系统特效代码）就算违规。界面（src/ui、HUD、主将脚下指挥光圈）不算。
// 程序画法只允许作为缺图时的兜底：正常载图时一次都不该走到。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5173/ [HEROES=zhangfei,machao] node tools/test-hero-code-fx.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const HEROES = (process.env.HEROES ?? 'zhaoyun,guanyu,huangzhong,zhuge,zhangfei,machao,weiyan,liubei,pangtong,huangyueying,sunshangxiang,diaochan').split(',');
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', e => errors.push(e.message));
let pass = 0, fail = 0; const ck = (name, ok, info) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${JSON.stringify(info)}`); };
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 90000 });
await p.waitForTimeout(1000);
for (const hero of HEROES) {
  await p.evaluate(([G0, id]) => { const s = eval(G0); window.__prev = s.player; s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, hero]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prev && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 60000 });
  const res = await p.evaluate(async G0 => {
    const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms)), hits = {};
    pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.spawnGem = () => {};
    const iv = setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40);
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, e = s.spawnEnemy(i % 5 ? 'infantry' : 'elite', pl.x + Math.cos(a) * (70 + (i % 3) * 40), pl.y + Math.sin(a) * (60 + (i % 3) * 30), 1); if (e) { e.hp = e.maxHp = 1e6; e.stunUntil = 1e12; } }
    // 调用来源：取栈里第一个 src/ 下的帧（src/ui 也取到，便于排除界面）
    const note = kind => {
      const st = new Error().stack.split('\n').slice(2).find(l => /\/src\/(weapons|systems|ui|scenes|entities)\//.test(l));
      const m = st?.match(/\/src\/([^?:]+)(?:\?[^:]*)?:(\d+)/), k = kind + ' @ ' + (m ? m[1] + ':' + m[2] : '?'); hits[k] = (hits[k] ?? 0) + 1;
    };
    const wrap = (obj, name, kind) => { const f = obj[name]; obj[name] = function (...a) { note(kind); return f.apply(this, a); }; return () => { obj[name] = f; }; };
    const undo = ['circle', 'rectangle', 'ellipse', 'triangle', 'star', 'polygon', 'line', 'arc', 'graphics'].map(n => wrap(s.add, n, n));
    const GP = Object.getPrototypeOf(s.add.graphics());
    for (const n of ['strokePath', 'fillPath', 'fillCircle', 'strokeCircle', 'fillRect', 'strokeRect', 'lineBetween', 'fillTriangle', 'fillEllipse', 'strokeEllipse', 'fillPoints', 'strokePoints']) undo.push(wrap(GP, n, 'draw.' + n));
    const trig0 = pl.passive.snapshot(s.combatNow).triggers;
    await wait(2500);
    const max = (await import('/src/data/passives.ts')).CHARACTER_PASSIVES[s.runConfig.character]?.maxStacks || 5;
    for (let r = 0; r < 3; r++) { pl.passive.stacks = 0; await wait(80); pl.passive.stacks = max; for (const w of pl.weapons) w.cooldownLeft = 0; await wait(1100); }
    for (const u of undo) u(); clearInterval(iv);
    return { hits, trig: pl.passive.snapshot(s.combatNow).triggers - trig0 };
  }, G);
  // 违规：来自武器 / 系统代码的形状对象与画图调用（只建空 Graphics、不往里画的不算）
  const bad = Object.entries(res.hits).filter(([k]) => /@ (weapons|systems)\//.test(k) && !k.startsWith('graphics @'));
  ck(`${hero}：普攻与招牌技没有程序绘制的特效（招牌技触发 ${res.trig} 次）`, bad.length === 0, Object.fromEntries(bad));
}
ck('无页面报错', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`);
await b.close(); process.exit(fail ? 1 : 0);
