// Steam 桥（STEAM_PLAN.md · S3）：可选依赖 steamworks.js。
// 只有在 ①装了 steamworks.js（npm i steamworks.js，并加入打包 files）②提供 App ID（环境变量 IM_STEAM_APPID，或 exe 同目录 steam_appid.txt）
// ③Steam 客户端在运行 时才启用；否则所有调用都是空操作，游戏照常运行。
// 成就 API 名 = 'ACH_' + 游戏内成就 id 大写（见 STEAM_PLAN.md 附录 · 成就表）。
const fs = require('node:fs');
const path = require('node:path');

let client = null;
let reason = '未启用';

function appId(app) {
  if (process.env.IM_STEAM_APPID) return Number(process.env.IM_STEAM_APPID);
  for (const dir of [path.dirname(app.getPath('exe')), process.cwd()]) {
    try { const n = Number(fs.readFileSync(path.join(dir, 'steam_appid.txt'), 'utf8').trim()); if (n > 0) return n; } catch { /* 没有该文件 */ }
  }
  return 0;
}

/** 在 app ready 之前调用。 */
function initSteam(app) {
  const id = appId(app);
  if (!id) { reason = '未提供 App ID'; return; }
  let steamworks;
  try { steamworks = require('steamworks.js'); } catch { reason = '未安装 steamworks.js'; return; }
  try { client = steamworks.init(id); reason = 'ok'; if (typeof steamworks.electronEnableSteamOverlay === 'function') steamworks.electronEnableSteamOverlay(); }
  catch (e) { client = null; reason = 'Steam 初始化失败：' + (e && e.message ? e.message : e); }
}

function steamAchievementName(id) { return 'ACH_' + String(id).toUpperCase(); }

/** 解锁成就；未启用时忽略。返回是否已发给 Steam。 */
function unlockAchievement(id) {
  if (!client) return false;
  try { return !!client.achievement.activate(steamAchievementName(id)); } catch { return false; }
}

function steamStatus() { return { enabled: !!client, reason }; }

module.exports = { initSteam, unlockAchievement, steamStatus, steamAchievementName };
