// 人物画风 v2 第 4 批首领：进章节战斗、刷首领、截图并检查图集格子（288 = v2，128 = v1）。
// 用法：PORT=5201 OUT=dir node tools/artv2-boss-check.mjs third:1 third:3 guandu:1 chibi:2 ...
import { chromium } from 'playwright';
const PORT = process.env.PORT ?? '5173', OUT = process.env.OUT ?? 'screenshots/artv2-boss', ART = process.env.ART ?? '';
const SCN = { third: ['thirdStage', 'ThirdChapterScene', 'third-deploy', 'ThirdGameScene'], chibi: ['chibiStage', 'ChibiChapterScene', 'chibi-deploy', 'ChibiGameScene'], guandu: ['guanduStage', 'GuanduChapterScene', 'guandu-deploy', 'GuanduGameScene'] };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let fail = 0;
try {
  for (const spec of process.argv.slice(2)) {
    const [arc, stage] = spec.split(':'), [param, chap, deploy, game] = SCN[arc];
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(`http://127.0.0.1:${PORT}/?dev=1&${param}=${stage}${ART ? '&art=' + ART : ''}`);
    if (arc !== 'third') {
      await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 60000 });
      await p.evaluate(([c, st]) => { const g = window.__game; g.registry.set('worldStagePick', +st); g.scene.getScene('MenuScene').scene.start(c); }, [chap, stage]);
    }
    await p.waitForFunction(c => window.__game?.scene.isActive(c), chap, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/${arc}${stage}-select${ART}.png` });
    await p.evaluate(([c, d]) => { const s = window.__game.scene.getScene(c); const o = s.children.getByName(d) ?? s.children.list.find(x => x.name && x.name.includes('deploy')); o.emit('pointerup'); }, [chap, deploy]);
    await p.waitForFunction(g => window.__game.scene.isActive(g), game, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const info = await p.evaluate(g => {
      const s = window.__game.scene.getScene(g); for (const e of s.enemies) if (!e.isSupplySlot && e.kind !== 'boss') e.deactivate();
      s.spawnBoss(); const bo = s.boss; bo.sprite.setPosition(s.player.x + 120, s.player.y); s.player.invulnUntil = 1e12;
      const t = bo.sprite.texture; return { key: t.key, w: t.getSourceImage().width, fw: bo.sprite.frame.width, frame: bo.sprite.frame.name };
    }, game);
    await p.waitForTimeout(3800); await p.evaluate(g => { const s = window.__game.scene.getScene(g); s.boss.sprite.setPosition(s.player.x + 150, s.player.y - 20); }, game); await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/${arc}${stage}-boss${ART}.png` });
    const ok = !errs.length && (ART === 'v1' ? info.fw === 128 : info.fw === 288);
    if (!ok) fail++;
    console.log(ok ? 'PASS' : 'FAIL', spec, JSON.stringify(info), errs.join(' | '));
    await p.close();
  }
} finally { await b.close(); }
if (fail) process.exit(1);
