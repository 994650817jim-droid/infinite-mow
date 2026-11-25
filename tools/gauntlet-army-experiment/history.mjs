import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {evidenceDir,historyFile} from './paths.mjs';

const file = historyFile;
const data = JSON.parse(await readFile(file, 'utf8'));
assert.equal(data.terminal, 'completed');
const waves = [];
for (let wave = 1; wave <= 20; wave++) {
  const phases = data.transitions.filter(row => row.wave === wave);
  const phase = name => phases.find(row => row.phase === name);
  const open = phase('mow'), boss = phase('boss'), clear = phase('clear');
  const close = data.transitions.find(row => row.wave === wave + 1) ?? data.current;
  const buys = data.recruits.filter(row => row.wave === wave);
  const cost = buys.reduce((sum, row) => sum + row.before - row.after, 0);
  const deaths = close.fallen - open.fallen, born = close.recruits - open.recruits;
  assert.equal(open.army + born - deaths, close.army);
  assert.equal(buys.length * 3, born);
  assert.equal(cost, (60 + 10 * wave) * buys.length);
  waves.push({wave, boss:boss.boss, tier:open.tier, start:open.time, end:close.time, opening:open.army,
    bossEntry:boss.army, atClear:clear.army, closing:close.army, born, cost, deaths,
    deathsMow:boss.fallen-open.fallen, deathsBoss:clear.fallen-boss.fallen, deathsClear:close.fallen-clear.fallen});
}
const sum = key => waves.reduce((n, row) => n + row[key], 0);
assert.deepEqual([sum('born'), sum('deaths'), sum('cost'), waves.at(-1).closing], [177,171,8080,6]);
const result = {source:basename(file), waves, totals:Object.fromEntries(
  ['born','deaths','cost','deathsMow','deathsBoss','deathsClear'].map(key=>[key,sum(key)]))};
await writeFile(join(evidenceDir,'historical-waves.json'),JSON.stringify(result,null,2)+'\n');
console.log(result.totals);
