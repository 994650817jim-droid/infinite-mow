// 录一段完整开场（实时播放，不跳转）作预览：输出 assets/review/opening/opening-preview.webm（再用 ffmpeg 转 mp4）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/record-opening.mjs
import { chromium } from 'playwright';
import { mkdirSync, renameSync, readdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', dir = 'assets/review/opening/rec';
mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.addInitScript(() => { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); });
await p.goto(base + '?layout=desktop&opening=1');
await p.waitForFunction(() => window.__game?.scene.isActive('OpeningScene'), null, { timeout: 120000 });
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 });
await p.waitForTimeout(1500);
await ctx.close(); await b.close();
const f = readdirSync(dir).find(n => n.endsWith('.webm'));
renameSync(`${dir}/${f}`, 'assets/review/opening/opening-preview.webm');
console.log('saved assets/review/opening/opening-preview.webm');
