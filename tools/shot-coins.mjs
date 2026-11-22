// 钱币（2026-11-21 军粮改钱币；同日改「钱币就是飞进行囊里，行囊可以看到钱币数量」）：
// 战斗：捡粮袋 → 铜钱（coin_flip 翻转帧）从粮袋处飞进右上「行囊」（到达切鼓起贴图 bundle_full + 放大回弹），行囊旁的钱币数（coin_string + 数字）落袋后跳到新值；
// 通用入口 coinBurst 不和「盯数值」重复飞；同屏上限 12；暂停不丢数；左上部曲行不再写钱币；行囊面板有钱币一行；行营资源行仍飞向钱币图标；小号经验信物换成青玉军功符。
// 音效验证：Chrome 加 --autoplay-policy=no-user-gesture-required，Sfx.stats 里 coin / coinPurse 的 played（真的创建并启动了声源）> 0。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-coins.mjs → assets/review/coins/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/coins'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 500))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] }); const errs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_home_seen']) localStorage.setItem(k, '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('s', '1'); } });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2.5; }, null, { timeout: 180000 });
await p.mouse.click(640, 400); // 一次手势，确保音频解锁
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, a) => p.evaluate(([S0, f, x]) => { const r = eval('(' + f + ')')(eval(S0), x); return r && typeof r === 'object' && Object.getPrototypeOf(r) !== Object.prototype && !Array.isArray(r) ? null : r; }, [G, String(fn), a]);
await ev(s => { s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); s.sfx.unlock?.(); document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }); });
await p.waitForTimeout(3000); // 开局镜头缩放停下、钱币美术载入
// 贴图走 blob、资源计时缓冲又会满，所以直接看已载入贴图的颜色：青玉偏绿（G > R），青铜古钱偏黄铜（R > G）
const gem = await p.evaluate(() => { const t = window.__game.textures.get('gem_tok_small'), img = t?.source[0]?.image; if (!img || t.key === '__MISSING') return null; const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data; let r = 0, gg = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; n++; } return { r: Math.round(r / n), g: Math.round(gg / n), w: img.width }; });
ck('小号经验信物换成青玉军功符（已载入的 gem_tok_small 偏绿）', !!gem && gem.g > gem.r, gem);
const before = await ev(s => ({ food: s.legion.food, count: s.children.getByName('hud-coin-count')?.text, countVis: !!s.children.getByName('hud-coin-count')?.visible, icon: s.children.getByName('hud-coin-icon')?.texture.key, status: s.legionUI.status.text }));
ck('战斗：钱币数写在右上行囊旁（铜钱图标 + 数字），左上部曲行不再写钱币', before.countVis && before.count === String(before.food) && before.icon === 'coin_flip' && !/钱币/.test(before.status), before);
// ① 捡粮袋（现有的得钱来源）：在主将右上方 150px 处打碎一个粮袋
await ev(s => { s.propLoot('grain', s.player.x + 150, s.player.y - 100); });
await p.waitForTimeout(160);
const mid = await ev(s => ({ food: s.legion.food, count: s.children.getByName('hud-coin-count')?.text, flying: s.coinFly.flying, bag: s.bagBundle?.icon?.texture.key })); await p.screenshot({ path: `${OUT}/battle-coins-to-bag.png` });
await p.waitForTimeout(140);
const mid2 = await ev(s => ({ bag: s.bagBundle?.icon?.texture.key }));
// 用户「我觉得不需要字」：捡钱币时画面上不再飘「…钱币 +N」之类的字（只有铜钱飞入 + 数字跳 + 音效）
const words = await ev(s => { const out = []; const walk = (l, vis) => { for (const o of l) { const v = vis && o.visible !== false && (o.alpha ?? 1) > .02; if (o.list) walk(o.list, v); else if (v && o.type === 'Text' && /钱币\s*\+|随军钱币/.test(o.text ?? '')) out.push(o.text.slice(0, 40)); } }; walk(s.children.list, true); return out; });
ck('捡钱币：画面上没有「钱币 +N」之类的飘字 / 横幅', words.length === 0, words);
await p.waitForTimeout(1000);
const after = await ev(s => ({ food: s.legion.food, count: s.children.getByName('hud-coin-count')?.text, flying: s.coinFly.flying, bag: s.bagBundle?.icon?.texture.key, sfx: { coin: s.sfx.stats?.coin, purse: s.sfx.stats?.coinPurse } }));
ck('捡粮袋：钱立即入账，铜钱在飞向行囊，行囊旁的数字先不跳', mid.food > before.food && mid.flying > 0 && mid.count === String(before.food), { before, mid });
const flashes = await ev(s => s.coinFly.flashes);
ck('铜钱到达：行囊切到鼓起贴图（bundle_full）一下再切回', flashes > 0 && after.bag === 'bag_bundle', { flashes, mid: mid.bag, mid2: mid2.bag, after: after.bag });
ck('全部落袋：数字跳到新值、铜钱都没了', after.flying === 0 && after.count === String(after.food), after);
ck('捡钱音效与落袋音效真的播放了（Sfx.stats played > 0）', (after.sfx.coin?.played ?? 0) > 0 && (after.sfx.purse?.played ?? 0) > 0, after.sfx);
// ②′ 绕身（2026-11-21 用户「捡起来的时候不会立刻飞过去，会在身边转一下才飞过去」）：先贴着主将绕转（世界坐标、跟主将走），约 0.35 秒后才换成飞向行囊；钱在捡到那一刻已入账
{
  await p.waitForTimeout(600);
  const o0 = await ev(s => { const f0 = s.legion.food; s.coinBurst(s.player.x + 10, s.player.y, 12); s.legion.food += 12; return { f0, food: s.legion.food, t: performance.now() }; });
  let orbitShot = false, flyShot = false, sawOrbit = null, sawFly = null;
  for (let i = 0; i < 20 && !(orbitShot && flyShot); i++) {
    const r = await ev(s => { const pl = s.player, o = s.children.list.filter(c => c.name === 'coin-orbit' && c.visible), hud = s.children.list.filter(c => c.name === 'coin-fly' && c.visible);
      return { dt: performance.now() - 0, orbit: o.map(c => ({ d: Math.round(Math.hypot(c.x - pl.x, c.y - pl.y)), above: c.depth > pl.sprite.depth })), fly: hud.length, food: s.legion.food, count: s.children.getByName('hud-coin-count')?.text }; });
    if (!orbitShot && r.orbit.length) { orbitShot = true; sawOrbit = r; await p.screenshot({ path: `${OUT}/battle-orbit.png` }); }
    else if (orbitShot && !flyShot && r.fly && !r.orbit.length) { flyShot = true; sawFly = r; await p.screenshot({ path: `${OUT}/battle-fly.png` }); }
    await p.waitForTimeout(40);
  }
  const seen = await ev(s => s.coinFly.orbitsSeen);
  ck('捡钱：先绕主将转（贴身：半径 26–34 屏幕像素 + 上浮，离主将 ≤ 45 世界像素），再换成飞向行囊；钱在捡到时就入账、数字落袋才跳', !!sawOrbit && !!sawFly && seen > 0 && sawOrbit.orbit.every(o => o.d >= 8 && o.d <= 45) && sawOrbit.food === o0.food && sawOrbit.count === String(o0.f0), { sawOrbit, sawFly, seen });
  await p.waitForTimeout(1200);
}
// ② 通用入口 coinBurst：从世界坐标飞 30，再把 30 加进数值 —— 只飞一次（5 枚），不会被「盯数值」再飞一遍
await ev(s => { s.coinBurst(s.player.x - 160, s.player.y + 60, 30); s.legion.food += 30; });
await p.waitForTimeout(160);
const bur = await ev(s => s.coinFly.flying);
ck('coinBurst（通用入口）：从任意世界坐标飞，和盯数值不重复（30 → 5 枚）', bur === 5, bur);
await p.waitForTimeout(1000);
// ③ 同屏上限：一次来 40 笔，飞行的铜钱不超过 12
await ev(s => { for (let i = 0; i < 20; i++) s.legion.food += 30; }); await p.waitForTimeout(30); await ev(s => { for (let i = 0; i < 20; i++) s.legion.food += 30; });
await p.waitForTimeout(120);
const cap = await ev(s => s.coinFly.flying);
ck('同屏飞行铜钱不超过 12 枚', cap <= 12 && cap > 0, cap);
// ④ 暂停：飞到一半打开暂停，数值不丢；关掉后显示等于真值
await ev(s => { s.legion.food += 40; }); await p.waitForTimeout(80); await ev(s => s.togglePause()); await p.waitForTimeout(1200); await ev(s => s.togglePause()); await p.waitForTimeout(400);
const pz = await ev(s => ({ food: s.legion.food, lag: s.coinFly.displayLag(), count: s.children.getByName('hud-coin-count')?.text })); // 主将还在自动打怪，可能刚好又有 1 枚在飞
ck('飞到一半暂停：不丢计数，恢复后显示 = 真值（减去刚刚又在飞的）', pz.count === String(pz.food - pz.lag) && pz.food - pz.lag >= pz.food - 5, pz);
// ⑤ 经验信物（2026-11-21 用户「军功捡起来会飞向经验条」）：在主将身边撒 40 颗，吸取到主将时经验立即入账（升级不等）；先绕身，再飞向左上经验条填充末端，落点亮一下（同屏 ≤ 10，绕身也算）
{
  const x0 = await ev(s => { const g = s.player.growth; s.player.xpNext = 1e9; /* 截图时别弹升级三选一 */ window.__xpTot = 0; const orig = s.player.gainXp.bind(s.player); s.player.gainXp = a => { window.__xpTot += a; return orig(a); }; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = 30 + (i % 4) * 12; s.spawnGem(s.player.x + Math.cos(a) * r, s.player.y + Math.sin(a) * r, 1); } return { launched: s.tokenFly.tokensLaunched, coins: s.children.getByName('hud-coin-count')?.text }; });
  let maxFly = 0, sawXpBeforeLanding = false, shot = false; const xpWords = new Set();
  for (let i = 0; i < 16; i++) {
    const r = await ev(s => { const words = []; const walk = (l, vis) => { for (const o of l) { const v = vis && o.visible !== false && (o.alpha ?? 1) > .02; if (o.list) walk(o.list, v); else if (v && o.type === 'Text' && /(经验|军功|战功)\s*\+/.test(o.text ?? '')) words.push(o.text.slice(0, 40)); } }; walk(s.children.list, true);
      return { fly: s.tokenFly.tokensFlying, launched: s.tokenFly.tokensLaunched, xp: window.__xpTot, left: s.gems.filter(g => g.active).length, words }; });
    for (const w of r.words) xpWords.add(w);
    maxFly = Math.max(maxFly, r.fly); if (r.fly > 0 && r.xp > 0) sawXpBeforeLanding = true;
    if (!shot && r.fly >= 3) { shot = true; await p.screenshot({ path: `${OUT}/battle-xp-to-bar.png` }); }
    await p.waitForTimeout(90);
  }
  await p.waitForTimeout(1200);
  const x1 = await ev(s => ({ launched: s.tokenFly.tokensLaunched, xp: window.__xpTot, left: s.gems.filter(g => g.active).length, coins: s.children.getByName('hud-coin-count')?.text, land: s.tokenFly.lastLand, orbits: s.tokenFly.orbitsSeen, glints: s.statusFrame?.stats.glints ?? 0, coinLand: s.coinFly.lastLand, bagFlashes: s.coinFly.flashes }));
  ck('军功符：先绕身，再飞到左上经验条（落点在经验条 x 80–245、y 60–80，不是右上行囊），落点亮一下', x1.orbits > 0 && !!x1.land && x1.land.x >= 80 && x1.land.x <= 245 && x1.land.y >= 60 && x1.land.y <= 80 && x1.glints > 0, x1);
  ck('军功符：经验在碰到主将时就入账（信物还在绕 / 飞时已加经验）、同屏 ≤ 10（钱币数会因主将自动打怪变化，不比）', x1.launched > x0.launched && sawXpBeforeLanding && maxFly <= 10 && x1.xp > 0, { x0, x1, maxFly, sawXpBeforeLanding });
  ck('吸取经验：画面上没有「经验 / 军功 / 战功 +N」之类的飘字 / 横幅（用户「关于拿到钱和军功」不需要字）', xpWords.size === 0, [...xpWords]);
}
// ⑤ 行囊面板里有钱币一行
await ev(s => s.openBattleBag()); await p.waitForTimeout(1500);
const bagLine = await ev(s => { const r = s.children.getByName('item-bag'); let t = null; const walk = l => { for (const o of l) { if (o.name === 'item-bag-coins') t = o.text; if (o.list) walk(o.list); } }; walk(r?.list ?? []); return { t, food: s.legion.food }; });
await p.screenshot({ path: `${OUT}/battle-bag-coins.png` });
ck('行囊面板：有「随军钱币 N」一行', bagLine.t === '随军钱币 ' + bagLine.food, bagLine);
await ev(s => { s.children.getByName('item-bag')?.destroy(); s.setMode('none'); });
// ⑥ 行营：休整时得钱（卖兵装之类）→ 飞向资源行的钱币图标
await ev(s => { s.resting = true; s.setMode('rest'); s.campUI.open('coins', '定军山'); });
await p.waitForTimeout(2500);
await ev(s => { s.children.getByName('rest-summary')?.emit('pointerdown'); }); await p.waitForTimeout(900);
await ev(s => { for (const o of s.children.list) if (/^rest-summary|hero-bark|toast/.test(o.name ?? '')) o.setVisible?.(false); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').campUI.root.visible, null, { timeout: 10000 });
await ev(s => { s.legion.food += 30; }); await p.waitForTimeout(200);
const camp = await ev(s => ({ res: s.campUI.resources.text, icon: s.campUI.purse?.visible ? s.campUI.purse.texture.key : null, flying: s.campCoinFly?.flying ?? 0 })); await p.screenshot({ path: `${OUT}/camp-coins.png` });
ck('行营资源行：铜钱图标 +「随军钱币 N」，得钱时铜钱飞向图标', camp.icon === 'coin_flip' && /^随军钱币 \d+/.test(camp.res) && camp.flying > 0, camp);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
