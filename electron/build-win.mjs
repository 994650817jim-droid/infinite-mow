// 打包 Windows 桌面版（Steam 用的免安装目录 release/win-unpacked）。用法：npm run dist:win
// - electron-builder 的缓存放在项目内 .build-tmp/eb-cache（部分环境无权写 %LOCALAPPDATA%\electron-builder）
// - Electron 本体用 node_modules/electron/dist（package.json build.electronDist），不再重复下载
// - 若缓存里还没有签名工具 winCodeSign-2.6.0：其压缩包含 macOS 符号链接，Windows 无管理员权限会解压失败，
//   这里先下载并跳过 darwin 目录解压（只用到 Windows 的 rcedit）。
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const cache = join(root, '.build-tmp', 'eb-cache'), sign = join(cache, 'winCodeSign', 'winCodeSign-2.6.0');
mkdirSync(join(cache, 'winCodeSign'), { recursive: true });
if (!existsSync(join(sign, 'rcedit-x64.exe'))) {
  const archive = join(cache, 'winCodeSign', 'winCodeSign-2.6.0.7z');
  const res = await fetch('https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z');
  if (!res.ok) throw new Error('下载 winCodeSign 失败：' + res.status);
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  execFileSync(join(root, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'), ['x', archive, '-o' + sign, '-xr!darwin', '-y'], { stdio: 'ignore' });
  rmSync(archive, { force: true });
}
execFileSync(process.execPath, [join(root, 'node_modules', 'electron-builder', 'cli.js'), '--win', 'dir'], { cwd: root, stdio: 'inherit', env: { ...process.env, ELECTRON_BUILDER_CACHE: cache } });
// Electron 放在 OneDrive 同步目录里运行会直接崩溃（0x80000003）；玩家由 Steam 装到 steamapps 不受影响。
// 本机试玩 / 自动测试统一用复制到 %LOCALAPPDATA% 的这一份。
const local = join(process.env.LOCALAPPDATA ?? root, 'InfiniteMow-build');
rmSync(local, { recursive: true, force: true }); cpSync(join(root, 'release', 'win-unpacked'), local, { recursive: true });
console.log('桌面版已输出：release/win-unpacked/InfiniteMow.exe');
console.log('本机试玩请运行（不在 OneDrive 内）：' + join(local, 'InfiniteMow.exe'));
