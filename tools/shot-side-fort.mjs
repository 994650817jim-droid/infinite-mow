// 支线关的关隘 / 城池（总制作人第五轮：小沛只有一座孤城门 + 两座箭楼、两边没墙）：截小沛（攻城关 → 城墙 + 城门）与辕门射戟（野战 → 不放孤城门）。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-side-fort.mjs → assets/review/side-fort/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/side-fort';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  for (const [stage, tag] of [[1, 'xiaopei'], [2, 'yuanmen']]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
    await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
    await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 180000 });
    await p.evaluate(st => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.set('side_xiapiStage', st); s0.registry.set('runConfig', { character: 'zhaoyun' }); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== 'GameScene') sc.scene.stop(); s0.scene.start('SideXiapiGameScene'); }, stage);
    await p.waitForFunction(() => { const s = window.__game.scene.getScene('SideXiapiGameScene'); return window.__game.scene.isActive('SideXiapiGameScene') && s?.player && s.elapsed > .5; }, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const info = await p.evaluate(() => { const s = window.__game.scene.getScene('SideXiapiGameScene'); s.player.damageImmune = true; const P = s.player; s.player.sprite.setPosition(P.x + 220, P.y - 330); return { fort: s.fort, pass: !!s.sishuiPass, boss: s.chapter.enemies.boss.hp, bossAt: s.chapter.waves[s.chapter.waves.length - 1].start }; });
    await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/' + tag + '.png' });
    if (stage === 1) ck('小沛（攻城关）：城池（城墙 + 城门，SishuiPass）', info.fort?.kind === 'city' && info.pass, info);
    else ck('辕门射戟（野战）：不放孤城门（clear）', info.fort?.kind === 'clear' && !info.pass, info);
    await p.close();
  }
} catch (e) { fail++; console.log('FAIL 异常', String(e).slice(0, 300)); }
ck('无报错', errors.length === 0, errors.slice(0, 3));
await b.close(); console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
