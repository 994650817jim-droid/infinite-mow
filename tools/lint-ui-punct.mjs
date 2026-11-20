// 界面文字标点检查 / 修正（2026-11-19「关于文本可以优化修改」）：在源码的中文字符串字面量里找半角标点与 ASCII 双引号。
// 不碰剧情台词（data/story）、三选一卡面（upgrades.ts / builds.ts，新增可玩武将会话在改）、开发工具（dev/）。
// 用法：node tools/lint-ui-punct.mjs          只列出
//       FIX=1 node tools/lint-ui-punct.mjs    就地改成全角（，；！？：「」）
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const skip = /src[\\/](data[\\/]story|dev)[\\/]|upgrades\.ts$|builds\.ts$/, FIX = process.env.FIX === '1';
const files = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(f) && !skip.test(p)) files.push(p); } })('src');
const lit = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, cjk = /[一-鿿]/;
const H = '[\\u4e00-\\u9fff）」】]';
// 只改「中文 + 半角标点」与「半角标点 + 中文」；冒号后跟数字（时间 1:27）不改
const fixBody = s => s
  .replace(new RegExp(`(${H}),(?!\\d)`, 'g'), '$1，').replace(new RegExp(`(${H});`, 'g'), '$1；')
  .replace(new RegExp(`(${H})!`, 'g'), '$1！').replace(new RegExp(`(${H})\\?(?![.:])`, 'g'), '$1？')
  .replace(new RegExp(`(${H}):(?![0-9/])`, 'g'), '$1：')
  .replace(/"([^"\n]*[一-鿿][^"\n]*)"/g, '「$1」');
let n = 0; const per = {};
for (const f of files) {
  const src = readFileSync(f, 'utf8'); let changed = false;
  const out = src.replace(lit, s => {
    if (!cjk.test(s)) return s;
    // 模板字符串里的 ${…} 原样保留，只改外面的文字
    const q = s[0], inner = s.slice(1, -1), parts = q === '`' ? inner.split(/(\$\{[^}]*\})/) : [inner];
    const fixed = parts.map(p => p.startsWith('${') ? p : (q === '"' ? fixBody(p.replace(/"/g, '\u0000')).replace(/\u0000/g, '"') : fixBody(p))).join('');
    if (fixed === inner) return s;
    n++; per[f] = (per[f] ?? 0) + 1; if (!FIX && n <= 60) console.log(f.replace(/\\/g, '/') + ' ｜ ' + s.slice(0, 100));
    changed = true; return q + fixed + q;
  });
  if (FIX && changed) writeFileSync(f, out);
}
console.log((FIX ? '已改 ' : '待改 ') + n + ' 处'); console.log(JSON.stringify(per));
