// 完整回归入口：node tools/run-suites.mjs [套件名…] → 逐套运行，记每套最后一行与退出码，汇总写 assets/review/suites.txt。
// 需要开发服务器：BASE=http://127.0.0.1:<端口>/（缺省 5173，透传给每个套件）。不带参数跑全部；带参数只跑点名的套件。
// 2026-11-17 分诊（suite-triage）：删掉过时套件 test-town-t1/t2/t3（旧 12 地块城镇、税 / 事件 / 商队，已被营寨简化 + 城池建设取代）、
// test-worldmap-w2（攻城胜负改为箭楼 / 府衙目标，由 test-siege-* 覆盖）、test-coverage（文件不存在）；补上现行功能测试。
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
const ALL = [
  // 旧回归（分诊后保留并更新）
  'test-chibi', 'test-achievements', 'test-save-slots', 'test-gamepad', 'test-rest-boss-ui', 'test-pad-targets', 'test-legion-art',
  'test-worldmap-w1', 'test-worldmap-w3', 'test-worldmap-w4', 'test-phase20a', 'test-phase20b-control',
  'test-guandu-p1', 'test-guandu-p2', 'test-guandu-p3', 'test-phase23-store-heroes', 'test-phase23-flow', 'test-phase23-ui', 'test-phase23-bosses',
  'test-phase232-compat', 'test-battle-experience', 'test-flame-deaths', 'test-hud-tweaks', 'test-hero-actions', 'test-chronicle',
  // 现行功能
  'chapter-regression', 'test-tutorial', 'test-level-merge', 'test-boss-v2', 'test-boss-chest', 'test-terrain', 'test-new-heroes', 'test-weapons-batch2',
  'test-recruit', 'test-recruit-potion', 'test-items', 'test-charms', 'test-token-slots', 'test-hero-level', 'test-merit', 'test-campaign-build',
  'test-city-simple', 'test-city-build', 'test-intel', 'test-worldmap-chapters', 'test-worldmap-ui', 'test-siege-goals', 'test-siege-tiers', 'test-siege-medium',
  // 尚未提交的新测试：存在就跑
  'test-main-attr', 'test-boss-moves', 'test-quit-rollback',
];
const pick = process.argv.slice(2), SUITES = pick.length ? ALL.filter(s => pick.includes(s)) : ALL;
const out = []; let ran = 0, bad = 0;
for (const s of SUITES) {
  if (!existsSync(`tools/${s}.mjs`)) { out.push(`SKIP ${s}: (文件不存在)`); console.log(out.at(-1)); continue; }
  ran++;
  const t = Date.now(), r = spawnSync('node', [`tools/${s}.mjs`], { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  const last = ((r.stdout ?? '') + (r.stderr ?? '')).trim().split('\n').filter(Boolean).slice(-1)[0] ?? '';
  if (r.status !== 0) bad++;
  const line = `${r.status === 0 ? 'OK  ' : 'FAIL'} ${s} (${Math.round((Date.now() - t) / 1000)}s): ${last.slice(0, 160)}`; out.push(line); console.log(line);
}
out.push(`\n${ran - bad}/${ran} 套通过`); console.log(out.at(-1));
mkdirSync('assets/review', { recursive: true });
writeFileSync('assets/review/suites.txt', out.join('\n') + '\n');
process.exit(bad ? 1 : 0);
