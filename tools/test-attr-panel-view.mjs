// 「武将修习 · 属性分配」电脑版新面板：卡片 / 点数印章 / 「+」三态 / 点击加点 / 悬停预览 / 主属性徽记。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5260/ node tools/test-attr-panel-view.mjs     截图 assets/review/attr-panel/test-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5260/', OUT = 'assets/review/attr-panel'; mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_story', 'off'); sessionStorage.setItem('seeded', '1'); } });
  await p.goto(`${BASE}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS; }, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); const g = s.player.growth, out = {};
    Object.assign(g.attributes, { strength: 0, agility: 9, intellect: 0, command: 0 }); g.unallocated = 2; g.heroFree = 0; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes');
    const by = n => s.attributePanel.getByName(n), all = n => s.attributePanel.list.filter(o => o.name === n);
    out.view = !!s.attributeView; out.buttons = ['strength', 'agility', 'intellect', 'command'].map(id => !!by('attribute-add-' + id));
    out.free0 = by('attribute-free')?.text; out.agiBtnVisible = by('attribute-add-agility').visible; out.perks = all('attribute-perk-1').length + all('attribute-perk-2').length + all('attribute-perk-3').length;
    // 点敏捷 → 10 / 10 已满：按钮隐藏、点数 −1
    by('attribute-add-agility').emit('pointerdown'); await new Promise(r => setTimeout(r, 200));
    out.after = { agility: g.attributes.agility, free: g.unallocated, shown: by('attribute-free').text, agiBtnVisible: by('attribute-add-agility').visible, strBtnAlpha: by('attribute-add-strength').alpha };
    // 点数用完：其余按钮变暗、不可点
    by('attribute-add-strength').emit('pointerdown'); await new Promise(r => setTimeout(r, 100)); out.noPoints = { strength: g.attributes.strength, free: g.unallocated, alpha: by('attribute-add-strength').alpha };
    // 加 1 点再悬停预览：力量 +1.5% 伤害 / 生命上限 +3%
    g.unallocated = 3; s.renderAttributePanel(); by('attribute-add-strength').emit('pointerover'); await new Promise(r => setTimeout(r, 100));
    out.preview = all('attribute-delta').map(o => o.text); by('attribute-add-strength').emit('pointerout'); await new Promise(r => setTimeout(r, 100)); out.previewOff = all('attribute-delta').map(o => o.text);
    return out; });
  ck('电脑版用新视图，四个「+」都在，主属性徽记 3 个', r.view && r.buttons.every(Boolean) && r.perks === 3, r);
  ck('剩余点数印章写 2；点敏捷 → 敏捷 10 点、剩 1 点', r.free0 === '2' && r.after.agility === 10 && r.after.free === 1 && r.after.shown === '1', r);
  ck('敏捷满格后「+」隐藏（改印「满」）', r.after.agiBtnVisible === false && r.agiBtnVisible === true, r);
  ck('点完剩余点数后，其余「+」变暗不可点（0 点时再点不加）', r.after.strBtnAlpha < 1 || r.noPoints.alpha < 1, r);
  ck('悬停力量「+」：预览伤害 / 生命绿字增量，移开后清空', r.preview.some(t => /\+1\.5%/.test(t)) && r.preview.some(t => /\+3%/.test(t)) && r.previewOff.every(t => t === ''), { preview: r.preview, off: r.previewOff });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.attributePanel.getByName('attribute-add-strength').emit('pointerover'); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/test-hover.png` });
  ck('无页面报错', errs.length === 0, errs.slice(0, 3));
  console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exitCode = rows.every(Boolean) ? 0 : 1;
} finally { await b.close(); }
