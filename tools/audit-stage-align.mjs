// 天下地图 V1 关卡点与城池对位体检（2026-11-19 用户「这里我感觉有点怪」）：列出 1–12 章每关的关卡点、最近的城池与距离、是否同名。
// 用法：BASE=http://127.0.0.1:5180/ node tools/audit-stage-align.mjs   → 打印 Markdown 表
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
await p.goto(base + '?layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
const rows = await p.evaluate(async () => {
  const T = await import('/src/world/ChapterTimeline.ts'), C = await import('/src/world/WorldCities.ts'), A = await import('/src/world/StageAnchors.ts').catch(() => null);
  const out = [];
  for (const ch of T.CHAPTER_TIMELINE) { const st = T.chapterStages(ch.id);
    T.STAGE_POINTS[ch.id].forEach((pt, i) => { const d = st[i]; if (!d) return;
      const near = C.CITIES.map(c => ({ c, dist: Math.round(Math.hypot(c.x - pt.x, c.y - pt.y)) })).sort((a, b) => a.dist - b.dist)[0];
      const fixed = A?.stageAnchor?.(ch.id, i);
      out.push({ ch: ch.numeral + ' ' + ch.title, code: d.code, name: d.name, x: pt.x, y: pt.y, city: near.c.name, cityId: near.c.id, cx: near.c.x, cy: near.c.y, dist: near.dist, same: d.name.includes(near.c.name) || near.c.name.includes(d.name.replace(/之战|决战|突围|夜袭|讨逆|奇袭/g, '')), fixed: fixed ? `${fixed.city ?? '战场'} (${Math.round(fixed.x)}, ${Math.round(fixed.y)})` : '' }); }); }
  return out;
});
console.log('| 章 | 关 | 关卡点 (x, y) | 最近城池 | 距离 | 同名 | V1 落点 |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.ch} | ${r.code} ${r.name} | (${r.x}, ${r.y}) | ${r.city} (${r.cx}, ${r.cy}) | ${r.dist} | ${r.same ? '是' : ''} | ${r.fixed} |`);
await b.close();
