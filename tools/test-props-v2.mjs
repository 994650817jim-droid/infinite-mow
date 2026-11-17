// 障碍物 / 道具 v2 化（src/systems/PropsV2.ts）：每类旧图 / 新图对比截图 + 检查。
// A 黄巾营地道具（第一章）、B 关隘营寨三势力（第二～五章，按势力选源图）、C 回血道具、D 第二章地面装饰、E 火盆燃烧 / 碎裂、碎裂碎屑、地火。
// 检查：v2 顶替了旧键（旧图改名 _old，帧尺寸不变）；碰撞框（halfW / halfH / radius）与旧图完全一致；?props=old 时全用旧图；无报错。
// 电脑布局 1280×720。截图存 assets/review/props-v2/<old|v2>/。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5197/ node tools/test-props-v2.mjs [huangjin,hulao,third,guandu,chibi]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', only = (process.argv[2] ?? 'huangjin,hulao,third,guandu,chibi').split(',');
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ARC = { third: ['thirdStage', 'ThirdChapterScene', 'third-deploy', 'ThirdGameScene'], chibi: ['chibiStage', 'ChibiChapterScene', 'chibi-deploy', 'ChibiGameScene'], guandu: ['guanduStage', 'GuanduChapterScene', 'guandu-deploy', 'GuanduGameScene'] };
const FACTION_KEY = { hulao: 'props_v2_xiliang', third: 'props_v2_xiliang', guandu: 'props_v2_yuan', chibi: 'props_v2_cao' };

async function open(chap, mode) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(`${chap}/${mode} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(`${chap}/${mode} ${m.text()}`); });
  const q = mode === 'old' ? '&props=old' : '';
  let scene = 'GameScene';
  if (chap === 'huangjin') await p.goto(base + `?dev=1&autostart=1&stage=1&layout=desktop${q}`);
  else if (chap === 'hulao') await p.goto(base + `?dev=1&autostart=1&chapter=hulao&stage=1&layout=desktop${q}`);
  else {
    const [param, cs, deploy, game] = ARC[chap]; scene = game;
    await p.goto(base + `?dev=1&${param}=1&layout=desktop${q}`);
    if (chap !== 'third') { await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.evaluate(c => { const g = window.__game; g.registry.set('worldStagePick', 1); g.scene.getScene('MenuScene').scene.start(c); }, cs); }
    await p.waitForFunction(c => window.__game?.scene.isActive(c), cs, { timeout: 90000 }); await p.waitForTimeout(600);
    await p.evaluate(([c, d]) => { const s = window.__game.scene.getScene(c); const o = s.children.getByName(d) ?? s.children.list.find(x => x.name && x.name.includes('deploy')); o.emit('pointerup'); }, [cs, deploy]);
  }
  await p.waitForFunction(g => { const s = window.__game?.scene.getScene(g); return s?.player && window.__game.scene.isActive(g); }, scene, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(g => {
    const G = window.__game, s = G.scene.getScene(g); window.__S = s; s.__DEV_ACTIONS?.closePopup?.();
    s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate();
    if (s.boss) s.boss.sprite?.setVisible(false);
    G.loop.sleep(); window.__T = performance.now(); s.readMove = () => new Phaser.Math.Vector2(0, 0);
    window.__step = n => { for (let i = 0; i < n; i++) { window.__T += 1000 / 60; for (const w of s.player.weapons) w.cooldownLeft = 1e9; G.step(window.__T, 1000 / 60); } };
    window.__clip = (dx = 0, dy = 0) => { const c = G.canvas.getBoundingClientRect(), cam = s.cameras.main, k = c.width / G.scale.gameSize.width * cam.zoom, wv = cam.worldView; return { x: c.left + (s.player.x + dx - wv.x) * k, y: c.top + (s.player.y + dy - wv.y) * k, k }; };
  }, scene);
  await p.evaluate(() => window.__step(3));
  return p;
}
const shot = async (p, dir, name, w, h, dx = 0, dy = 0) => { mkdirSync(`assets/review/props-v2/${dir}`, { recursive: true }); const r = await p.evaluate(([a, c]) => window.__clip(a, c), [dx, dy]); await p.screenshot({ path: `assets/review/props-v2/${dir}/${name}.png`, clip: { x: Math.max(0, r.x - w * r.k / 2), y: Math.max(0, r.y - h * r.k / 2), width: Math.min(1280, w * r.k), height: Math.min(720, h * r.k) } }); };
const texInfo = p => p.evaluate(() => { const T = window.__game.textures, info = k => T.exists(k) ? { w: T.get(k).getSourceImage().width, f: T.get(k).frameTotal - 1 } : null; return { yellow: info('yellow_props'), yellowOld: T.exists('yellow_props_old'), heal: info('heal_props'), art: info('art_props'), burn: info('brazier_burning'), brk: info('brazier_breaking'), fx: info('prop_break_fx'), debris: info('prop_debris'), gfire: info('ground_fire'), gfireOld: T.exists('ground_fire_old'), refinedFrom: window.__game.registry.get('sishuiRefinedFrom'), refined: info('sishui_props_refined') }; });

const footprints = {};
for (const chap of only) for (const mode of ['old', 'v2']) {
  const p = await open(chap, mode), t = await texInfo(p);
  if (chap === 'huangjin') {
    ck(`${mode}：黄巾营地道具 / 回血 / 火盆 / 碎裂 / 残骸 / 地火${mode === 'v2' ? '换成 v2（旧图改名 _old，帧数与格尺寸不变）' : '仍是旧图'}`,
      mode === 'v2' ? t.yellowOld && t.gfireOld && t.yellow.w === 768 && t.yellow.f === 36 && t.heal.f === 4 && t.burn.f === 8 && t.brk.f === 8 && t.fx.f === 24 && t.debris.f === 4 && t.gfire.f >= 8 : !t.yellowOld && !t.gfireOld, t);
    // A + C：在主将周围摆一圈营地道具与回血道具（位置同 seed），截图；记下碰撞框比对新旧
    const fp = await p.evaluate(() => { const s = window.__S, sup = s.supplies; for (const e of s.enemies) if (e.isSupplySlot && e.active) e.deactivate(); const frames = [0, 1, 2, 4, 6, 10, 12, 14, 16, 17, 18, 19, 21, 22, 23, 24, 25, 29, 30, 32, 33, 34];
      frames.forEach(f => sup.spawnForTest(f)); sup.spawnHealForTest('wine', -150, 120); sup.spawnHealForTest('herb', 150, 120);
      return sup.crates.filter(c => c.enemy.active).map(c => [c.frame, +c.halfW.toFixed(2), +c.halfH.toFixed(2), c.enemy.def.radius, Math.round(c.enemy.sprite.displayWidth), Math.round(c.enemy.sprite.displayHeight)]); });
    footprints[`huangjin-${mode}`] = fp;
    await p.evaluate(() => window.__step(4)); await shot(p, mode, 'A-camp-props', 560, 380);
    // E：火盆燃烧（frame 35 用 brazier_burning）→ 打碎 → 火盆碎裂 + 地火；木箱打碎的碎屑与残骸
    await p.evaluate(() => { const s = window.__S, sup = s.supplies; for (const e of s.enemies) if (e.isSupplySlot && e.active) e.deactivate(); sup.spawnForTest(35); sup.spawnForTest(14); sup.spawnForTest(18); sup.spawnForTest(4); });
    await p.evaluate(() => window.__step(6)); await shot(p, mode, 'E-brazier-stand', 420, 300);
    await p.evaluate(() => { const s = window.__S; for (const c of s.supplies.crates) if (c.enemy.active) s.hitEnemy(c.enemy, 9999, s.combatNow, 'melee'); });
    for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__step(4)); await shot(p, mode, `E-break-${i}`, 420, 300); }
    await p.evaluate(() => window.__step(60)); await shot(p, mode, 'E-groundfire-debris', 420, 300);
  } else {
    const want = FACTION_KEY[chap];
    ck(`${mode}：${chap} 关隘营寨道具源图 = ${mode === 'v2' ? want : 'sishui_props（旧）'}`, mode === 'v2' ? t.refinedFrom === want && t.refined?.w === 1024 : t.refinedFrom === 'sishui_props' && t.refined?.w === 512, t);
    const fp = await p.evaluate(() => window.__S.supplies.crates.filter(c => c.enemy.active && c.enemy.sprite.texture.key === 'sishui_props_refined').map(c => [c.frame, +c.halfW.toFixed(2), +c.halfH.toFixed(2), c.enemy.def.radius, Math.round(c.enemy.sprite.displayWidth), Math.round(c.enemy.sprite.displayHeight)]));
    footprints[`${chap}-${mode}`] = fp;
    // B：在主将周围摆 8 件营寨道具（只是显示），截图
    await p.evaluate(() => { const s = window.__S; window.__gal = [0, 1, 2, 3, 4, 5, 6, 7].map(i => s.add.image(s.player.x - 300 + (i % 4) * 200, s.player.y - 40 + Math.floor(i / 4) * 190, 'sishui_props_refined', i).setOrigin(.5, 1).setDisplaySize(i < 3 ? 170 : 130, i < 3 ? 170 : 130).setDepth(9000 + i)); });
    await p.evaluate(() => window.__step(2)); await shot(p, mode, `B-${chap}`, 860, 440, 0, -20);
    if (chap === 'hulao') {
      // D：第二章地面装饰（art_props 4×2）
      await p.evaluate(() => { const s = window.__S; for (const g of window.__gal) g.destroy(); window.__gal = [0, 1, 2, 3, 4, 5, 6, 7].map(i => s.add.image(s.player.x - 300 + (i % 4) * 200, s.player.y - 60 + Math.floor(i / 4) * 170, 'art_props', String(i)).setOrigin(.5, .75).setDisplaySize(150, 150).setDepth(9000 + i)); });
      await p.evaluate(() => window.__step(2)); await shot(p, mode, 'D-hulao-decor', 860, 420, 0, -10);
      ck(`${mode}：第二章地面装饰 art_props 仍切成 8 帧`, t.art && t.art.f === 8, t.art);
    }
  }
  await p.close();
}
// 碰撞框新旧一致（道具 v2 只换图，不动碰撞 / 导航）
for (const chap of only) { const a = JSON.stringify(footprints[`${chap}-old`]), c = JSON.stringify(footprints[`${chap}-v2`]); ck(`${chap}：碰撞框与显示尺寸新旧完全一致`, a === c, { n: footprints[`${chap}-v2`]?.length, old: a?.slice(0, 120), v2: c?.slice(0, 120) }); }
ck('全程无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
