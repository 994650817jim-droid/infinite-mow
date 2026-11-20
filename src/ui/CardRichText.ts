import Phaser from 'phaser';

/**
 * 升级三选一卡面说明（2026-11-19 用户「关于技能3选一描述需要检查优化一下」）：数字自动高亮（+15%、−10%、20 秒、×4、6 名…），
 * 文案本身不加标记（同一份说明还用在增益栏、商人、构筑总览里）。自己换行：按像素宽度断行，标点不放行首；
 * 每行拆成「普通 / 高亮」几段 Text，居中或左对齐。返回总高度（卡片按它缩字号）。
 */
export interface RichStyle { maxW: number; size: number; lineSpacing: number; family: string; color: string; hi: string; stroke: string; strokeW: number; align: 'center' | 'left' }
/** 要高亮的数字片段：可带正负号 / 乘号 / 箭头前后的数，后面跟单位（% 秒 名 人 次 支 把 柄 道 层 个 势 级 生命）。 */
const NUM = /([+\-−×]?\s?\d+(?:\.\d+)?(?:\s?[→~～/]\s?\d+(?:\.\d+)?)*\s?(?:%|秒|名|人|次|支|把|柄|道|层|个|势|级)?)/g;
const NO_HEAD = '，。、；：！？）」』%·…—';

/** 一段段：[文字, 是否高亮]。 */
export function richRuns(text: string): Array<[string, boolean]> {
  const out: Array<[string, boolean]> = []; let last = 0;
  for (const m of text.matchAll(NUM)) { const i = m.index ?? 0; if (!/\d/.test(m[0])) continue; if (i > last) out.push([text.slice(last, i), false]); out.push([m[0], true]); last = i + m[0].length; }
  if (last < text.length) out.push([text.slice(last), false]);
  return out;
}

/** 把 text 排进 root（先清空），返回总高度。 */
export function layoutRich(scene: Phaser.Scene, root: Phaser.GameObjects.Container, text: string, st: RichStyle): number {
  root.removeAll(true);
  const mk = (s: string, hi: boolean): Phaser.GameObjects.Text => scene.add.text(0, 0, s, { fontFamily: st.family, fontSize: st.size + 'px', color: hi ? st.hi : st.color, resolution: 2, stroke: st.stroke, strokeThickness: st.strokeW }).setScrollFactor(0);
  const probe = mk('', false), width = (s: string): number => { probe.setText(s); return probe.width - st.strokeW; };
  // 断行：逐字累加，超宽就断；高亮的数字段不拆开（整段挪到下一行），标点不放行首
  const lines: Array<Array<[string, boolean]>> = [];
  for (const para of text.split('\n')) {
    let line: Array<[string, boolean]> = [], plain = '';
    const push = (): void => { lines.push(line); line = []; plain = ''; };
    for (const [seg, hi] of richRuns(para)) {
      const units = hi ? [seg] : [...seg];
      for (const u of units) {
        if (plain && width(plain + u) > st.maxW && !NO_HEAD.includes(u[0])) push();
        if (!plain && u === ' ') continue;
        const tail = line[line.length - 1]; if (tail && tail[1] === hi) tail[0] += u; else line.push([u, hi]); plain += u;
      }
    }
    push();
  }
  probe.destroy();
  const lh = Math.round(st.size * 1.32) + st.lineSpacing;
  lines.forEach((ln, row) => {
    const parts = ln.map(([s, hi]) => mk(s, hi)), w = parts.reduce((n, t) => n + t.width - st.strokeW, 0);
    let x = st.align === 'center' ? -w / 2 : 0;
    for (const t of parts) { t.setPosition(x, row * lh); x += t.width - st.strokeW; root.add(t); }
  });
  root.setData('lines', lines.length).setData('text', text);
  return lines.length ? lines.length * lh - st.lineSpacing : 0;
}

/** 卡的有效范围徽记：本关有效 / 本次征程 / 一次性 / 永久。 */
export type CardScope = 'stage' | 'run' | 'once' | 'forever';
export const SCOPE_BADGE: Record<CardScope, { text: string; bg: string; color: string }> = {
  stage: { text: '本关有效', bg: '#7a3a1c', color: '#ffe0c0' },
  run: { text: '本次征程', bg: '#2c5a44', color: '#d6f5e0' },
  once: { text: '一次性', bg: '#3c4a6a', color: '#dce6ff' },
  forever: { text: '永久', bg: '#5a3f6e', color: '#efdcff' },
};
/** 卡的有效范围：卡上写了就用；否则按类别（本命 / 武艺 / 战法 = 本次征程，宝药 = 一次性，保底 / 机缘 = 本关，信物 = 永久）。 */
export function cardScope(o: { scope?: CardScope; kind: string }): CardScope {
  if (o.scope) return o.scope;
  return o.kind === 'potion' ? 'once' : o.kind === 'foundation' ? 'stage' : o.kind === 'trinket' || o.kind === 'relic' ? 'forever' : 'run';
}
