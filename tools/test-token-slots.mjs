// 第二信物位（2026-11-17 用户：每位武将可带 2 个信物，第二章通关后开放）。电脑布局 1280×720。
// 需要开发服务器 5173。用法：node tools/test-token-slots.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); };
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 120000 });
await p.waitForTimeout(800);

const r1 = await p.evaluate(async () => {
  const st = await window.__mod('/src/systems/ItemStore.ts'), it = await window.__mod('/src/data/items.ts'), out = {};
  st.setAutoSalvageWhite(false);
  const mk = base => it.rollBaseItem(base, 'blue');
  const a = mk('jade_pendant'), c = mk('tiger_seal'), d = mk('tiger_seal'); st.addItems([a, c, d]); window.__tok = { a: a.uid, c: c.uid, d: d.uid };
  out.locked = st.tokenSlots();
  st.equipItem('zhaoyun', a.uid); st.equipItem('zhaoyun', c.uid);
  const l = st.loadout('zhaoyun'); out.lockedWorn = { token: l.token?.uid === c.uid, token2: !!l.token2 };
  return out;
});
ck('第二章未通关：只有 1 个信物位，第二件信物换掉第一件', r1.locked === 1 && r1.lockedWorn.token && !r1.lockedWorn.token2, r1);

// 解锁：第二章（讨董）通关
const r2 = await p.evaluate(async () => {
  const ws = await window.__mod('/src/world/WorldStore.ts'), st = await window.__mod('/src/systems/ItemStore.ts'), fx = await window.__mod('/src/systems/ItemEffects.ts');
  ws.loadWorld(); ws.saveWorld(); const raw = JSON.parse(localStorage.getItem('im_world_v1')); raw.cleared.hulao = true; localStorage.setItem('im_world_v1', JSON.stringify(raw));
  const t = window.__tok, out = { slots: st.tokenSlots() };
  st.equipItem('zhaoyun', t.a); let l = st.loadout('zhaoyun'); out.two = { token: l.token?.uid, token2: l.token2?.uid };
  out.twoOk = l.token?.uid === t.c && l.token2?.uid === t.a;
  // 同名信物（第二件虎钮印）：换掉同名的那件，不会两格都是虎钮印
  st.equipItem('zhaoyun', t.d); l = st.loadout('zhaoyun'); out.same = l.token?.uid === t.d && l.token2?.uid === t.a;
  // 两件都算兵装加成
  const g = fx.gearFor('zhaoyun'); out.regen = g.regen > 0; out.ally = g.ally > 0;
  // 卸下第二位、存档读回保留
  out.unequip = st.unequipSlot('zhaoyun', 'token2'); st.equipItem('zhaoyun', t.a); st.resetItemCache(); l = st.loadout('zhaoyun'); out.reload = l.token2?.uid === t.a;
  // 关回去（存档切换到没通关的档）：第二位不生效但不丢
  raw.cleared.hulao = false; raw.dongzhuoStages = 0; localStorage.setItem('im_world_v1', JSON.stringify(raw)); st.resetItemCache();
  out.relock = st.tokenSlots() === 1 && !st.loadout('zhaoyun').token2 && JSON.parse(localStorage.getItem('im_items_v2')).loadouts.zhaoyun.token2 === t.a;
  raw.cleared.hulao = true; localStorage.setItem('im_world_v1', JSON.stringify(raw)); st.resetItemCache();
  return out;
});
ck('第二章通关后 2 个信物位：第二件信物放进空着的第二位', r2.slots === 2 && r2.twoOk, r2);
ck('同名信物不能两格叠：换掉同名的那件', r2.same, r2);
ck('两个信物的词条都算进兵装加成', r2.regen && r2.ally, r2);
ck('第二位可卸下，存档读回保留；存档没通关时第二位不生效但不丢', r2.unequip && r2.reload && r2.relock, r2);

// 行囊界面：人像下排正中是「信物·二」，原「本局宝物」格已撤
const r3 = await p.evaluate(async () => {
  const UI = await window.__mod('/src/ui/ItemBagUI.ts'), m = window.__game.scene.getScene('MenuScene'); const ui = new UI.ItemBagUI(m, { hero: 'zhaoyun' });
  await new Promise(r => setTimeout(r, 300));
  const root = ui.root, t2 = window.__find(root, 'item-slot-token2'), t1 = window.__find(root, 'item-slot-token'), relic = window.__find(root, 'item-slot-relic'), mount = window.__find(root, 'item-slot-mount');
  const out = { t2: !!t2, label: window.__find(root, 'item-slot-label-token2')?.text, treasure: !!window.__find(root, 'item-treasure-0'), y: t2 && relic ? Math.abs(t2.y - relic.y) : -1, between: t2 && relic && mount ? t2.x > mount.x && t2.x < relic.x : false, t1: !!t1 };
  return out;
});
ck('行囊：「信物·二」在人像下排正中（坐骑与 Boss遗物之间），本局宝物格已撤', r3.t2 && r3.t1 && r3.y < 2 && r3.between && !r3.treasure && /虎钮印|玉佩/.test(r3.label ?? ''), r3);
await p.screenshot({ path: 'assets/review/token-slots-bag-1280x720.png' });

ck('控制台无报错', errors.length === 0, errors.slice(0, 6));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
