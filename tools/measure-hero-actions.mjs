// 量武将 v2 行走图（4×4）与动作图（4×7）每帧人物包围盒（不透明像素），按行汇总：中位身高、中位脚底（最低不透明行）。
// 用法：node tools/measure-hero-actions.mjs [heroes...] → 打印 JSON；--json=out.json 写文件。不需要开发服务器。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const HEROES = ['zhaoyun', 'guanyu', 'zhangfei', 'huangzhong', 'zhuge', 'machao', 'weiyan', 'liubei', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan'];
const args = process.argv.slice(2), out = args.find(a => a.startsWith('--json='))?.slice(7), list = args.filter(a => !a.startsWith('--'));
const walkFile = h => `public/assets/processed-v2/${h === 'zhaoyun' ? 'zhaoyun' : h}_walk_sheet.png`, actFile = h => `public/assets/hero-actions-v2/${h}.png`;
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
// rows = 0：按方格推行数（v2 行走图 4×4，带站立行的是 4×5）
const measure = (file, cols, rows) => p.evaluate(async ({ d, cols, rows }) => {
  const im = new Image(); im.src = d; await im.decode(); if (!rows) rows = Math.round(im.height / (im.width / cols)); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const cw = im.width / cols, ch = im.height / rows, res = [];
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const px = g.getImageData(col * cw, r * ch, cw, ch).data; let top = -1, bottom = -1, left = cw, right = -1, area = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (px[(y * cw + x) * 4 + 3] > 40) { area++; if (top < 0) top = y; bottom = y; if (x < left) left = x; if (x > right) right = x; }
    res.push(top < 0 ? null : { r, c: col, top, bottom, h: bottom - top + 1, w: right - left + 1, area });
  }
  return { cw, ch, frames: res };
}, { d: 'data:image/png;base64,' + readFileSync(file).toString('base64'), cols, rows });
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const result = {};
for (const h of list.length ? list : HEROES) {
  let w, a; try { w = await measure(walkFile(h), 4, 0); a = await measure(actFile(h), 4, 7); } catch (e) { result[h] = { error: String(e).slice(0, 120) }; continue; }
  const row = (m, r, cols = [0, 1, 2, 3]) => { const f = m.frames.filter(x => x && x.r === r && cols.includes(x.c)); return { h: med(f.map(x => x.h)), foot: med(f.map(x => x.bottom)), area: med(f.map(x => x.area)), hs: f.map(x => x.h), feet: f.map(x => x.bottom), areas: f.map(x => x.area) }; };
  result[h] = { walkCell: w.cw, actCell: a.cw, walk: { down: row(w, 0), left: row(w, 1), right: row(w, 2), up: row(w, 3) }, act: { idle: row(a, 0), atkDown: row(a, 1), atkRight: row(a, 2), atkUp: row(a, 3), skill: row(a, 4), hurt: row(a, 5, [0, 1]), win: row(a, 5, [2, 3]), die: row(a, 6, [0]) } };
}
await b.close();
if (out) writeFileSync(out, JSON.stringify(result, null, 1));
for (const [h, r] of Object.entries(result)) {
  if (r.error) { console.log(h, r.error); continue; }
  const wd = r.walk.down.h, idle = r.act.idle.h;
  console.log(`${h.padEnd(13)} walk ${r.walkCell} h=${wd}/${r.walk.right.h}/${r.walk.up.h} foot=${r.walk.down.foot} | act ${r.actCell} ` + Object.entries(r.act).map(([k, v]) => `${k}:${v.h}@${v.foot}`).join(' ') + `  atk/idle=${(r.act.atkDown.h / idle).toFixed(2)},${(r.act.atkRight.h / idle).toFixed(2)},${(r.act.atkUp.h / idle).toFixed(2)}`);
}

// —— 生成校正表：--emit=src/data/heroActionFit.ts ——
// 每行人物「大小」用不透明像素面积的平方根量（下蹲 / 举兵器时高度会变，面积基本不变），
// 再按行走图同朝向的面积比归一（侧面 / 背面本来就比正面窄）；与待机行（Player 的整套比例参照）比，偏差超过 4% 的行校正回去（验收线 5%，留余量）。
const emit = args.find(a => a.startsWith('--emit='))?.slice(7);
if (emit) {
  const ROWDIR = { idle: 'down', atkDown: 'down', atkRight: 'right', atkUp: 'up', skill: 'down', hurt: 'down', win: 'down', die: 'down' };
  const FRAMES = { idle: [0, 1, 2, 3], atkDown: [4, 5, 6, 7], atkRight: [8, 9, 10, 11], atkUp: [12, 13, 14, 15], skill: [16, 17, 18, 19], hurt: [20, 21], win: [22, 23], die: [24, 25, 26, 27] };
  const lines = [];
  for (const [h, r] of Object.entries(result)) {
    if (r.error) continue;
    const per = Array(28).fill(1), notes = [];
    for (const [k, fr] of Object.entries(FRAMES)) {
      const d = ROWDIR[k], s = Math.sqrt((r.act[k].area / r.act.idle.area) / (r.walk[d].area / r.walk.down.area));
      const c = Math.abs(1 - s) > .04 ? Math.min(1.15, Math.max(.87, 1 / s)) : 1;
      for (const f of fr) per[f] = +c.toFixed(3); if (c !== 1) notes.push(`${k} ×${c.toFixed(2)}`);
    }
    lines.push(`  ${h}_actions: [${per.join(', ')}], // ${notes.join('，') || '无需校正'}`);
  }
  writeFileSync(emit, `/**
 * 武将动作图集（v2，4×7）逐帧尺寸校正（用户 11-18「赵云攻击戳出去人物变小，戳完又变回来」）：
 * ChatGPT 出图时攻击 / 技能等行的人物常画得比待机行小，而 Player 整套动作只用一个比例（按待机行对行走图），所以出招时人物变小。
 * 本表由 tools/measure-hero-actions.mjs --emit 从图里自动量出（面积平方根、按行走图同朝向归一），偏差超过 4% 的行乘上校正（0.87～1.15，验收线 5%），脚线不动。
 * 换图后重跑：node tools/measure-hero-actions.mjs --emit=src/data/heroActionFit.ts
 */
export const HERO_ACTION_SCALE: Readonly<Record<string, readonly number[]>> = {
${lines.join('\n')}
};
`);
  console.log('emitted', emit);
}
