// 有界 Boss 自动走位冒烟：不是人工胜率测试，也不是完整六波试玩。
// node tools/phase8_realboss.mjs --seconds=45 [--build=low|normal|strong]
// 三档并行运行，每档最多 60 秒；自动处理升级面板，避免面板暂停后空等。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const chapterId = args.get('chapter') ?? 'huangjin';
if (!['huangjin', 'hulao'].includes(chapterId)) throw new Error('Unknown --chapter');
const out = join(root, 'screenshots', chapterId === 'hulao' ? 'chapter2' : 'codex-fixes'); mkdirSync(out, { recursive: true });
const seconds = Math.max(5, Math.min(60, Number(args.get('seconds')) || 45));
const builds = {
  low: { weapons: [['spear_orbit', 1]], allies: 1 },
  normal: { weapons: [['spear_orbit', 3], ['crossbow', 2], ['flame_banner', 2]], allies: 3 },
  strong: { weapons: [['spear_orbit', 5], ['crossbow', 5], ['flame_banner', 5]], allies: 5 },
};
const selected = Object.entries(builds).filter(([name]) => !args.has('build') || args.get('build') === name);
if (!selected.length) throw new Error('Unknown --build');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const deadline = setTimeout(() => { console.error('Boss smoke overall timeout'); void browser.close().finally(() => process.exit(2)); }, (seconds + 30) * 1000);
async function run(name, build) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5173/?autostart=1&chapter=' + chapterId); await page.waitForFunction(() => !!window.__IM);
    await page.evaluate(build => {
      const s = window.__game.scene.getScene('GameScene');
      s.player.weapons = build.weapons.map(([id, level]) => ({ id, level, cooldownLeft: 0 }));
      for (let i = 0; i < build.allies; i++) window.__IM.spawnAlly(['swordsman', 'archer', 'spearman'][i % 3]);
      s.elapsed = s.chapter.waves.at(-1).start + .01; s.waveIndex = s.chapter.waves.length - 1; s.spawnBoss();
      s.__bossStartedAt = s.elapsed;
      s.__bossAudit = { player: 0, ally: 0, choices: [] };
      const hit = s.hitEnemy.bind(s);
      s.hitEnemy = (enemy, ...args) => {
        const isBoss = enemy === s.boss && enemy.active;
        const hp = Math.max(0, enemy.hp), shield = s.bossShield, phase2 = s.bossPhase2;
        hit(enemy, ...args);
        if (isBoss) {
          const added = s.chapter.bossStyle === 'zhangjiao' && !phase2 && s.bossPhase2 ? 300 : 0;
          const damage = Math.max(0, hp - Math.max(0, enemy.hp) + shield + added - s.bossShield);
          s.__bossAudit[args[3] ? 'ally' : 'player'] += damage;
        }
      };
    }, build);
    const start = Date.now(); let ultCasts = 0, lastUlt = 'none', phase2At = null, lastProgress = 0, hpMin = 100;
    let state;
    while (Date.now() - start < seconds * 1000) {
      state = await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene');
        if (s.mode === 'levelup') {
          const preferred = s.upgradeOptions.findIndex(o => o.kind === 'passive');
          const index = preferred < 0 ? 0 : preferred;
          s.__bossAudit.choices.push(s.upgradeOptions[index]?.id); s.chooseUpgrade(index);
        } else if (s.mode === 'recruit') s.chooseRecruit(0);
        if (s.boss?.active && s.player.alive && !s.over) {
          const dx = s.boss.x - s.player.x, dy = s.boss.y - s.player.y, d = Math.hypot(dx, dy) || 1;
          const radial = d < 90 ? -1 : d > 130 ? 1 : 0;
          if (s.lubu?.state === 'sweepWindup') window.__IM.setMove(-dx / d, -dy / d);
          else if (s.lubu?.state === 'dashWindup') window.__IM.setMove(-Math.sin(s.lubu.angle), Math.cos(s.lubu.angle));
          else window.__IM.setMove(-dy / d + radial * dx / d, dx / d + radial * dy / d);
        } else window.__IM.clearMove();
        return { over: s.over, victory: s.victory, hp: s.player.hp, bossHp: s.boss?.hp ?? 0, shield: s.bossShield,
          phase2: s.bossPhase2, ult: s.bossUltPhase, gameSeconds: s.elapsed - s.__bossStartedAt, enemies: window.__IM.enemies };
      });
      hpMin = Math.min(hpMin, state.hp);
      if (state.ult === 'charge' && lastUlt !== 'charge') ultCasts++;
      lastUlt = state.ult;
      if (state.phase2 && phase2At === null) phase2At = state.gameSeconds;
      if (state.over) break;
      const elapsed = Date.now() - start;
      if (elapsed - lastProgress >= 10000) { lastProgress = elapsed; console.log(`[boss:${name}] ${Math.round(elapsed / 1000)}s HP=${Math.round(state.hp)} Boss=${Math.round(state.bossHp)} enemies=${state.enemies}`); }
      await page.waitForTimeout(125);
    }
    const final = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene');
      return { state: { over: s.over, victory: s.victory, hp: s.player.hp, bossHp: s.boss?.hp ?? 0, shield: s.bossShield, phase2: s.bossPhase2, ult: s.bossUltPhase, gameSeconds: s.elapsed - s.__bossStartedAt, enemies: window.__IM.enemies }, bossDamage: s.__bossAudit, weapons: window.__IM.weapons, allies: s.allies.length, mode: s.mode, god: s.player.invulnUntil > 1e12 };
    });
    state = final.state; // 终态与伤害在同一次采样中读取，避免最后125ms的偏差。
    const result = { chapter: chapterId, build: name, preset: build, outcome: state.over ? state.victory ? 'victory' : 'death' : 'time_budget',
      wallSeconds: +((Date.now() - start) / 1000).toFixed(2), state, hpMin, ultCasts, phase2At, ...final, errors };
    await page.screenshot({ path: join(out, `boss-${name}.png`) });
    console.log(`[boss:${name}] DONE ${JSON.stringify(result)}`); return result;
  } finally { await context.close(); }
}
try {
  const results = await Promise.all(selected.map(([name, build]) => run(name, build)));
  writeFileSync(join(out, 'boss-smoke.json'), JSON.stringify({ kind: 'bounded_bot_smoke', chapter: chapterId, maxSeconds: seconds, results }, null, 2));
  if (results.some(r => r.errors.length || r.god)) process.exitCode = 1;
} finally { clearTimeout(deadline); await browser.close(); }
