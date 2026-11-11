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
  ['typescript/bin/tsc', ['--noEmit'], 30000],
  ['vite/bin/vite.js', ['build'], 60000],
]) {
  const result = spawnSync(process.execPath, [join(root, 'node_modules', script), ...args], {
    cwd: root, env, stdio: 'inherit', timeout,
  });
  if (result.error) console.error(result.error.message);
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
