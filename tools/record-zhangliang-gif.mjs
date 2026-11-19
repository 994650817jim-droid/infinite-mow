// 张梁行走 + 攻击短 GIF（电脑布局 1280×720，裁到首领周围）。需要 ffmpeg。
// 用法：BASE=http://127.0.0.1:5212/ TAG=after node tools/record-zhangliang-gif.mjs → assets/review/boss-ride/zhangliang_<TAG>.gif
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/boss-ride', vid = OUT + '/video-zl-' + TAG;
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const tCtx = Date.now(); const p = await ctx.newPage();
await p.goto(BASE + '?dev=1&layout=desktop&art=v2', { waitUntil: 'commit', timeout: 120000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(() => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 120000 }); await p.waitForTimeout(1000);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; const w = s.chapter?.waves; if (s.devSetTime) s.devSetTime(w?.length ? w[w.length - 1].start + 1 : 999); else s.spawnBoss?.(); });
for (let i = 0; i < 150; i++) { const ok = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); if (s.mode === 'story' || s.mode === 'parley') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } return !!s.boss?.active; }); if (ok) break; await p.waitForTimeout(300); }
await p.waitForTimeout(2500); console.log('boss', await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return JSON.stringify({ b: !!s.boss, act: s.boss?.active, mode: s.mode, t: s.elapsed }); }));
// 清场、主将无敌、绕首领走位
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); s.player.damageImmune = true; s.player.sprite.setPosition(s.boss.x - 170, s.boss.y + 20); });
const t0 = Date.now();
for (let i = 0; i < 28; i++) { await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); const a = (Date.now() / 1800) % (Math.PI * 2); s.player.damageImmune = true; s.player.sprite.setPosition(s.boss.x + Math.cos(a) * 200, s.boss.y + Math.sin(a) * 140); }); await p.waitForTimeout(250); }
const clip = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), cam = s.cameras.main, cv = s.game.canvas.getBoundingClientRect(), k = cv.width / cam.width; return { x: Math.round(cv.left + (s.boss.x - cam.worldView.x) * cam.zoom * k), y: Math.round(cv.top + (s.boss.y - cam.worldView.y) * cam.zoom * k) }; });
await ctx.close(); await b.close();
const f = readdirSync(vid).find(n => n.endsWith('.webm')), cx = Math.max(0, Math.min(1280 - 440, clip.x - 220)), cy = Math.max(0, Math.min(720 - 330, clip.y - 220));
execFileSync('ffmpeg', ['-y', '-ss', String(Math.max(0, (t0 - tCtx) / 1000 + 0.5).toFixed(1)), '-t', '5', '-i', vid + '/' + f, '-vf', `fps=8,scale=560:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, `${OUT}/zhangliang_${TAG}.gif`], { stdio: 'ignore' });
rmSync(vid, { recursive: true, force: true }); console.log('gif', `${OUT}/zhangliang_${TAG}.gif`, clip);
