// 录首领重设计样板的手感 GIF（电脑布局 1280×720）：依次放每个招式 → 二阶段转场 → 二阶段招式。主将无敌、绕着首领走位。
// 用法：BASE=http://127.0.0.1:5188/ node tools/record-boss-gif.mjs zhangjiao [输出目录]（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openBoss } from './boss-v2-open.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', boss = process.argv[2] ?? 'zhangjiao', out = process.argv[3] ?? 'assets/review/boss-v2', vid = out + '/video-' + boss;
/** 每个首领的演示脚本：[招式序号 | 'p2', 等待毫秒]。 */
const PLAN = {
  zhangjiao: [[0, 2600], [1, 2300], [2, 1600], ['break', 3600], ['p2', 2200], [3, 4200], [0, 2600]],
  lubu: [[0, 3000], [1, 2800], [2, 2600], ['p2', 2200], [4, 3400], [0, 3400]],
  yuanshu: [[0, 4200], ['killFlags', 600], [1, 2800], [2, 2600], ['p2', 5200]],
  caoren: [['wait', 3000], [0, 5400], [1, 2200], ['rotate', 2500], ['p2', 2400], ['wait', 5200]],
}[boss];
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
const { scene } = await openBoss(p, BASE, boss);
const ev = (fn, arg) => p.evaluate(([g, f, a]) => { const s = window.__game.scene.getScene(g); return new Function('s', 'a', 'return (' + f + ')(s,a)')(s, a); }, [scene, fn.toString(), arg]);
await ev(s => { s.player.damageImmune = true; s.player.hp = s.player.maxHp; s.boss.sprite.setPosition(s.player.x + 200, s.player.y - 20); });
// 主将自动走位：绕首领转圈（半径 190），像玩家在躲
await ev(s => { const t0 = s.combatNow; s.__orbit = () => { if (!s.boss?.active) return; const a = (s.combatNow - t0) / 1600, r = 190; s.player.sprite.x += (s.boss.x + Math.cos(a) * r - s.player.x) * .06; s.player.sprite.y += (s.boss.y + Math.sin(a) * r * .8 - s.player.y) * .06; }; s.events.on('postupdate', s.__orbit); });
const t0 = Date.now();
await p.waitForTimeout(600);
for (const [step, ms] of PLAN) {
  await ev((s, st) => {
    const d = s.bossDebug(), c = s.controller;
    if (st === 'p2') d.phase2(s.combatNow);
    else if (st === 'break') { for (const q of s.zhangjiao.pillars) s.killEnemy(q.e); }
    else if (st === 'killFlags') { for (const f of c.flags) s.killEnemy(f.e); }
    else if (st === 'rotate') c.rotateAt = s.combatNow;
    else if (typeof st === 'number') d.force(st, s.combatNow);
  }, step);
  await p.waitForTimeout(ms);
}
const elapsed = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop();
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm]).toString().trim());
const ss = Math.max(0, dur - elapsed - .2).toFixed(2), gif = `${out}/${boss}.gif`;
execFileSync('ffmpeg', ['-y', '-ss', ss, '-i', webm, '-vf', 'fps=8,scale=520:-1:flags=lanczos,split[a][c];[a]palettegen=max_colors=64:stats_mode=diff[pl];[c][pl]paletteuse=dither=none:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${out}/${boss}.webm`); rmSync(vid, { recursive: true, force: true });
console.log('gif', gif, 'seconds', elapsed.toFixed(1), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
