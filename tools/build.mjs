import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const temp = join(root, '.build-tmp');
mkdirSync(temp, { recursive: true });
const env = { ...process.env };
// Windows 系统临时目录的 esbuild 删除操作可能被权限拦截；项目内临时目录已验证可用。
if (process.platform === 'win32') { env.TEMP = temp; env.TMP = temp; }
for (const [script, args, timeout] of [
  ['typescript/bin/tsc', ['--noEmit'], 300000],
  ['vite/bin/vite.js', ['build'], 900000],
]) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules', script), ...args], {
    cwd: root, env, stdio: 'inherit', timeout,
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}

// 发布包瘦身（tools/prune-dist.mjs）：只动 dist，public/ 里的源文件一律保留——剔除 originals / raw / 提示词 / 清单 / 预览页 / 旧版素材，大 PNG 无损转 WebP。
const { prune, compress } = await import('./prune-dist.mjs');
const dist = join(root, 'dist');
prune(dist);
await compress(dist);
