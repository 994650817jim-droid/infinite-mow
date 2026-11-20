// 升级三选一卡面（2026-11-19 用户「关于技能3选一描述需要检查优化一下」）：12 名武将可能出的每一张卡（src/data/cardCatalog.ts）逐张放进真的三选一面板渲染，
// 查：说明不溢出（16 号字放不下时最多缩到 14 号）、每行不超卡宽、卡名放得下、卡底有有效范围徽记、文字里没有 undefined / NaN；
// 面板底部「选定后本次征程不可更改」只在有永久成长卡时出现。全部卡面文字另存 assets/review/levelup-cards/catalog.txt 供审校。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-levelup-cards.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/levelup-cards';
mkdirSync(OUT, { recursive: true });
const HEROES = ['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao', 'weiyan', 'liubei', 'zhuge', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan'];
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info).slice(0, 1500)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 90000 }); await p.waitForTimeout(800);
const bad = [], dump = [], seen = new Set(); let cards = 0, minFont = 99, lockOk = true;
for (const hero of HEROES) {
  await p.evaluate(id => { const s = window.__game.scene.getScene('GameScene'); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, hero);
  await p.waitForTimeout(300);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 30000 });
  const r = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
    const cat = (await import('/src/data/cardCatalog.ts')).cardCatalog(s.player, { chapter: 9 }), { cardScope } = await import('/src/ui/CardRichText.ts');
    const out = [], lock = [];
    for (let k = 0; k < cat.length; k += 3) {
      const group = cat.slice(k, k + 3); s.upgradeOptions = group; s.renderCards(); s.setMode('levelup');
      const note = s.levelPanel.getByName('upgrade-lock-note'), wantNote = group.some(o => ['run', 'forever'].includes(cardScope(o)));
      lock.push(note?.visible === wantNote);
      group.forEach((o, i) => {
        const v = s.cardViews[i], half = (v.w - 40) / 2, kids = v.rich.list;
        const right = Math.max(0, ...kids.map(t => Math.abs(t.x) + (v.rich.getData ? 0 : 0) + (t.x < 0 ? 0 : t.width))), left = Math.min(0, ...kids.map(t => t.x));
        out.push({ id: o.id, name: o.name, desc: o.desc, tag: v.tag.text, scope: v.scope.text, size: v.rich.getData('size'), h: v.rich.getData('h'), maxH: v.rich.getData('maxH'),
          lines: v.rich.getData('lines'), wide: Math.max(-left, right) - half, nameH: v.name.height, nameSize: parseInt(String(v.name.style.fontSize)), scopeOn: v.scope.visible });
      });
    }
    s.setMode('none'); return { out, lock };
  });
  for (const c of r.out) {
    cards++; minFont = Math.min(minFont, c.size); const text = c.name + '\n' + c.desc + '\n' + c.tag;
    const why = [];
    if (/undefined|NaN|Infinity|null|\[object/.test(text)) why.push('含 undefined / NaN');
    if (c.h > c.maxH) why.push(`溢出 ${c.h}>${c.maxH}`);
    if (c.size < 14) why.push(`字号 ${c.size}`);
    if (c.wide > 9) why.push(`超宽 ${c.wide.toFixed(1)}`); // 行末收尾标点（）」』）可以悬挂半个字宽
    if (c.nameH > 50 || c.nameSize < 17) why.push(`卡名 ${c.nameSize}号 高${c.nameH}`);
    if (!c.scopeOn || !['本关有效', '本次征程', '一次性', '永久'].includes(c.scope)) why.push('无范围徽记');
    if (why.length) bad.push({ hero, id: c.id, why: why.join(' / '), desc: c.desc });
    const key = c.id.replace(/^weapon_[a-z_]+_\d$/, x => hero + ':' + x);
    if (!seen.has(c.id + '|' + c.desc)) { seen.add(c.id + '|' + c.desc); dump.push(`【${c.name}】〔${c.tag}〕〈${c.scope}〉 ${c.size}号 ${c.lines}行  (${hero}:${c.id})\n${c.desc}\n`); }
    void key;
  }
  lockOk = lockOk && r.lock.every(Boolean);
}
writeFileSync(`${OUT}/catalog.txt`, dump.join('\n'));
ck(`全部卡面（12 名武将 · ${cards} 张，去重 ${dump.length} 张）不溢出、不缩到 14 号以下、不超宽、卡名放得下、都有有效范围徽记、没有 undefined / NaN（最小字号 ${minFont}）`, bad.length === 0, bad.slice(0, 12));
ck('面板底部「选定后本次征程不可更改」：有本次征程 / 永久的卡时显示，三张都是本关 / 一次性时不显示', lockOk, {});
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close();
const pass = rows.filter(Boolean).length; console.log(`\n${pass}/${rows.length} 通过 · 卡面文字 → ${OUT}/catalog.txt`); process.exit(pass === rows.length ? 0 : 1);
