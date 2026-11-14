import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = join(root, '.build-tmp');
mkdirSync(temp, { recursive: true });
const env = { ...process.env };
// Windows 系统临时目录的 esbuild 删除操作可能被权限拦截；项目内临时目录已验证可用。
if (process.platform === 'win32') { env.TEMP = temp; env.TMP = temp; }
for (const [script, args, timeout] of [
  ['typescript/bin/tsc', ['--noEmit'], 30000],
  ['vite/bin/vite.js', ['build'], 60000],
]) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules', script), ...args], {
    cwd: root, env, stdio: 'inherit', timeout,
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}

// 发布包瘦身：Vite 会把 public/ 原样复制进 dist，包括原图、生成提示词、预览页和已被新版替换的素材。
// 这里只从 dist 删除，public/ 里的源文件一律保留。新增运行时素材时请勿放进下列路径。
const dist = join(root, 'dist');
const NON_RUNTIME_FILES = [
  // 已被 *-mobile.png 替代，代码不再加载
  'assets/processed/overhaul/bronze-panel-v1.webp',
  'assets/processed/overhaul/hulao-ground-v1.webp',
  'assets/processed/overhaul/battlefield-props-v1.webp',
  'assets/processed/overhaul/huangjin-ground-v1.webp',
  'assets/processed/overhaul/combat-fx-v2.webp',
  'assets/processed/hulao/gate.png',
  'assets/processed/ui_card_1.png', 'assets/processed/ui_card_2.png', 'assets/processed/ui_card_3.png',
  'assets/processed/icon_weapon_spear.png', 'assets/processed/icon_weapon_guandao.png',
  'assets/processed/icon_weapon_bow.png', 'assets/processed/icon_weapon_flag.png',
  'assets/build-vfx/styles.png', // 运行时用 styles-ai-v1.png
];
const NON_RUNTIME_NAME = /^(originals|GENERATION_PROMPTS\.md|(asset-)?manifest\.json|preview(-.*)?\.html)$/;
let removed = 0, bytes = 0;
const drop = (p) => { const s = statSync(p); bytes += s.isDirectory() ? dirSize(p) : s.size; rmSync(p, { recursive: true, force: true }); removed++; };
const dirSize = (p) => readdirSync(p, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? dirSize(join(p, e.name)) : statSync(join(p, e.name)).size), 0);
const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (NON_RUNTIME_NAME.test(e.name)) drop(p); else if (e.isDirectory()) walk(p); } };
for (const f of NON_RUNTIME_FILES) { const p = join(dist, f); if (existsSync(p)) drop(p); }
walk(join(dist, 'assets'));
for (const d of ['asset-review']) { const p = join(dist, d); if (existsSync(p) && readdirSync(p).length === 0) rmSync(p, { recursive: true }); }
console.log(`[build] 剔除非运行时素材 ${removed} 项，${(bytes / 1048576).toFixed(1)} MiB`);
