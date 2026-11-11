import Phaser from 'phaser';
import { COLORS, DEPTH, FONT, GAME_HEIGHT } from '../config';

/** 虚拟摇杆：固定底座 + 拖拽摇杆头，输出归一化向量（死区 8%）。 */
export class Joystick {
  readonly vector = new Phaser.Math.Vector2(0, 0);
  active = false;
  enabled = true;

  private readonly scene: Phaser.Scene;
  private readonly baseX = 96;
  private readonly baseY = GAME_HEIGHT - 132;
  private readonly maxRadius = 58;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private pointerId = -1;
  private hidden = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.base = scene.add
      .circle(this.baseX, this.baseY, this.maxRadius, 0x000000, 0.38)
      .setStrokeStyle(2, COLORS.gold, 0.75)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
    this.knob = scene.add
      .circle(this.baseX, this.baseY, 26, COLORS.gold, 0.62)
      .setStrokeStyle(2, 0xfff3d0, 0.95)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 2);
  }

  handleDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    if (this.active) return;
    if (pointer.x > this.scene.scale.width * 0.68) return;
    if (pointer.y < GAME_HEIGHT * 0.32) return;
    this.active = true;
    this.pointerId = pointer.id;
    this.apply(pointer);
  }

  handleMove(pointer: Phaser.Input.Pointer): void {
    if (!this.active || pointer.id !== this.pointerId) return;
    this.apply(pointer);
  }

  handleUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.reset();
  }

  /** 电脑模式：隐藏摇杆，改用键盘。 */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.base.setVisible(!hidden);
    this.knob.setVisible(!hidden);
    if (hidden) {
      this.enabled = false;
      this.reset();
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value && !this.hidden;
    this.base.setVisible(this.enabled);
    this.knob.setVisible(this.enabled);
    if (!this.enabled) this.reset();
  }

  reset(): void {
    this.active = false;
    this.pointerId = -1;
    this.vector.set(0, 0);
    this.knob.setPosition(this.baseX, this.baseY).setFillStyle(COLORS.gold, 0.45);
  }

  private apply(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.baseX;
    const dy = pointer.y - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      this.vector.set(0, 0);
      this.knob.setPosition(this.baseX, this.baseY);
      return;
    }
    const nx = dx / len;
    const ny = dy / len;
    const magnitude = Math.min(1, len / this.maxRadius);
    const dead = magnitude < 0.08 ? 0 : (magnitude - 0.08) / 0.92;
    this.vector.set(nx * dead, ny * dead);
    const knobDist = Math.min(len, this.maxRadius);
    this.knob.setPosition(this.baseX + nx * knobDist, this.baseY + ny * knobDist);
    this.knob.setFillStyle(COLORS.gold, 0.7);
  }
}
