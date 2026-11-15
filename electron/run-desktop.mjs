// 开发时运行桌面版：npm run desktop（先构建 dist）。
// Electron 可执行文件放在 OneDrive 同步目录里会启动即崩溃，因此复制一份运行时到 %LOCALAPPDATA%，游戏文件仍从项目目录加载。
import { spawn } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const src = join(root, 'node_modules', 'electron', 'dist'), dst = join(process.env.LOCALAPPDATA ?? root, 'InfiniteMow-build', 'electron-runtime');
const version = f => (existsSync(f) ? readFileSync(f, 'utf8').trim() : '');
if (version(join(dst, 'version')) !== version(join(src, 'version'))) { rmSync(dst, { recursive: true, force: true }); cpSync(src, dst, { recursive: true }); }
const child = spawn(join(dst, 'electron.exe'), [root, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, IM_WINDOWED: process.env.IM_WINDOWED ?? '1' } });
child.on('exit', code => process.exit(code ?? 0));
