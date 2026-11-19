// 配兵比例（data/enemyRoster STAGE_MIX / ROSTER_MIX，systems/RosterMix）：不开浏览器，在 node 里模拟刷怪抽样，检查占比与上限。
// 用法：node tools/test-roster-mix.mjs [huangjin.3,hulao.2]
import { build } from 'esbuild';
// 打包在内存里（不落临时文件），用 data: URL 载入
const res = await build({ stdin: { contents: "export * from './src/systems/RosterMix'; export { ROSTER, ROSTER_MIX, STAGE_MIX } from './src/data/enemyRoster';", resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error' });
const M = await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'));
const { ROSTER, ROSTER_MIX, STAGE_MIX } = M;

let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
// 固定随机种子，结果可复现
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const STAGES = (process.argv[2] ?? Object.keys(STAGE_MIX).join(',')).split(',');
const TICKS = 6000;
for (const key of STAGES) {
  const mix = STAGE_MIX[key]; if (!mix) { ck(`${key}：有配兵表`, false); continue; }
  const alive = []; // 每项 roster id 或 '' = 底层兵种
  const picks = {}, firstWave = {}, maxId = {}, maxRole = {}; let worst = 0, worstAt = null, basePicks = 0, total = 0;
  const counts = () => M.tallyRoster(alive.map(id => ({ active: true, def: { roster: id || undefined } })));
  for (let t = 0; t < TICKS; t++) {
    const wave = 1 + Math.floor(t / (TICKS / 3));
    // 在场人数先涨到 140 左右再维持（死得快 / 慢交替，模拟割草）
    const target = Math.min(140, 20 + t / 10);
    while (alive.length > target || (alive.length && rnd() < .35)) alive.splice(Math.floor(rnd() * alive.length), 1);
    const c = counts(), p = M.pickRoster(key, wave, c, rnd); total++;
    if (p && 'trait' in p) {
      const id = p.trait, r = ROSTER[id]; picks[id] = (picks[id] ?? 0) + 1; firstWave[id] = Math.min(firstWave[id] ?? 9, wave);
      const n = r.group ? r.group[1] : 1;
      for (let i = 0; i < n && M.canAdd(id, c); i++) { alive.push(id); M.addCount(id, c); }
      if (r.trait.kind === 'tamer') for (let i = 0; i < r.trait.beasts && M.canAdd(r.trait.beast, c); i++) { alive.push(r.trait.beast); M.addCount(r.trait.beast, c); }
    } else { alive.push(''); basePicks++; }
    const c2 = counts();
    for (const [id, n] of Object.entries(c2.byId)) maxId[id] = Math.max(maxId[id] ?? 0, n);
    for (const [role, n] of Object.entries(c2.byRole)) maxRole[role] = Math.max(maxRole[role] ?? 0, n);
    if (c2.special > 1) { const sh = c2.special / c2.total; if (sh > worst) { worst = sh; worstAt = [c2.special, c2.total]; } }
  }
  const capsOk = Object.entries(maxId).every(([id, n]) => n <= ROSTER[id].cap) && Object.entries(maxRole).every(([r, n]) => n <= ROSTER_MIX.roleCaps[r]);
  ck(`${key}：同兵种 / 同角色同时在场不超上限`, capsOk, { maxId, maxRole });
  ck(`${key}：在场新兵种占比 ≤ ${ROSTER_MIX.maxTraitShare * 100}%（不算流民 / 猛兽，在场很少时至少 1 个）`, worst <= ROSTER_MIX.maxTraitShare + 1e-9, { worst: Math.round(worst * 1000) / 10, at: worstAt });
  const waveOk = Object.entries(mix.traits).every(([id, e]) => (firstWave[id] ?? 9) >= (e.wave ?? ROSTER_MIX.firstWave));
  ck(`${key}：各新兵种不早于设定的波次出现`, waveOk, { firstWave, want: Object.fromEntries(Object.entries(mix.traits).map(([id, e]) => [id, e.wave ?? ROSTER_MIX.firstWave])) });
  const sumW = Object.values(mix.traits).reduce((s, e) => s + e.w, 0);
  const shares = Object.fromEntries(Object.entries(picks).map(([id, n]) => [id, Math.round(n / total * 1000) / 10]));
  const shareOk = Object.keys(mix.traits).every(id => (picks[id] ?? 0) > 0) && Object.entries(picks).every(([id, n]) => n / total <= mix.traits[id].w / 100 + .02);
  ck(`${key}：每个新兵种都刷得出来，刷怪占比不超权重（权重合计 ${sumW}/100 份）`, shareOk, { shares, base: Math.round(basePicks / total * 1000) / 10 });
}
ck('全局倍数 traitMul 存在（以后接难度）', typeof ROSTER_MIX.traitMul === 'number');
console.log(`\n${pass} passed, ${fail} failed`);
