// 说话人立绘静态检查（2026-11-21，共享笔记 speaker-portrait-audit.md）：不开浏览器，node 直接读数据。
// 1) 扫 src 下所有台词的 who（字符串字面量，含 { who: '简雍', id: 'jianyong' } 这种带 id 的），按唯一入口 data/story/speakers.ts 解析：
//    要么解析到立绘（且文件真的在 public/assets/），要么在「允许用名字章」的白名单 SEAL_OK 里（斥候、亲兵、涿郡良匠……）。
// 2) 对账三张清单：ink-cast 有图没条目、STORY_CAST 有条目没图、台词里出现却查不到的名字。
// 用法：node tools/test-speaker-portraits.mjs（需要 node_modules 里的 esbuild；NODE_PATH 指向主工作区的 node_modules 也行）
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild; try { esbuild = require('esbuild'); } catch { esbuild = require(join(process.env.NODE_PATH ?? '', 'esbuild')); }
const root = process.cwd();
/** 打包成内存里的 ESM 再用 data: URL 载入（不写临时文件）。 */
const load = async entry => { const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' }); return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')); };
const S = await load('src/data/story/speakers.ts');
const cast = (await load('src/data/story/types.ts')).STORY_CAST;

const fileOf = key => key.startsWith('ink_hero_') ? 'public/assets/ink-scroll/' + key.slice(9) + '.webp' : key.startsWith('ink_cast_') ? 'public/assets/ink-cast/' + key.slice(9) + '.webp' : null;
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };

// ———— 扫台词 ————
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const RE = /\bwho\s*:\s*(['"])([^'"\n]*)\1(?:\s*,\s*(?:text\s*:\s*(?:'[^'\n]*'|"[^"\n]*"|`[^`\n]*`)\s*,\s*)?id\s*:\s*(['"])([^'"\n]*)\3)?/g;
/** 台词卡直接写名字的：showBarkCard(…, { …, name: '简雍', … }) */
const RE_CARD = /showBarkCard\([^;]*?\bname\s*:\s*(['"])([^'"\n]+)\1(?:[^;]*?\bid\s*:\s*(['"])([^'"\n]+)\3)?/g;
const speakers = new Map(); // who|id → { who, id, at: [file:line] }
for (const f of walk(join(root, 'src'))) {
  if (/[\\/]dev[\\/]/.test(f) || f.endsWith('speakers.ts')) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of [...src.matchAll(RE), ...src.matchAll(RE_CARD)]) {
    const who = m[2], id = m[4];
    if (!who || who === '{lord}' || who === '@lord') continue;
    if (/^新玩法|^[!！]|·/.test(who)) continue; // 玩法提示卡的标题不是说话人
    const key = who + (id ? '|' + id : ''), line = src.slice(0, m.index).split('\n').length;
    const e = speakers.get(key) ?? { who, id, at: [] }; e.at.push(relative(root, f).replace(/\\/g, '/') + ':' + line); speakers.set(key, e);
  }
}
const unresolved = [], sealed = [], ok = [], brokenFile = [], waiting = [];
for (const e of speakers.values()) {
  const a = S.speakerArt(e.who, { id: e.id });
  if (a.portrait) { const f = fileOf(a.portrait); if (f && existsSync(join(root, f))) ok.push(e.who); else brokenFile.push({ who: e.who, portrait: a.portrait, at: e.at[0] }); }
  else if (S.SEAL_OK.has(a.name ?? e.who)) sealed.push(a.name ?? e.who);
  else if (S.AWAITING_ART.has(a.name ?? e.who)) waiting.push(`${a.name ?? e.who} ×${e.at.length}（${e.at[0]}）`);
  else unresolved.push({ who: e.who, id: e.id, name: a.name, n: e.at.length, at: e.at.slice(0, 3) });
}
console.log(`说话人 ${speakers.size} 种：有立绘 ${ok.length}，泛称用名字章 ${sealed.length}（${[...new Set(sealed)].join('、')}），立绘排队中 ${waiting.length}，查不到立绘 ${unresolved.length}`);
console.log('立绘排队中（先用名字章，不算失败）：' + (waiting.join('、') || '无'));

// ———— 对账 ————
const castFiles = readdirSync(join(root, 'public/assets/ink-cast')).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5));
const heroArt = new Set(readdirSync(join(root, 'public/assets/ink-scroll')).filter(f => f.endsWith('.webp')).map(f => f.slice(0, -5)));
const castKeys = new Set(Object.values(cast).map(c => c.portrait).filter(Boolean));
const noEntry = castFiles.filter(id => !castKeys.has('ink_cast_' + id) && !heroArt.has(id)); // 可玩武将的水墨立轴（ink-scroll）已覆盖的不算
const noFile = Object.entries(cast).filter(([, c]) => c.portrait && !existsSync(join(root, fileOf(c.portrait)))).map(([id, c]) => id + '（' + c.name + '）');
const noPortrait = Object.entries(cast).filter(([, c]) => !c.portrait).map(([id, c]) => id + '（' + c.name + '）');

console.log('\n清单一 · ink-cast 有图、STORY_CAST 没条目（也不是有立轴的可玩武将）：' + (noEntry.join('、') || '无'));
console.log('清单二 · STORY_CAST 写了立绘、文件不存在：' + (noFile.join('、') || '无') + '；（登记了但还没立绘、先用名字章：' + (noPortrait.join('、') || '无') + '）');
console.log('清单三 · 台词里出现、查不到立绘、也不在泛称白名单：' + (unresolved.map(u => `${u.who}${u.id ? '[' + u.id + ']' : ''} ×${u.n}（${u.at[0]}）`).join('、') || '无') + '\n');

// 排查里点名的「有立绘却显示字印」：中文名 / id 都要解析到立绘（回归）
const named = ['张任', '刘璋', '法正', '孟获', '马谡', '吕蒙', '王甫', '庞德', '司马懿', '陆逊', '张世平', '简雍', 'jianyong', 'zhangshiping', '典韦', '甘宁', '祝融', '孙权'];
const namedBad = named.filter(n => { const a = S.speakerArt(n); return !a.portrait || !existsSync(join(root, fileOf(a.portrait))); });
ck('排查点名的人（张任、刘璋、法正、孟获、马谡、吕蒙、王甫、庞德、司马懿、陆逊、张世平、简雍，及新可玩武将）按中文名 / id 都解析到立绘', namedBad.length === 0, namedBad);
ck('ink-cast 的每张图都有 STORY_CAST 条目（或是有立轴的可玩武将）', noEntry.length === 0, noEntry);
ck('STORY_CAST 登记的立绘文件都在', noFile.length === 0, noFile);
ck('解析到的立绘文件都在（ink-scroll / ink-cast）', brokenFile.length === 0, brokenFile);
ck('所有台词说话人：要么有立绘，要么是白名单泛称', unresolved.length === 0, unresolved.map(u => u.who + ' @' + u.at[0]));
const rep = process.env.REPORT; if (rep) writeFileSync(rep, JSON.stringify({ noEntry, noFile, noPortrait, unresolved, sealed: [...new Set(sealed)] }, null, 1));
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
