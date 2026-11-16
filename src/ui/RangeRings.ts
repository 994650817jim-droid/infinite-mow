/**
 * 技能 / 战法范围圈开关（2026-11-16 试玩反馈「技能范围提示太丑，可以以特效代替」）。
 * 默认不画范围圈，改用命中或释放时的轻量光效；网址加 ?rings=1 时恢复旧的范围圈，方便对比。
 * 每位武将脚下的金色「主将」圈不受影响（它不是技能范围）。
 */
export const SHOW_RANGE_RINGS: boolean = (() => {
  try { return new URLSearchParams(globalThis.location?.search ?? '').get('rings') === '1'; } catch { return false; }
})();
