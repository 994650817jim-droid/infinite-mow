// 录「首领倒地 → 掉宝箱 → 主将走过去捡遗物 → 结算」GIF（电脑布局）。
// 用法：BASE=http://127.0.0.1:5188/ node tools/record-boss-chest-gif.mjs zhangjiao [输出目录]（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openBoss } from './boss-v2-open.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', boss = process.argv[2] ?? 'zhangjiao', out = process.argv[3] ?? 'assets/review/boss-chest', vid = out + '/video-' + boss;
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
const { scene } = await openBoss(p, BASE, boss);
const ev = (fn, arg) => p.evaluate(([g, f, a]) => { const s = window.__game.scene.getScene(g); return new Function('s', 'a', 'return (' + f + ')(s,a)')(s, a); }, [scene, fn.toString(), arg]);
await ev(s => { s.__letDie = true; s.player.damageImmune = true; s.boss.sprite.setPosition(s.player.x + 300, s.player.y - 60); });
const t0 = Date.now();
await p.waitForTimeout(900);
await ev(s => s.killEnemy(s.boss));
await p.waitForTimeout(2600);
// 主将走向宝箱（每帧往宝箱挪一点，像玩家在走）
await ev(s => { const c = s.bossChests[0]; s.__walk = () => { if (!c || c.snapshot().opened) return; const dx = c.x - s.player.x, dy = c.y - s.player.y, d = Math.hypot(dx, dy) || 1; s.player.sprite.x += dx / d * 3.2; s.player.sprite.y += dy / d * 3.2; }; s.events.on('postupdate', s.__walk); });
await p.waitForTimeout(6500);
const elapsed = (Date.now() - t0) / 1000;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop();
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', webm]).toString().trim());
const ss = Math.max(0, dur - elapsed - .2).toFixed(2), gif = `${out}/${boss}.gif`;
execFileSync('ffmpeg', ['-y', '-ss', ss, '-i', webm, '-vf', 'fps=10,scale=640:-1:flags=lanczos,split[a][c];[a]palettegen=max_colors=96:stats_mode=diff[pl];[c][pl]paletteuse=dither=none:diff_mode=rectangle', gif], { stdio: 'ignore' });
renameSync(webm, `${out}/${boss}.webm`); rmSync(vid, { recursive: true, force: true });
console.log('gif', gif, 'seconds', elapsed.toFixed(1), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
