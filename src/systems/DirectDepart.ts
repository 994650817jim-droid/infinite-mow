import type Phaser from 'phaser';

/**
 * 「直接出征」（2026-11-18 用户「应该不需要这个画面，因为只有主公可以出战」；11-19「打第三章的时候又出现这个老界面了」）：
 * 电脑版从天下地图出征 / 主页选关 / 战役回顾进入第三章起的各章选关场景时，不再显示选将 + 选关页，场景一建好就以主公打选中的关
 * （worldStagePick 指定的关，否则本章下一个未通关的关——沿用各章场景自己的选关规则与 depart()）。
 * 手机布局与直接打开选关场景的测试照旧显示原页面。
 */
const KEY = 'directDepart';

/** 进入章节选关场景前调用（只在电脑布局生效）。 */
export function requestDirectDepart(scene: Phaser.Scene): void {
  if (scene.scale.width > 600) scene.registry.set(KEY, true); else scene.registry.remove(KEY);
}

/** 章节选关场景 create() 里调用：有请求就消费掉并返回 true（调用方随即 depart()）。 */
export function takeDirectDepart(scene: Phaser.Scene): boolean {
  if (!scene.registry.get(KEY)) return false;
  scene.registry.remove(KEY);
  return scene.scale.width > 600;
}
