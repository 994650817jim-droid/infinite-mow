// 12 将脚下被动刻度（用户 2026-11-18「我想每个角色都加类似于赵云脚下那个被动，可以知道被动触发到哪里，符合角色」）。电脑版。
// 每位武将：0 层全熄灭 → 积到一半亮对应枚数 → 满层流光（两帧交替）→ 被动触发时一齐闪亮放大 → 回到熄灭；赵云仍是龙鳞（PassiveGauge 转发 ZhaoyunPassiveFx）。
// 产出：assets/review/passive-gauge/contact-sheet.png（12 将 × 空 / 半 / 满）、passive-gauge.gif（关羽 / 诸葛亮 / 马超 积满并触发；需要 ffmpeg）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-passive-gauge.mjs
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/passive-gauge', vid = `${out}/video`;
rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true }); mkdirSync(`${out}/crops`, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || d === undefined ? '' : ' · ' + JSON.stringify(d).slice(0, 420))); };
const HEROES = [['zhaoyun', '赵云'], ['guanyu', '关羽'], ['zhangfei', '张飞'], ['huangzhong', '黄忠'], ['machao', '马超'], ['zhuge', '诸葛亮'], ['liubei', '刘备'], ['pangtong', '庞统'], ['huangyueying', '黄月英'], ['weiyan', '魏延'], ['sunshangxiang', '孙尚香'], ['diaochan', '貂蝉']];
const GIF_HEROES = ['guanyu', 'zhuge', 'machao'];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(), tv = Date.now(); // 录像从这里开始计时
p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 180000 });
await p.waitForTimeout(1200);
const t0 = tv; let gifStart = 0, gifEnd = 0;

/** 换成某位武将重开本关，清场、无敌、停刷怪。 */
const useHero = async id => {
  await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); window.__prev = s.player; s.scene.restart(); }, [G, id]);
  await p.waitForTimeout(500);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.player !== window.__prev && s.runConfig?.character === id && s.__DEV_ACTIONS && s.passiveGauge; }, id, { timeout: 60000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); for (const w of s.player.weapons) w.cooldownLeft = 1e9; }, G);
  await p.waitForTimeout(300);
};
/** 拨被动层数（诸葛亮拨星象，黄忠满层 = 进入神射）。 */
const setStacks = (k, max) => p.evaluate(([G0, k, max]) => {
  const s = eval(G0), ps = s.player.passive, now = s.combatNow;
  for (const w of s.player.weapons) w.cooldownLeft = 1e9;
  if (ps.characterId === 'zhuge') { ps.stars.clear(); ps.crowdStar = { marks: k, last: now }; } // 清掉开局天火留下的单体星象，只看拨的层数
  else if (ps.characterId === 'huangzhong') { if (k >= max) { ps.stacks = 0; ps.sharpUntil = now + 60000; } else { ps.sharpUntil = -Infinity; ps.stacks = k; } }
  else ps.stacks = k;
}, [G, k, max]);
/** 被动触发：层数清零 + 触发计数 +1（与 CharacterPassives 里真正触发时一致）。 */
// 触发后在同一次 evaluate 里等两帧再读刻度（录像时往返慢，闪光窗口 0.38 秒可能已过）
const fire = () => p.evaluate(async G0 => { const s = eval(G0), ps = s.player.passive; if (ps.characterId === 'zhuge') { ps.stars.clear(); ps.crowdStar = { marks: 0, last: -Infinity }; } else if (ps.characterId === 'huangzhong') ps.sharpUntil = -Infinity; ps.stacks = 0; ps.triggers++;
  for (let i = 0; i < 2; i++) await new Promise(r => requestAnimationFrame(() => r())); return s.passiveGauge.debug(); }, G);
const dbg = () => p.evaluate(G0 => { const s = eval(G0), g = s.passiveGauge, icons = s.children.list.filter(x => x.name?.startsWith('passive-gauge-') && x.visible), pl = s.player;
  return { ...g.debug(), zy: g.zhaoyun.debug(), pos: icons.map(x => [Math.round(x.x - pl.x), Math.round(x.y - pl.y), Math.round(x.displayWidth)]), depthOk: icons.every(x => x.depth < pl.sprite.depth) }; }, G);
/** 等刻度追上被动的实际读数（机器忙时游戏帧慢于真实时间，不能只靠固定等待）。 */
const settle = () => p.waitForFunction(G0 => { const s = eval(G0), g = s.passiveGauge, ps = s.player.passive, sn = ps.snapshot(s.combatNow);
  if (ps.characterId === 'zhaoyun') { const z = g.zhaoyun.debug(); return z.modes.filter(m => m === 'lit').length === sn.stacks; }
  const d = g.debug(); return d.slots > 0 && d.lit === Math.max(0, Math.min(d.slots, Math.floor(d.value * d.slots / d.max + 1e-6))); }, G, { timeout: 8000, polling: 50 }).catch(() => {});
const crop = async name => {
  const clip = await p.evaluate(G0 => { const s = eval(G0), cam = s.cameras.main, r = s.game.canvas.getBoundingClientRect(), k = r.width / s.scale.width;
    const sx = r.left + (s.player.x - cam.worldView.x) * cam.zoom * k, sy = r.top + (s.player.y - cam.worldView.y) * cam.zoom * k, w = 70 * cam.zoom * k, h = 62 * cam.zoom * k;
    return { x: Math.round(sx - w), y: Math.round(sy - h * 1.05), width: Math.round(w * 2), height: Math.round(h * 1.75) }; }, G);
  await p.screenshot({ path: `${out}/crops/${name}.png`, clip });
};

const results = {};
for (const [id, name] of HEROES) {
  await useHero(id);
  const max = await p.evaluate(G0 => eval(G0).passiveGauge.debug().max || eval(G0).player.passive.snapshot(eval(G0).combatNow).maxStacks, G);
  const gif = GIF_HEROES.includes(id);
  if (gif && !gifStart) gifStart = (Date.now() - t0) / 1000;
  await setStacks(0, max); await p.waitForTimeout(450); await settle();
  const r = { idle: await dbg() }; await crop(`${id}-0`);
  const M = id === 'zhaoyun' ? 7 : r.idle.max, half = Math.ceil(M / 2);
  for (let k = 1; k <= half; k++) { await setStacks(k, M); await p.waitForTimeout(gif ? 420 : 140); }
  await p.waitForTimeout(350); await settle(); r.half = await dbg(); await crop(`${id}-1`);
  for (let k = half + 1; k <= M; k++) { await setStacks(k, M); await p.waitForTimeout(gif ? 420 : 140); }
  await p.waitForTimeout(400); await settle(); r.full = await dbg(); await crop(`${id}-2`); await p.waitForTimeout(220); r.full2 = await dbg();
  if (gif) await p.waitForTimeout(900);
  r.flash = await fire();
  await p.waitForTimeout(gif ? 900 : 500); r.after = await dbg();
  if (gif) gifEnd = (Date.now() - t0) / 1000;
  results[id] = r;
  if (id === 'zhaoyun') {
    ck('赵云：仍是龙鳞（7 枚，叠满流光），共用刻度不另画', r.idle.slots === 0 && !r.idle.visible && r.half.zy.visible && r.half.zy.modes.filter(m => m === 'lit').length === 4 && r.full.zy.frames.every(f => f >= 12), { half: r.half.zy, full: r.full.zy.frames });
    continue;
  }
  const S = r.idle.slots, exp = d => Math.floor(d.value * S / d.max + 1e-6), expIdle = exp(r.idle), expHalf = exp(r.half), base = r.idle.base;
  ck(`${name}：开局 ${S} 枚刻度都在脚下前半圈，亮的枚数 = 被动读数（${r.idle.value}/${r.idle.max}）`, S > 0 && r.idle.visible && r.idle.lit === expIdle && expIdle <= 1 && r.idle.frames.every((f, i) => i < expIdle ? f === base + 1 || f === base + 2 : f === base) /* 刚亮的一枚可能还在放大回弹（流光帧） */ && r.idle.pos.length === S && r.idle.pos.every(([dx, dy, w]) => Math.abs(dx) <= 32 && dy >= 26 && dy <= 42 && w <= 18) && r.idle.depthOk, r.idle);
  ck(`${name}：积到 ${r.half.value}/${r.half.max} → 亮 ${expHalf} 枚（点亮帧），其余熄灭`, r.half.lit === expHalf && expHalf > 0 && expHalf < S && r.half.frames.slice(0, expHalf).every(f => f === base + 1) && r.half.frames.slice(expHalf).every(f => f === base) && !r.half.ready, r.half);
  ck(`${name}：满层 → ${S} 枚全亮、流光两帧交替（ready）`, r.full.lit === S && r.full.ready && r.full.frames.every(f => f === base + 2 || f === base + 3) && (r.full.frames.join() !== r.full2.frames.join() || new Set(r.full.frames).size === 2), [r.full, r.full2.frames]);
  ck(`${name}：被动触发 → 一齐闪亮放大；之后回到全熄灭`, r.flash.flashing && r.flash.stats.flashes === 1 && r.flash.frames.every(f => f === base + 3) && !r.after.flashing && r.after.lit === 0 && r.after.frames.every(f => f === base), [r.flash, r.after]);
}
await p.evaluate(G0 => eval(G0).passiveGauge.debug(), G);
await ctx.close(); await b.close();

// 联系表：12 将 × 空 / 半 / 满
const rows = HEROES.map(([id, name]) => `<tr><th>${name}</th>${[0, 1, 2].map(k => `<td><img src="data:image/png;base64,${readFileSync(`${out}/crops/${id}-${k}.png`).toString('base64')}"></td>`).join('')}</tr>`).join('');
const b2 = await chromium.launch({ channel: 'chrome', headless: true }); const p2 = await b2.newPage({ viewport: { width: 900, height: 600 } });
await p2.setContent(`<body style="margin:0;background:#1d1a16;color:#f0e2c2;font:16px 'Microsoft YaHei'"><table style="border-spacing:6px;padding:8px"><tr><th></th><th>0 层</th><th>积到一半</th><th>满层（流光）</th></tr>${rows}</table><style>img{height:150px;display:block;border-radius:4px}th{padding:0 8px;font-weight:600}</style></body>`);
await p2.screenshot({ path: `${out}/contact-sheet.png`, fullPage: true }); await b2.close();
console.log('联系表:', `${out}/contact-sheet.png`);

const webm = readdirSync(vid).find(f => f.endsWith('.webm'));
if (webm && gifEnd > gifStart) {
  try {
    execFileSync('ffmpeg', ['-y', '-ss', String(gifStart), '-to', String(gifEnd + .3), '-i', `${vid}/${webm}`, '-vf', 'fps=12,crop=300:220:490:250,scale=450:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', `${out}/passive-gauge.gif`], { stdio: 'ignore' });
    renameSync(`${vid}/${webm}`, `${vid}/passive-gauge.webm`); console.log('GIF:', `${out}/passive-gauge.gif`);
  } catch (e) { console.log('GIF 未生成（ffmpeg）:', String(e).slice(0, 120)); }
}
ck('无页面报错 / 控制台错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
