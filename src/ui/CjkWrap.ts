import Phaser from 'phaser';

/**
 * 中文自动换行（避头尾）。
 * Phaser 自带的换行只在空格处断行：一整段中文要么溢出文本框，要么（高级换行）逐字硬切，
 * 句读「，。）」常被挤到行首、「（「」留在行尾。这里替换两种换行：
 * - 每个汉字都是断行点，英文单词与数字保持整体；
 * - 行首禁用的标点与前一个字粘在一起换行，行尾禁用的开括号与后一个字粘在一起；
 * - 原文里的换行保留。
 * 只影响开启了 wordWrap 的 Text，纯界面表现。
 */
const NO_START = new Set([...'，。、；：？！）」』】》〉〕”’…—·%‰,.;:?!)]}～']);
const NO_END = new Set([...'（「『【《〈〔“‘([{']);
const CJK = /[⺀-⿿　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

/** 切成不可再分的片段：单个汉字 / 连续的非空白西文 / 空格；随后按避头尾规则粘连。 */
export function cjkTokens(line: string): string[] {
  const raw: string[] = [];
  let word = '';
  for (const ch of line) {
    if (ch === ' ') { if (word) raw.push(word); word = ''; raw.push(' '); }
    else if (CJK.test(ch) || NO_START.has(ch) || NO_END.has(ch)) { if (word) raw.push(word); word = ''; raw.push(ch); }
    else word += ch;
  }
  if (word) raw.push(word);
  const out: string[] = [];
  let carry = '';
  for (const t of raw) {
    if (t === ' ') { if (carry) { out.push(carry); carry = ''; } out.push(t); continue; }
    if (NO_START.has(t[0]) && out.length && out[out.length - 1] !== ' ' && !carry) { out[out.length - 1] += t; continue; }
    const tok = carry + t; carry = '';
    if (NO_END.has(tok[tok.length - 1])) { carry = tok; continue; }
    out.push(tok);
  }
  if (carry) out.push(carry);
  return out;
}

export function wrapCjkLine(line: string, measure: (s: string) => number, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const tok of cjkTokens(line)) {
    if (tok === ' ') { if (cur) cur += ' '; continue; }
    const test = cur + tok;
    if (!cur || measure(test) <= max) {
      if (!cur && measure(tok) > max && tok.length > 1) {
        // 超长单词（网址、长数字）只能逐字拆开
        let piece = '';
        for (const ch of tok) { if (piece && measure(piece + ch) > max) { lines.push(piece); piece = ''; } piece += ch; }
        cur = piece;
      } else cur = test;
      continue;
    }
    lines.push(cur.replace(/[ 　]+$/, ''));
    cur = /^　+$/.test(tok) ? '' : tok; // 续行不以全角空格开头
  }
  lines.push(cur.replace(/ +$/, ''));
  return lines;
}

let installed = false;
export function installCjkWrap(): void {
  if (installed) return; installed = true;
  const proto = Phaser.GameObjects.Text.prototype as unknown as {
    basicWordWrap: (text: string, ctx: CanvasRenderingContext2D, w: number) => string;
    advancedWordWrap: (text: string, ctx: CanvasRenderingContext2D, w: number) => string;
  };
  type T = Phaser.GameObjects.Text & { splitRegExp: RegExp };
  const wrap = (self: T, text: string, ctx: CanvasRenderingContext2D, w: number, condense: boolean): string => {
    const ls = self.letterSpacing || 0;
    const measure = (s: string) => ctx.measureText(s).width + [...s].length * ls;
    const src = condense ? text.replace(/ +/g, ' ') : text;
    const out = src.split(self.splitRegExp).map(l => wrapCjkLine(condense ? l.trim() : l, measure, w).join('\n')).join('\n');
    return condense ? out.replace(/\s+$/, '') : out;
  };
  proto.basicWordWrap = function (this: T, text, ctx, w) { return wrap(this, text, ctx, w, false); };
  proto.advancedWordWrap = function (this: T, text, ctx, w) { return wrap(this, text, ctx, w, true); };
}
