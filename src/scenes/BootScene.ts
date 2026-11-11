import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { createGameTextures, createWalkPlaceholders, registerWalkSheet } from '../systems/TextureFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const kind of ['medic', 'crossbowman']) this.load.spritesheet(`legion_${kind}_action`, `assets/processed/legion/${kind}-action.png`, { frameWidth: 96, frameHeight: 96 });
    for (const kind of ['medic', 'crossbowman', 'guardian', 'rider', 'halberdier']) {
      this.load.spritesheet(`legion_${kind}_walk`, `assets/processed/legion/${kind}-walk.png`, { frameWidth: 96, frameHeight: 96 });
    }
    for (const kind of ['takeoff', 'hover', 'landing', 'warning', 'field']) {
      this.load.spritesheet(`lubu_ult_${kind}`, `assets/processed/hulao/ultimate-new/${kind}.png`, { frameWidth: 256, frameHeight: 256 });
    }
    this.load.spritesheet('boss_lubu', 'assets/processed/hulao/lubu-walk.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('lubu_attack', 'assets/processed/hulao/lubu-attack.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('lubu_slash', 'assets/processed/hulao/lubu-slash.png', { frameWidth: 544, frameHeight: 544 });
    this.load.image('ground_hulao', 'assets/processed/hulao/ground.png');
    for (const kind of ['infantry', 'shield', 'archer', 'cavalry', 'elite']) {
      this.load.spritesheet(`xiliang_${kind}_walk`, `assets/processed/xiliang/${kind}-walk.png`, { frameWidth: 96, frameHeight: 96 });
    }
    this.load.image('hero_zhaoyun', 'assets/processed/hero_zhaoyun.png');
    this.load.image('enemy_infantry', 'assets/processed/enemy_infantry.png');
    this.load.image('enemy_archer', 'assets/processed/enemy_archer.png');
    this.load.image('enemy_shield', 'assets/processed/enemy_shield.png');
    this.load.image('enemy_cavalry', 'assets/processed/enemy_cavalry.png');
    this.load.image('enemy_elite', 'assets/processed/enemy_elite.png');
    this.load.image('boss_zhangjiao', 'assets/processed/boss_zhangjiao.png');
    this.load.image('ground_ai', 'assets/processed/ground_ai.png');
    this.load.image('ground_ai2', 'assets/processed/ground_ai2.png');
    this.load.spritesheet('hero_walk_sheet', 'assets/processed/hero_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('guanyu_walk_sheet', 'assets/processed/guanyu_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('huangzhong_walk_sheet', 'assets/processed/huangzhong_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_infantry_walk_sheet', 'assets/processed/enemy_infantry_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_shield_walk_sheet', 'assets/processed/enemy_shield_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_archer_walk_sheet', 'assets/processed/enemy_archer_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_archer_attack_sheet', 'assets/processed/enemy_archer_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_cavalry_run_sheet', 'assets/processed/enemy_cavalry_run_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_cavalry_charge_sheet', 'assets/processed/enemy_cavalry_charge_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('enemy_officer_walk_sheet', 'assets/processed/enemy_officer_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_swordsman_walk_sheet', 'assets/processed/shu_swordsman_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_swordsman_attack_sheet', 'assets/processed/shu_swordsman_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_archer_walk_sheet', 'assets/processed/shu_archer_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.image('icon_shu_swordsman', 'assets/processed/icon_shu_swordsman.png');
    this.load.image('icon_shu_archer', 'assets/processed/icon_shu_archer.png');
    this.load.image('icon_shu_spearman', 'assets/processed/icon_shu_spearman.png');
    this.load.spritesheet('shu_archer_attack_sheet', 'assets/processed/shu_archer_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_spearman_walk_sheet', 'assets/processed/shu_spearman_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('shu_spearman_attack_sheet', 'assets/processed/shu_spearman_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zhuge_walk_sheet', 'assets/processed/zhuge_walk_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('zhuge_attack_sheet', 'assets/processed/zhuge_attack_sheet.png', { frameWidth: 96, frameHeight: 96 });
    this.load.image('portrait_zhuge', 'assets/processed/portrait_zhuge.png');
    this.load.image('spear_thrust', 'assets/processed/spear_thrust.png');
    this.load.spritesheet('guandao_slash_sheet', 'assets/processed/guandao_slash_sheet.png', { frameWidth: 256, frameHeight: 256 });
    this.load.image('huangzhong_portrait', 'assets/processed/huangzhong_portrait.png');
    this.load.image('guanyu_portrait', 'assets/processed/guanyu_portrait.png');
    this.load.image('item_drum', 'assets/processed/item_drum.png');
    this.load.image('item_whetstone', 'assets/processed/item_whetstone.png');
    this.load.image('item_armor', 'assets/processed/item_armor.png');
    this.load.image('item_wine', 'assets/processed/item_wine.png');
    this.load.image('item_oil', 'assets/processed/item_oil.png');
    this.load.image('item_torch', 'assets/processed/item_torch.png');
    this.load.image('item_ring', 'assets/processed/item_ring.png');
    this.load.image('item_quiver', 'assets/processed/item_quiver.png');

    this.load.image('arrow', 'assets/processed/enemy_arrow.png');
    this.load.image('ui_card', 'assets/processed/ui_card.png');
    this.load.image('ui_panel', 'assets/processed/ui_panel.png');
    this.load.image('ui_button', 'assets/processed/ui_button.png');
    this.load.image('icon_1', 'assets/processed/icon_1.png');
    this.load.image('icon_2', 'assets/processed/icon_2.png');
    this.load.image('icon_3', 'assets/processed/icon_3.png');
  }

  create(): void {
    createGameTextures(this);
    createWalkPlaceholders(this);
    registerWalkSheet(this);
    for (const kind of ['medic', 'crossbowman']) {
      const texture = this.textures.get(`legion_${kind}_action`);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => { for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 96, row * 96, 96, 96); });
    }
    for (const kind of ['medic', 'crossbowman', 'guardian', 'rider', 'halberdier']) {
      const texture = this.textures.get(`legion_${kind}_walk`);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 96, row * 96, 96, 96);
      });
    }
    // Exclude the original transparent margin without altering the source PNG.
    this.textures.get('spear_thrust').add('tight', 0, 31, 51, 460, 62);
    for (const key of ['boss_lubu', 'lubu_attack']) {
      const texture = this.textures.get(key);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 256, row * 256, 256, 256);
      });
    }
    for (const kind of ['infantry', 'shield', 'archer', 'cavalry', 'elite']) {
      const texture = this.textures.get(`xiliang_${kind}_walk`);
      ['down', 'left', 'right', 'up'].forEach((dir, row) => {
        for (let col = 0; col < 4; col++) texture.add(`${dir}_${col}`, 0, col * 96, row * 96, 96, 96);
      });
    }
    try {
      document.body.style.backgroundColor = '#14100c';
      document.body.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(20,16,12,0) 40%, rgba(8,6,4,0.82) 100%)';
      document.body.style.backgroundSize = '100% 100%';
    } catch {
      // ignore
    }
    const hint = document.getElementById('boot-hint');
    if (hint) hint.style.display = 'none';
    this.scene.start('MenuScene');
  }
}
