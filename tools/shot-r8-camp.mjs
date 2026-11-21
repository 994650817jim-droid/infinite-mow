// 第六轮试玩（2026-11-21）：行营「将帅帐」左栏不溢出、全局提示（兵装没穿等）放顶栏空位不压任何页签、资源行缩短（属性点说明放悬停）、布阵说明不挤。电脑布局。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-r8-camp.mjs → assets/review/r8-fix/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/r8-fix'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 600))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('c')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('c', '1'); } });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2; }, null, { timeout: 180000 });
// 内容最多的一种：本命满级 + 兵器专职 + 两门武学 + 属性加满 + 2 点未分配
await p.evaluate(async () => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.();
  s.__DEV_ACTIONS.weaponNative5(); for (let i = 0; i < 6 && s.mode !== 'none'; i++) { if (s.mode === 'branch') s.chooseBranch(0); else s.__DEV_ACTIONS.closePopup?.(); }
  const w0 = s.player.weapons[0]; if (w0) { w0.level = Math.max(w0.level, 5); w0.branch = w0.branch ?? 'zy_longdan'; w0.over = 1; } const g = s.player.growth; g.attributes.agility = 28; g.unallocated = 2; for (const k of Object.keys(g.masteries ?? {})) g.masteries[k] = 3;
  s.resting = true; s.setMode('rest'); s.campUI.open('r8', '定军山'); });
await p.waitForTimeout(5500);
const tabs = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return s.campUI.root.list.filter(o => /^camp-tab-\d+$/.test(o.name ?? '') && o.visible).map(o => o.name); });
const hide = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); for (const o of s.children.list) if (/^rest-summary|hero-bark|toast/.test(o.name ?? '')) o.setVisible?.(false); document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }); });
const notice = '缴获的兵装还没穿上（6 件更好）：点右上「行囊」，再点「一键穿戴」';
for (const t of tabs) {
  const r = await p.evaluate(([n, msg]) => { const s = window.__game.scene.getScene('GameScene'), ui = s.campUI; ui.root.getByName(n).emit('pointerdown'); ui.notice = msg; ui.render?.(); return { text: ui.detail?.text, y: Math.round(ui.detail?.y ?? -1) }; }, [t, notice]);
  await p.waitForTimeout(600); await hide(); await p.screenshot({ path: `${OUT}/${t}.png` });
  // 提示行与本页内容不相交（页内对象：camp 根容器里 body 的子对象）
  const hit = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), ui = s.campUI, d = ui.detail.getBounds(); const out = []; const walk = l => { for (const o of l) { if (o === ui.detail || !o.visible || !o.getBounds) continue; if (o.list) { walk(o.list); continue; } if (o.type !== 'Text') continue; const b = o.getBounds(); if (b.width > 0 && b.x < d.right && b.right > d.x && b.y < d.bottom && b.bottom > d.y) out.push(o.text?.slice(0, 20)); } }; walk(ui.body?.list ?? []); return out; });
  ck(`${t}：全局提示在顶栏空位、不压本页文字`, r.y < 100 && hit.length === 0, { r, hit });
}
// 将帅帐左栏：最后一行（属性）在左框内
const left = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), ui = s.campUI; const tab = ui.root.list.find(o => /^camp-tab-\d+$/.test(o.name ?? '') && ui.root.list.some(x => x.type === 'Text' && x.text === '将帅帐' && Math.abs(x.x - o.x) < 140 && Math.abs(x.y - o.y) < 40)); tab?.emit('pointerdown'); const all = []; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (o.name) all.push(o); } }; walk(ui.root.list); const attr = all.filter(o => /-attr-(strength|agility|intellect|command)$/.test(o.name)).map(o => Math.round(o.getBounds().bottom)); const fin = all.find(o => /-branch-final$/.test(o.name)); return { attrBottom: Math.max(...attr), finalRight: fin ? Math.round(fin.getBounds().right) : null, res: ui.resources?.text }; });
await p.waitForTimeout(400); await hide(); await p.screenshot({ path: `${OUT}/general-tent.png` });
ck('将帅帐左栏：属性条、进阶行都在面板内；资源行不再带长括号', left.attrBottom > 0 && left.attrBottom < 440 && !/（/.test(left.res ?? ''), left);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
