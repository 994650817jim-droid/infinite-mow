import { rollbackBattle } from './BattleSnapshot';

/**
 * 启动时：上次有一场没打完就关了页面 / 刷新 / 崩溃（快照还在）→ 先把存档回滚到那场进关前，再让各存档模块读档。
 * main.ts 里紧跟平台层（platform/desktop 换存储）之后 import，保证在任何模块缓存存档之前执行。
 */
export const rolledBackOnBoot = rollbackBattle();
