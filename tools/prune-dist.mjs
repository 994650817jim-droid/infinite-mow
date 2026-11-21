// 发布包瘦身（tools/build.mjs 在 vite build 之后调用；也可单独跑：node tools/prune-dist.mjs <dist 目录>）。
// 只动 dist，不碰 public/ 里的任何源文件（项目规则：原图不能删）。
// ① 剔除非运行时文件：所有 originals/ 与 raw/ 目录、GENERATION_PROMPTS.md、manifest、preview*.html、被新版替换的旧素材、图集切图的中间图；
// ② 把大 PNG 无损转成 WebP（文件名仍叫 .png）：运行时 Phaser 用 Image / Blob / WebGL 解码，浏览器按内容识别格式（Chrome / Electron 已验证
//    img / blob / createImageBitmap / texImage2D 四条路径都正常），像素完全一致（lossless），典型体积 −60%~−75%。需要 cwebp（apt install webp）或 ffmpeg，
//    都没有就跳过压缩并提示（不影响正确性，只是 dist 更大）。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MiB = n => (n / 1048576).toFixed(1);
const NON_RUNTIME_FILES = [
  // 已被 *-mobile.png 替代，代码不再加载
  'assets/processed/overhaul/bronze-panel-v1.webp', 'assets/processed/overhaul/hulao-ground-v1.webp', 'assets/processed/overhaul/battlefield-props-v1.webp',
  'assets/processed/overhaul/huangjin-ground-v1.webp', 'assets/processed/overhaul/combat-fx-v2.webp', 'assets/processed/hulao/gate.png',
  'assets/processed/ui_card_1.png', 'assets/processed/ui_card_2.png', 'assets/processed/ui_card_3.png',
  'assets/processed/icon_weapon_spear.png', 'assets/processed/icon_weapon_guandao.png', 'assets/processed/icon_weapon_bow.png', 'assets/processed/icon_weapon_flag.png',
  'assets/build-vfx/styles.png', 'assets/build-vfx/styles-ai-v1.png', // 运行时用 styles-hp-v1.png
  // 战法特效图集的切图中间图（tools/build-vfx-atlas.mjs 的输入，运行时只读拼好的 styles-hp-v1.png；status.png 是运行时图，保留）
  'assets/school-fx/fire.png', 'assets/school-fx/ink.png', 'assets/school-fx/arch.png', 'assets/school-fx/cav.png', 'assets/school-fx/war.png', 'assets/school-fx/form1.png', 'assets/school-fx/form2.png',
];
// 目录 / 文件名：原图目录（originals、raw）、生成提示词、清单、预览页、*_preview.png、*-src.png
const NON_RUNTIME_NAME = /^(originals|raw|GENERATION_PROMPTS\.md|(asset-)?manifest\.json|preview(-.*)?\.html|.*[_-]preview\.(png|webp|jpg)|.*[_-]src\.png)$/;
// 运行时真的会读的 manifest.json（TroopPortraits 兵种胸像清单、世界地图标记清单）：不能剔。其余 manifest 是出图流水线的开发清单。
const KEEP = new Set(['assets/troop-portraits/manifest.json', 'assets/troop-portraits-v2/manifest.json', 'assets/world/markers/manifest.json']);
const dirSize = p => readdirSync(p, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? dirSize(join(p, e.name)) : statSync(join(p, e.name)).size), 0);

export function prune(dist) {
  let removed = 0, bytes = 0;
  const drop = p => { const s = statSync(p); bytes += s.isDirectory() ? dirSize(p) : s.size; rmSync(p, { recursive: true, force: true }); removed++; };
  const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (KEEP.has(p.slice(dist.length + 1).split('\\').join('/'))) continue; if (NON_RUNTIME_NAME.test(e.name)) drop(p); else if (e.isDirectory()) walk(p); } };
  for (const f of NON_RUNTIME_FILES) { const p = join(dist, f); if (existsSync(p)) drop(p); }
  if (existsSync(join(dist, 'assets'))) walk(join(dist, 'assets'));
  const ar = join(dist, 'asset-review'); if (existsSync(ar) && readdirSync(ar).length === 0) rmSync(ar, { recursive: true });
  console.log(`[prune] 剔除非运行时素材 ${removed} 项，${MiB(bytes)} MiB`);
}

const which = cmd => { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null; };
function encoder() {
  const cw = process.env.CWEBP || which('cwebp'); if (cw) return { name: 'cwebp', run: (i, o) => [cw, ['-quiet', '-lossless', '-z', '9', '-exact', i, '-o', o]] };
  const ff = process.env.FFMPEG || which('ffmpeg'); if (ff) return { name: 'ffmpeg', run: (i, o) => [ff, ['-y', '-loglevel', 'error', '-i', i, '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', '-q:v', '100', '-f', 'webp', o]] };
  return null;
}
const pngs = dir => { const out = []; const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.png$/i.test(e.name) && statSync(p).size >= 48 * 1024) out.push(p); } }; walk(dir); return out; };

export async function compress(dist, { minGain = .85 } = {}) {
  const enc = encoder(); if (!enc) { console.log('[compress] 没找到 cwebp / ffmpeg，跳过 PNG → 无损 WebP（dist 会更大，功能不受影响）'); return; }
  const list = pngs(join(dist, 'assets')); let before = 0, after = 0, converted = 0, kept = 0, i = 0; const workers = Math.max(1, Math.min(8, cpus().length - 1));
  const one = f => new Promise(resolve => {
    const tmp = f + '.webp.tmp', [cmd, args] = enc.run(f, tmp), size0 = statSync(f).size; before += size0;
    const c = spawn(cmd, args, { stdio: 'ignore' }); c.on('error', () => { rmSync(tmp, { force: true }); after += size0; kept++; resolve(); });
    c.on('exit', code => { if (code === 0 && existsSync(tmp) && statSync(tmp).size < size0 * minGain) { after += statSync(tmp).size; renameSync(tmp, f); converted++; } else { rmSync(tmp, { force: true }); after += size0; kept++; } resolve(); });
  });
  await Promise.all(Array.from({ length: workers }, async () => { while (i < list.length) await one(list[i++]); }));
  console.log(`[compress] ${enc.name}：${list.length} 张 PNG（≥48 KB）→ 转无损 WebP ${converted} 张、保留 ${kept} 张：${MiB(before)} → ${MiB(after)} MiB（−${((1 - after / Math.max(1, before)) * 100).toFixed(0)}%）`);
  writeFileSync(join(dist, 'assets', '.png-is-webp.txt'), `${converted} files under assets/ are lossless WebP data with a .png file name (browsers decode by content). Generated by tools/prune-dist.mjs.\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  prune(dist); await compress(dist);
}
