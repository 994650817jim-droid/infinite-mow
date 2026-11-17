// 从图集裁一块另存（拆分合并出图的序列帧用）。用法：SRC=a.png OUT=b.png X=0 Y=0 W=576 H=384 node tools/crop-sheet.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC, OUT } = process.env, [X, Y, W, H] = ['X', 'Y', 'W', 'H'].map(k => +(process.env[k] ?? 0));
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const url = await p.evaluate(async ([s, X, Y, W, H]) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(i, X, Y, W, H, 0, 0, W, H); return c.toDataURL('image/png'); }, [readFileSync(SRC).toString('base64'), X, Y, W, H]);
writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64')); console.log(`${OUT}  ${W}×${H}`);
await b.close();
