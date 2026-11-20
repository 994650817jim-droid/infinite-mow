// 战法特效手绘图集：把 7 张黑底手绘 6×4 图（已去底的整张透明图）按「样式行」拼成 build_vfx 新图集（每格 128，6 列，行序 = BuildVfx.VFX_STYLES + 额外样式）。
// 用法：node tools/build-vfx-atlas.mjs   （先对每张原图跑 FULL=<名> node tools/prepare-fx-strips.mjs <原图> public/assets/school-fx <a,b,c,d>）
// 输出：public/assets/build-vfx/styles-hp-v1.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const CELL = 128, COLS = 6, DIR = 'public/assets/school-fx/';
/** 行序：BuildVfx.VFX_STYLES 的 20 个，再接额外样式（ember 点燃火花 / pull 牵机 / stun_burst 眩晕爆 / sunder_hit 破甲一击 / heavy 重击震荡 / reinforce 援军 / watch 守望 / breakout 破围）。 */
const ORDER = ['combo', 'critical', 'skirmish', 'flame', 'charge', 'control', 'command', 'bulwark', 'pure_combo', 'pure_critical', 'pure_skirmish', 'pure_flame', 'pure_charge', 'pure_control', 'pure_command', 'pure_bulwark', 'fire_gate', 'peerless', 'roaming_break', 'iron_army',
  'ember', 'pull', 'stun_burst', 'sunder_hit', 'heavy', 'reinforce', 'watch', 'breakout'];
/** 哪张图的第几行 = 哪个样式。 */
const SRC = {
  fire: ['flame', 'pure_flame', 'fire_gate', 'ember'], ink: ['control', 'pure_control', 'pull', 'stun_burst'], arch: ['critical', 'pure_critical', 'roaming_break', 'sunder_hit'],
  cav: ['skirmish', 'charge', 'pure_skirmish', 'pure_charge'], war: ['combo', 'pure_combo', 'peerless', 'heavy'], form1: ['command', 'bulwark', 'pure_command', 'pure_bulwark'], form2: ['iron_army', 'reinforce', 'watch', 'breakout'],
};
const placed = [];
for (const [k, styles] of Object.entries(SRC)) { const f = `${DIR}${k}.png`; if (!existsSync(f)) { console.log('缺', f); continue; } styles.forEach((st, r) => placed.push({ file: f, row: r, to: ORDER.indexOf(st) })); }
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const files = [...new Set(placed.map(p => p.file))], data = Object.fromEntries(files.map(f => [f, 'data:image/png;base64,' + readFileSync(f).toString('base64')]));
  const url = await page.evaluate(async ([placed, data, ROWS, CELL, COLS]) => {
    const imgs = {}; for (const [f, u] of Object.entries(data)) { const i = new Image(); i.src = u; await i.decode(); imgs[f] = i; }
    const c = document.createElement('canvas'); c.width = COLS * CELL; c.height = ROWS * CELL; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    for (const p of placed) g.drawImage(imgs[p.file], 0, p.row * 256, COLS * 256, 256, 0, p.to * CELL, COLS * CELL, CELL);
    return c.toDataURL('image/png');
  }, [placed, data, ORDER.length, CELL, COLS]);
  writeFileSync('public/assets/build-vfx/styles-hp-v1.png', Buffer.from(url.split(',')[1], 'base64')); console.log('wrote styles-hp-v1.png', COLS * CELL + '×' + ORDER.length * CELL, '行', placed.length, '/', ORDER.length);
} finally { await b.close(); }
