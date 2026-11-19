// 剧情美术截图（2026-11-18 第三、四章）：在战斗场景里直接播指定剧情节点的卷轴，翻到指定人物说话的那一页截图，
// 看对白水墨立绘 + 章节插画的实际效果。电脑布局 1280×720，输出 assets/review/story-art/<节点>-<人物>.png。
// 用法：BASE=http://127.0.0.1:5173/ node tools/shot-story-art.mjs（SET=ch56 拍第五、六章新立绘；SET=ch12 拍第一、二章 + 徐庶 / 刘贤 / 邢道荣）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/story-art';
mkdirSync(out, { recursive: true });
// [节点 id, 说话人, 主公]
const SHOTS_CH34 = [
  ['qunxiong.open', 'jiaxu', 'zhaoyun'], ['qunxiong-1.xuzhou', 'taoqian', 'liubei'], ['qunxiong-2.yuanmen', 'jiling', 'liubei'],
  ['qunxiong.zhujiu', 'caocao', 'liubei'], ['guandu-1.tushan', 'zhangliao', 'guanyu'], ['guandu-3.xuyou', 'xuyou', 'zhaoyun'],
  ['guandu.close', 'yuanshao', 'zhaoyun'], ['qunxiong.close', 'lubu', 'zhaoyun'],
];
// 第五、六章（2026-11-18 即梦补的对白立绘；首领登场 / 转阶段 / 倒下节点也能拍）
const SHOTS_CH56 = [
  ['chibi-2.dongfeng', 'sunquan', 'liubei'], ['chibi-2.dongfeng', 'zhouyu', 'liubei'], ['chibi-2.dongfeng', 'huanggai', 'liubei'],
  ['chibi-1.bossIntro', 'caochun', 'zhaoyun'], ['chibi-2.bossIntro', 'caimao', 'liubei'], ['chibi-3.bossIntro', 'caoren', 'guanyu'],
  ['jingnan.open', 'lusu', 'liubei'], ['jingnan-1.bossIntro', 'zhaofan', 'zhaoyun'], ['jingnan-2.bossIntro', 'liudu', 'zhangfei'],
  ['jingnan-3.intro.hanxuan', 'hanxuan', 'guanyu'], ['jingnan-3.intro.huangzhong', 'yangling', 'huangzhong'],
];
// 第一、二章 + 徐庶 / 刘贤 / 邢道荣（2026-11-18 夜补的对白立绘）；董卓在 2-3 战斗中途卷轴（midScrolls）里露脸，张世平在第一章章头
const SHOTS_CH12 = [
  ['huangjin-2.brief', 'jianyong', 'liubei'], ['huangjin-1.bossIntro', 'zhangliang', 'liubei'], ['huangjin-2.bossIntro', 'zhangbao', 'liubei'], ['huangjin-3.bossIntro', 'zhangjiao', 'liubei'],
  ['hulao-1.bossIntro', 'huaxiong', 'guanyu'], ['hulao-2.bossIntro', 'xurong', 'liubei'], ['hulao-3.on_wall', 'dongzhuo', 'liubei'], ['hulao-3.on_wall', 'lubu', 'liubei'], ['hulao-3.dongzhuo_descend', 'dongzhuo', 'liubei'],
  ['qunxiong.open', 'lubu', 'liubei'], ['huangjin.open', 'zhangshiping', 'liubei'],
  ['chibi.open', 'xushu', 'liubei'], ['jingnan-2.brief', 'xingdaorong', 'zhaoyun'], ['jingnan-2.brief', 'liuxian', 'zhaoyun'],
];
const SHOTS = process.env.SET === 'ch56' ? SHOTS_CH56 : process.env.SET === 'ch12' ? SHOTS_CH12 : SHOTS_CH34;
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 60000 });
await p.waitForTimeout(1200);
const results = [];
for (const [id, who, lord] of SHOTS) {
  const r = await p.evaluate(async ([id, who, lord]) => {
    const s = window.__game.scene.getScene('GameScene'), S = await import('/src/systems/Story.ts'), D = await import('/src/data/story/index.ts');
    for (const o of s.children.list.filter(o => o.name?.startsWith?.('story-'))) o.destroy();
    let node = null;
    for (const c of Object.values(D.STORY_CHAPTERS)) {
      const all = [c.open, c.close, ...(c.closeAfter ?? []), ...(c.camp ?? []), ...(c.barks ?? []), ...(c.midScrolls ?? []), ...Object.values(c.stages).flatMap(st => [...(st.before ?? []), st.brief, ...(st.after ?? []), st.choice, st.bossIntro, st.bossPhase, st.bossFall,
        ...Object.values(st.bossIntros ?? {}), ...Object.values(st.bossPhases ?? {}), ...Object.values(st.bossFalls ?? {})])];
      node = all.find(n => n?.id === id) ?? node;
    }
    if (!node) return { id, err: 'no node' };
    const ctx = { lord, team: () => [lord, 'zhangfei', 'guanyu'], recruited: () => true };
    const lines = S.resolveLines(node, ctx), k = lines.findIndex(l => l.who === who);
    if (k < 0) return { id, err: 'speaker not in lines', whos: lines.map(l => l.who) };
    s.scene.pause?.call; S.playStoryScroll(s, node, lines, ctx, '继续', () => {});
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (let t = 0; t < 40 && !s.children.list.find(o => o.name === 'story-' + id.replace(/\./g, '-') + '-next' || o.name === 'story-confirm'); t++) await wait(100);
    await wait(300);
    const find = n => { const q = [...s.children.list]; while (q.length) { const o = q.shift(); if (o.name === n) return o; if (o.list) q.push(...o.list); } return null; };
    for (let i = 0; i < k; i++) { const h = find('story-' + id.replace(/\./g, '-') + '-next'); if (!h) break; h.emit('pointerup'); h.emit('pointerdown'); await wait(120); }
    await wait(500);
    const face = find('story-' + id.replace(/\./g, '-') + '-portrait'), ill = find('story-' + id.replace(/\./g, '-') + '-illustration');
    return { id, who, page: k + 1, face: face?.visible ? face.texture.key : null, ill: ill?.texture.key ?? null };
  }, [id, who, lord]);
  await p.screenshot({ path: `${out}/${id.replace(/\./g, '-')}-${who}.png` });
  results.push(r); console.log(JSON.stringify(r));
}
console.log('errors', JSON.stringify(errors.slice(0, 5)));
await b.close();
