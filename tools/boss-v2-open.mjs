// 首领重设计样板：打开对应关卡并刷出首领（test-boss-v2 / record-boss-gif 共用）。
// boss：zhangjiao | lubu | yuanshu | caoren；extra：额外查询参数（如 '&boss=old'）。返回 { scene: 场景键 }。
export const BOSS_SCENES = {
  zhangjiao: { url: '?dev=1&autostart=1&stage=3&layout=desktop', game: 'GameScene' },
  lubu: { url: '?dev=1&layout=desktop', direct: 'LubuGameScene', game: 'LubuGameScene' },
  yuanshu: { url: '?dev=1&thirdStage=3&layout=desktop', chap: 'ThirdChapterScene', deploy: 'third-deploy', game: 'ThirdGameScene' },
  caoren: { url: '?dev=1&chibiStage=3&layout=desktop', chap: 'ChibiChapterScene', deploy: 'chibi-deploy', game: 'ChibiGameScene', stage: 3 },
};
export async function openBoss(page, base, boss, extra = '') {
  const c = BOSS_SCENES[boss];
  await page.goto(base + c.url + extra);
  if (c.direct) {
    await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
    await page.evaluate(k => window.__game.scene.getScene('MenuScene').scene.start(k), c.direct);
  }
  if (c.chap) {
    if (boss !== 'yuanshu') {
      await page.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
      await page.evaluate(([chap, st]) => { const g = window.__game; g.registry.set('worldStagePick', st); g.scene.getScene('MenuScene').scene.start(chap); }, [c.chap, c.stage]);
    }
    await page.waitForFunction(chap => window.__game?.scene.isActive(chap), c.chap, { timeout: 90000 });
    await page.waitForTimeout(600);
    await page.evaluate(([chap, d]) => { const s = window.__game.scene.getScene(chap); const o = s.children.getByName(d) ?? s.children.list.find(x => x.name && x.name.includes('deploy')); o.emit('pointerup'); }, [c.chap, c.deploy]);
  }
  await page.waitForFunction(g => window.__game?.scene.isActive(g) && window.__game.scene.getScene(g).player, c.game, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(g => {
    const s = window.__game.scene.getScene(g);
    s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode?.('none');
    s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') e.deactivate();
    s.spawnBoss(); s.boss.sprite.setPosition(s.player.x + 200, s.player.y - 30);
    // 测试用：主将武器会一直打首领 → 血量低于 8 成就补满，免得自己掉进二阶段（二阶段由 bossDebug().phase2 触发）
    // 升级 / 招兵弹窗会冻结战斗时钟 → 自动选第一项关掉
    const keep = () => { if (s.boss?.active && s.boss.hp < s.boss.maxHp * .95 && !s.__letDie) s.boss.hp = s.boss.maxHp; if (s.mode === 'levelup' || s.mode === 'recruit') s.__DEV_ACTIONS?.closePopup?.(); if (s.player.hp < s.player.maxHp * .4) s.player.hp = s.player.maxHp; };
    s.events.on('preupdate', keep); s.events.on('postupdate', keep);
    document.querySelectorAll('[data-dev-panel],.dev-panel').forEach(x => { x.style.display = 'none'; });
  }, c.game);
  return { scene: c.game };
}
