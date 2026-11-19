import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', keys = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(base + '?dev=1&autostart=1&chapter=hulao&stage=2&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 }); await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(keys => Object.fromEntries(keys.map(k => { const t = window.__game.textures; if (!t.exists(k)) return [k, 'MISSING']; const tx = t.get(k), n = tx.getFrameNames(); return [k, { n: n.length, first: n, src: [tx.source[0].width, tx.source[0].height] }]; })), keys), null, 1)); await b.close();
