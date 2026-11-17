// 首领公共预警 / 攻击特效：像素版（?warnfx=pixel）与手绘版并排对比 GIF，每类一段（电脑布局 1280×720，主将旁边依次播「蓄力 → 落下」）。
// 用法：BASE=http://127.0.0.1:5188/ node tools/record-warnfx-showcase.mjs [输出目录]（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = process.argv[2] ?? 'assets/review/warnfx-hp';
const KINDS = ['fire', 'slam', 'arrows', 'sweep', 'charge', 'rift', 'lightning', 'lubu'], SEG = 1.6; // 每类 1.6 秒：蓄力 0.9 + 落下 0.7
mkdirSync(OUT, { recursive: true });
async function record(mode) {
  const vid = `${OUT}/video-${mode}`; mkdirSync(vid, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop' + (mode === 'pixel' ? '&warnfx=pixel' : ''));
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 });
  await p.waitForTimeout(2500);
  const t0 = Date.now();
  await p.evaluate(async ([KINDS, SEG]) => {
    const s = window.__game.scene.getScene('GameScene'), { warnFx } = await import('/src/ui/WarnFx.ts'), fx = warnFx(s);
    s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; s.__DEV_ACTIONS?.closePopup?.();
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => { x.style.display = 'none'; });
    const label = s.add.text(640, 120, '', { fontSize: '22px', color: '#ffe7a8', stroke: '#1a1310', strokeThickness: 4 }).setOrigin(.5).setScrollFactor(0).setDepth(3000);
    const names = { fire: '纵火落点', slam: '重击落地', arrows: '箭雨', sweep: '刀气横扫', charge: '冲锋道', rift: '裂地重斩', lightning: '天雷', lubu: '吕布无双' };
    const start = s.combatNow; let hit = -1;
    s.events.on('postupdate', () => {
      const t = (s.combatNow - start) / 1000, i = Math.floor(t / SEG); if (i >= KINDS.length) { label.setText(''); return; }
      const k = KINDS[i], lt = t - i * SEG, prog = Math.min(1, lt / .9), x = s.player.x + 150, y = s.player.y + 10, now = s.combatNow, R = 80, id = 'show' + i;
      label.setText(names[k] + (lt < .9 ? ' · 蓄力' : ' · 落下'));
      if (lt < .9) {
        if (k === 'fire' || k === 'slam' || k === 'arrows') fx.circle(id, k, x, y, R, prog, now);
        else if (k === 'sweep') fx.sector(id, x - 60, y, 150, 0, prog, now);
        else if (k === 'charge') fx.lane(id, 'charge', x - 120, y, 0, 300, 70, prog, now);
        else if (k === 'rift') fx.warn(id, 'rift', x - 120, y, 300, prog, now, 0);
        else fx.warn(id, k, x, y, R, prog, now);
      } else if (hit !== i) {
        hit = i;
        if (k === 'fire' || k === 'slam' || k === 'arrows') fx.shapeImpact(id, k, x, y, R, 0, now);
        else if (k === 'sweep') fx.shapeImpact(id, 'sweep', x - 60, y, 150, 0, now);
        else if (k === 'charge') fx.shapeImpact(id, 'charge', x - 120, y, 300, 0, now, 70);
        else fx.impact(k, k === 'rift' ? x - 120 : x, y, k === 'rift' ? 300 : R, 0);
      }
    });
  }, [KINDS, SEG]);
  await p.waitForTimeout(KINDS.length * SEG * 1000 + 1200);
  const elapsed = (Date.now() - t0) / 1000;
  await p.close(); await ctx.close(); await b.close();
  const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop(), out = `${OUT}/${mode}.webm`;
  renameSync(webm, out); rmSync(vid, { recursive: true, force: true });
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim());
  return { out, start: Math.max(0, dur - elapsed), errs };
}
const px = await record('pixel'), hp = await record('handpainted');
// 每类一段：左像素版、右手绘版，裁到主将附近 640×360
for (let i = 0; i < KINDS.length; i++) {
  const k = KINDS[i], seg = (r) => ['-ss', (r.start + i * SEG).toFixed(2), '-t', String(SEG), '-i', r.out];
  execFileSync('ffmpeg', ['-y', ...seg(px), ...seg(hp), '-filter_complex',
    '[0]crop=640:360:400:100[a];[1]crop=640:360:400:100[b];[a][b]hstack=2,fps=12,split[c][d];[c]palettegen=max_colors=96:stats_mode=diff[pl];[d][pl]paletteuse=dither=none:diff_mode=rectangle',
    `${OUT}/${k}.gif`], { stdio: 'ignore' });
}
console.log('done', OUT, 'pixel errors', px.errs.length, 'handpainted errors', hp.errs.length, [...px.errs, ...hp.errs].join(' | '));
