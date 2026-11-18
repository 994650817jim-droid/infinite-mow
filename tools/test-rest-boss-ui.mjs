// 入营水墨过场、追兵首领血条与战线推进提示、蜀弓兵攻击帧切图。需要开发服务器 5173。用法：node tools/test-rest-boss-ui.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PADJS } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/rest-boss-ui';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const battle = async () => {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(PADJS);
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); }, G);
  await p.waitForTimeout(500); return p;
};
// —— 入营过场 ——
{
  const p = await battle();
  await p.evaluate(G0 => { const s = eval(G0); s.bossKilled = true; s.finish(true); }, G);
  await p.waitForTimeout(150);
  const s0 = await p.evaluate(G0 => { const s = eval(G0), i = s.children.getByName('rest-intro'); return { mode: s.mode, intro: !!i, camp: s.children.getByName('camp-rest')?.visible }; }, G);
  ck('胜利后先播入营过场，行营界面暂时隐藏', s0.mode === 'rest' && s0.intro && s0.camp === false, s0);
  await p.waitForTimeout(1900);
  const s1 = await p.evaluate(G0 => { const s = eval(G0), i = s.children.getByName('rest-intro'); return { title: i?.list.find(o => o.type === 'Text' && /平定/.test(o.text))?.text, alpha: i?.list.find(o => o.type === 'Text' && /平定/.test(o.text))?.alpha }; }, G);
  await p.screenshot({ path: `${out}/intro-title.png` });
  ck('过场中央朱砂大字「广宗外围 · 平定」', s1.title === '广宗外围 · 平定' && s1.alpha > .8, s1);
  await p.waitForTimeout(1400);
  const s2 = await p.evaluate(G0 => { const s = eval(G0); return { intro: !!s.children.getByName('rest-intro'), camp: s.children.getByName('camp-rest')?.visible }; }, G);
  ck('约 3 秒后过场结束，露出行营', !s2.intro && s2.camp === true, s2);
  await p.screenshot({ path: `${out}/camp.png` });
  await p.close();
}
// —— 跳过：手柄 Ⓐ ——
{
  const p = await battle();
  await p.evaluate(G0 => { const s = eval(G0); s.bossKilled = true; s.finish(true); }, G);
  await p.waitForTimeout(300);
  await p.evaluate(async () => { window.__vpad.buttons[0] = 1; await new Promise(r => setTimeout(r, 100)); window.__vpad.buttons[0] = 0; });
  await p.waitForTimeout(200);
  const s = await p.evaluate(G0 => { const s = eval(G0); return { intro: !!s.children.getByName('rest-intro'), camp: s.children.getByName('camp-rest')?.visible }; }, G);
  ck('手柄 Ⓐ 跳过过场，直接进行营', !s.intro && s.camp === true, s);
  await p.close();
}
// —— 追兵首领血条 + 战线推进提示 ——
{
  const p = await battle();
  await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.boss(); }, G);
  await p.waitForFunction(G0 => eval(G0).boss?.active, G, { timeout: 15000 });
  // 首领出场：名号标题 + 专属主题
  const intro = await p.evaluate(G0 => { const s = eval(G0), a = s.children.getByName('boss-announce'); return { card: a?.list.filter(o => o.type === 'Text').map(o => o.text), music: s.music.bossName }; }, G);
  ck('首领出场：墨条标题「人公将军 / 张梁」，战斗曲切到张梁专属主题', intro.card?.[0] === '人公将军' && intro.card?.[1] === '张梁' && intro.music === '张梁', intro);
  await p.waitForTimeout(400); await p.screenshot({ path: `${out}/boss-announce.png` });
  await p.waitForTimeout(2600);
  ck('名号标题约 2.7 秒后自动消失', !(await p.evaluate(G0 => !!eval(G0).children.getByName('boss-announce'), G)));
  const themes = await p.evaluate(async () => { const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /\/src\/data\/bossMusic\.ts/.test(n)); const m = await import(u); const names = Object.keys(m.BOSS_PROFILES); const sig = names.map(n => JSON.stringify(m.composeBossMelody(m.BOSS_PROFILES[n]).filter(Boolean).slice(0, 12))); return { count: names.length, unique: new Set(sig).size, siege: m.bossProfile('某城守将').title, guess: m.bossProfile('天公将军张角').name }; });
  ck('各首领旋律互不相同（2026-11-17 共 ' + themes.count + ' 位）；攻城守将用通用主题；名字含首领名时匹配', themes.count >= 15 && themes.unique === themes.count && themes.siege === '城池守将' && themes.guess === '张角', themes);
  await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.advanceFrontline(); }, G);
  await p.waitForFunction(G0 => eval(G0).chasingBosses?.length > 0, G, { timeout: 10000 });
  await p.waitForTimeout(400);
  const r = await p.evaluate(G0 => { const s = eval(G0); /* 2026-11-17：推进战线给的经验会弹升级三选一（暂停 HUD），先选完 */ for (let k = 0; k < 40 && s.mode === 'levelup'; k++) s.chooseUpgrade(0); s.hudAcc = 1; s.updateHud(); const t = s.hudTexts, n = s.children.list.find(o => o.name === 'combat-notice'); return { boss: t.boss.visible, name: t.boss.text, hp: t.bossHp.visible, stage: s.chapter.name, wave: t.wave.text, notice: n?.list?.filter(o => o.type === 'Text').map(o => o.text) }; }, G);
  ck('首领未击败、战线推进后：血条仍显示（名字带「追兵」）', r.boss && r.hp && /追兵$/.test(r.name), r);
  ck('战线推进提示含新关名与「第 1/N 波」，且不被第 1 波提示顶掉', /^战线推进 · 1-2 .+ · 第 1\/\d+ 波$/.test(r.notice?.[0] ?? '') && /^第 1\/\d+ 波/.test(r.wave), r);
  await p.screenshot({ path: `${out}/chaser-bar.png` });
  await p.close();
}
// —— 蜀弓兵攻击帧：格边无他帧残留 ——
{
  const p = await battle();
  const seam = await p.evaluate(G0 => {
    const s = eval(G0), t = s.textures.get('shu_archer_attack_sheet'), img = t.getSourceImage(), c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, a = (x, y) => d[(y * c.width + x) * 4 + 3];
    // 2026-11-17：弓兵图集换成 v2（格子 176），按帧切片检查每个出手帧左右最外 2 像素无他帧残留
    let left = 0, right = 0; for (const n of t.getFrameNames().filter(n => /^atk_/.test(n))) { const f = t.get(n); for (let y = f.cutY; y < f.cutY + f.cutHeight; y++) { for (let x = f.cutX; x < f.cutX + 2; x++) if (a(x, y) > 24) left++; for (let x = f.cutX + f.cutWidth - 2; x < f.cutX + f.cutWidth; x++) if (a(x, y) > 24) right++; } }
    return { left, right };
  }, G);
  ck('弓兵出手帧格子左右边缘无他帧残留（v2 图集）', seam.left === 0 && seam.right === 0, seam);
  await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 4));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
