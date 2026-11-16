import Phaser from 'phaser';

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function addOutline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 40) continue;
      let edge = false;
      if (x > 0 && src[i - 4 + 3] > 60) edge = true;
      if (!edge && x < w - 1 && src[i + 4 + 3] > 60) edge = true;
      if (!edge && y > 0 && src[i - w * 4 + 3] > 60) edge = true;
      if (!edge && y < h - 1 && src[i + w * 4 + 3] > 60) edge = true;
      if (edge) {
        out[i] = 22;
        out[i + 1] = 16;
        out[i + 2] = 12;
        out[i + 3] = 255;
      }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, paint: Painter, outline = false): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  paint(ctx, w, h);
  if (outline) addOutline(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawZhaoyun(ctx: CanvasRenderingContext2D): void {
  // 长枪（斜向）
  line(ctx, 21, 2, 5, 24, 2, '#8b5a2b');
  rect(ctx, 20, 1, 3, 4, '#e8c76a');
  // 披风
  rect(ctx, 7, 12, 14, 11, '#e9e4d8', 0.9);
  // 身体银甲
  rect(ctx, 9, 11, 10, 8, '#b9c2cc');
  rect(ctx, 9, 11, 10, 2, '#dde5ee');
  rect(ctx, 10, 15, 8, 1, '#e8c76a');
  // 头盔
  rect(ctx, 9, 4, 10, 5, '#c9d2dc');
  rect(ctx, 12, 2, 4, 3, '#d24b3f');
  // 脸
  rect(ctx, 11, 9, 6, 3, '#e8b98a');
  // 腿
  rect(ctx, 10, 19, 3, 4, '#4a4038');
  rect(ctx, 15, 19, 3, 4, '#4a4038');
  // 护肩
  rect(ctx, 7, 11, 3, 3, '#9aa4b0');
  rect(ctx, 18, 11, 3, 3, '#9aa4b0');
}

function drawTurbanSoldier(ctx: CanvasRenderingContext2D, opts: { shield?: boolean; bow?: boolean; big?: boolean }): void {
  const body = '#7a5a34';
  const cloth = '#c8a24a';
  // 身体
  rect(ctx, 9, 11, 10, 9, body);
  rect(ctx, 9, 11, 10, 2, '#8d6a3f');
  // 黄巾
  rect(ctx, 9, 5, 10, 4, cloth);
  rect(ctx, 8, 8, 3, 5, cloth, 0.9);
  // 脸
  rect(ctx, 11, 9, 6, 3, '#d9a678');
  // 腿
  rect(ctx, 10, 20, 3, 4, '#4a4038');
  rect(ctx, 15, 20, 3, 4, '#4a4038');
  // 武器
  if (opts.bow) {
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(21, 14, 6, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    line(ctx, 21, 8, 21, 20, 1, '#d8cbb8');
  } else {
    line(ctx, 20, 10, 24, 20, 2, '#b9c2cc');
  }
  if (opts.shield) {
    circle(ctx, 6, 16, 5, '#6b4a2a');
    circle(ctx, 6, 16, 3, '#8a6338');
    rect(ctx, 5, 15, 2, 2, '#e8c76a');
  }
  if (opts.big) {
    rect(ctx, 8, 4, 12, 5, '#e8c76a');
    rect(ctx, 9, 10, 2, 2, '#d24b3f');
  }
}

function drawCavalry(ctx: CanvasRenderingContext2D): void {
  // 马
  rect(ctx, 4, 14, 20, 8, '#5a3f28');
  rect(ctx, 20, 11, 7, 6, '#6b4a2e');
  rect(ctx, 6, 22, 3, 6, '#4a3524');
  rect(ctx, 19, 22, 3, 6, '#4a3524');
  rect(ctx, 24, 13, 2, 2, '#2c1f14');
  // 骑手
  rect(ctx, 10, 6, 8, 8, '#7a5a34');
  rect(ctx, 10, 3, 8, 3, '#c8a24a');
  rect(ctx, 12, 8, 4, 2, '#d9a678');
  line(ctx, 18, 7, 24, 14, 2, '#b9c2cc');
}

function drawZhangjiao(ctx: CanvasRenderingContext2D): void {
  // 法杖
  line(ctx, 6, 8, 46, 52, 3, '#6b4a2a');
  circle(ctx, 6, 8, 4, '#4fd1a5', 0.95);
  // 黄袍
  rect(ctx, 18, 20, 20, 26, '#d9b23c');
  rect(ctx, 18, 20, 20, 3, '#f0d47a');
  rect(ctx, 22, 30, 12, 10, '#b8912a');
  // 头
  rect(ctx, 23, 12, 10, 8, '#e0b183');
  // 道冠
  rect(ctx, 21, 6, 14, 6, '#3d3226');
  rect(ctx, 24, 2, 8, 4, '#3d3226');
  // 胡须
  rect(ctx, 24, 19, 8, 3, '#e9e4d8');
  // 符纸
  rect(ctx, 41, 18, 6, 8, '#f0e3c0');
  rect(ctx, 42, 20, 4, 1, '#d24b3f');
  rect(ctx, 42, 22, 4, 1, '#d24b3f');
  // 光晕
  circle(ctx, 28, 34, 22, '#e8c76a', 0.08);
}

/** 正式素材到位后：384x384、4x4、每格 96x96，行顺序 下/左/右/上。 */
export function registerWalkSheet(scene: Phaser.Scene): void {
  const dirs = ['down', 'left', 'right', 'up'];
  for (const sheetKey of ['hero_walk_sheet', 'guanyu_walk_sheet', 'huangzhong_walk_sheet', 'zhangfei_walk_sheet', 'huangyueying_walk_sheet', 'sunshangxiang_walk_sheet', 'diaochan_walk_sheet', 'pangtong_walk_sheet', 'liubei_walk_sheet', 'weiyan_walk_sheet', 'machao_walk_sheet', 'enemy_infantry_walk_sheet', 'enemy_shield_walk_sheet', 'enemy_archer_walk_sheet', 'enemy_cavalry_run_sheet', 'enemy_officer_walk_sheet', 'shu_swordsman_walk_sheet', 'shu_archer_walk_sheet', 'shu_spearman_walk_sheet', 'zhuge_walk_sheet']) {
    if (!scene.textures.exists(sheetKey)) continue;
    const texture = scene.textures.get(sheetKey);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        texture.add(`${dirs[row]}_${col}`, 0, col * 96, row * 96, 96, 96);
      }
    }
  }
  // 骑兵冲锋表：4 行（方向）x 2 列（预警/冲锋）
  if (scene.textures.exists('enemy_cavalry_charge_sheet')) {
    const texture = scene.textures.get('enemy_cavalry_charge_sheet');
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        texture.add(`chg_${dirs[row]}_${col}`, 0, col * 96, row * 96, 96, 96);
      }
    }
  }
  // 蜀国枪兵攻击表：4 行（方向）x 2 列（蓄力/前刺）
  if (scene.textures.exists('shu_spearman_attack_sheet')) {
    const texture = scene.textures.get('shu_spearman_attack_sheet');
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        texture.add(`atk_${dirs[row]}_${col}`, 0, col * 96, row * 96, 96, 96);
      }
    }
  }
  // 蜀国弓兵攻击表：4 行（方向）x 2 列（拉弓/放箭）
  if (scene.textures.exists('shu_archer_attack_sheet')) {
    const texture = scene.textures.get('shu_archer_attack_sheet');
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        texture.add(`atk_${dirs[row]}_${col}`, 0, col * 96, row * 96, 96, 96);
      }
    }
  }
  // 蜀国刀兵攻击表：4 行（方向）x 2 列（蓄力/横砍）
  if (scene.textures.exists('shu_swordsman_attack_sheet')) {
    const texture = scene.textures.get('shu_swordsman_attack_sheet');
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        texture.add(`atk_${dirs[row]}_${col}`, 0, col * 96, row * 96, 96, 96);
      }
    }
  }
  // 弓兵攻击表：4 行（方向）x 2 列（拉弓/放箭）
  if (scene.textures.exists('enemy_archer_attack_sheet')) {
    const texture = scene.textures.get('enemy_archer_attack_sheet');
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        texture.add(`atk_${dirs[row]}_${col}`, 0, col * 96, row * 96, 96, 96);
      }
    }
  }
}

/** 正式行走图未到位前，用赵云立绘生成四方向 + 4 帧的临时步态。 */
export function createWalkPlaceholders(scene: Phaser.Scene): void {
  if (!scene.textures.exists('hero_zhaoyun')) return;
  if (scene.textures.exists('hero_walk_sheet')) return;
  if (scene.textures.exists('hero_walk_down_0')) return;
  const source = scene.textures.get('hero_zhaoyun').getSourceImage() as HTMLCanvasElement;
  const dirs: Array<'down' | 'left' | 'right' | 'up'> = ['down', 'left', 'right', 'up'];
  const bobs = [0, -3, 0, -3];
  for (const dir of dirs) {
    for (let frame = 0; frame < 4; frame += 1) {
      makeTexture(scene, `hero_walk_${dir}_${frame}`, 96, 96, (ctx) => {
        ctx.save();
        if (dir === 'left') {
          ctx.translate(96, 0);
          ctx.scale(-1, 1);
        }
        const bob = bobs[frame];
        // 放大到 112 后按脚底对齐，保证和静态立绘大小接近
        ctx.drawImage(source, -8, -16 + bob, 112, 112);
        ctx.restore();
      });
    }
  }
}

function drawLubu(ctx: CanvasRenderingContext2D): void {
  // 吕布程序化占位：双雉翎、赤披风、黑金甲与方天戟。
  ctx.fillStyle = '#8c2429'; ctx.beginPath(); ctx.moveTo(19, 29); ctx.lineTo(46, 29); ctx.lineTo(51, 58); ctx.lineTo(12, 58); ctx.closePath(); ctx.fill();
  line(ctx, 49, 5, 49, 62, 3, '#9a7444');
  line(ctx, 49, 8, 49, 22, 4, '#f1d68f');
  ctx.strokeStyle = '#d9e0d6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(49, 14, 9, -.5, 1.5); ctx.stroke();
  rect(ctx, 46, 2, 6, 9, '#e7e5cc');
  rect(ctx, 21, 28, 22, 23, '#37313a'); rect(ctx, 22, 29, 20, 5, '#b69955');
  rect(ctx, 17, 29, 9, 10, '#645b54'); rect(ctx, 39, 29, 8, 10, '#645b54');
  rect(ctx, 25, 35, 14, 12, '#7c3035'); rect(ctx, 30, 34, 4, 15, '#e0bd69');
  rect(ctx, 21, 47, 22, 4, '#d0a85e'); rect(ctx, 23, 51, 7, 11, '#292b31'); rect(ctx, 35, 51, 7, 11, '#292b31');
  rect(ctx, 22, 59, 10, 4, '#bda870'); rect(ctx, 34, 59, 10, 4, '#bda870');
  rect(ctx, 23, 15, 19, 12, '#56505a'); rect(ctx, 26, 23, 13, 8, '#d4ab82');
  rect(ctx, 22, 17, 21, 4, '#d4b66b'); rect(ctx, 29, 12, 7, 7, '#c1a563');
  rect(ctx, 28, 25, 3, 2, '#281e1d'); rect(ctx, 35, 25, 3, 2, '#281e1d');
  line(ctx, 29, 15, 18, 3, 4, '#b02c3b'); line(ctx, 36, 15, 45, 2, 4, '#b02c3b');
}

export function createGameTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'boss_lubu', 64, 64, drawLubu, true);
  makeTexture(scene, 'ground_hulao', 128, 128, (ctx) => {
    rect(ctx, 0, 0, 128, 128, '#29272c');
    for (let row = 0; row < 4; row++) {
      const offset = row % 2 ? -32 : 0;
      for (let x = offset; x < 128; x += 64) {
        rect(ctx, x + 1, row * 32 + 1, 62, 30, row % 2 ? '#423c3d' : '#393638');
        rect(ctx, x + 4, row * 32 + 3, 53, 2, '#4d4646');
        rect(ctx, x + 17, row * 32 + 19, 7, 2, '#63473c', .5);
      }
    }
  });
  // 地面 128×128（四方连续：噪点块 + 草簇 + 土色斑）
  makeTexture(scene, 'ground', 128, 128, (ctx) => {
    rect(ctx, 0, 0, 128, 128, '#4a3c2a');
    const shades = ['#514330', '#463a28', '#584936', '#403424'];
    for (let y = 0; y < 128; y += 8) {
      for (let x = 0; x < 128; x += 8) {
        if (Math.random() < 0.42) rect(ctx, x, y, 8, 8, shades[Math.floor(Math.random() * shades.length)]);
      }
    }
    for (let i = 0; i < 26; i += 1) {
      const x = Math.floor(Math.random() * 124);
      const y = Math.floor(Math.random() * 124);
      rect(ctx, x, y, 2, 4, '#4a5a2a', 0.6);
      rect(ctx, x + 1, y + 2, 2, 3, '#55682f', 0.5);
    }
    for (let i = 0; i < 10; i += 1) {
      const x = Math.floor(Math.random() * 120);
      const y = Math.floor(Math.random() * 120);
      rect(ctx, x, y, 6, 2, '#241c12', 0.5);
    }
  });

  makeTexture(scene, 'hero_zhaoyun', 28, 28, drawZhaoyun, true);
  makeTexture(scene, 'enemy_infantry', 26, 26, (ctx) => drawTurbanSoldier(ctx, {}), true);
  makeTexture(scene, 'enemy_shield', 30, 28, (ctx) => {
    ctx.translate(2, 2);
    drawTurbanSoldier(ctx, { shield: true, big: true });
  }, true);
  makeTexture(scene, 'enemy_archer', 26, 26, (ctx) => drawTurbanSoldier(ctx, { bow: true }), true);
  makeTexture(scene, 'enemy_cavalry', 34, 30, drawCavalry);
  makeTexture(scene, 'enemy_elite', 34, 32, (ctx) => {
    ctx.translate(2, 3);
    drawTurbanSoldier(ctx, { big: true });
  }, true);
  makeTexture(scene, 'boss_zhangjiao', 56, 60, drawZhangjiao, true);

  makeTexture(scene, 'gem_small', 10, 10, (ctx) => {
    rect(ctx, 3, 1, 4, 8, '#3fd6a0');
    rect(ctx, 2, 3, 6, 4, '#5ff0bd');
    rect(ctx, 4, 2, 2, 2, '#c9ffe9');
  });
  makeTexture(scene, 'gem_large', 14, 14, (ctx) => {
    rect(ctx, 4, 1, 6, 12, '#e8c76a');
    rect(ctx, 3, 3, 8, 8, '#f5dd93');
    rect(ctx, 5, 2, 3, 3, '#fff6d6');
  });

  makeTexture(scene, 'bolt', 18, 6, (ctx) => {
    rect(ctx, 0, 2, 12, 2, '#8b5a2b');
    rect(ctx, 12, 1, 4, 4, '#c9d2dc');
    rect(ctx, 15, 2, 3, 2, '#e8eef5');
    rect(ctx, 0, 2, 4, 2, '#d24b3f');
  });
  // 敌方箭矢：亮木杆 + 银箭头 + 亮黄尾羽 + 尾光，远看也能辨认
  makeTexture(scene, 'arrow', 32, 10, (ctx) => {
    rect(ctx, 0, 4, 22, 2, '#d9b23c');
    rect(ctx, 0, 3, 22, 1, '#f0d47a');
    rect(ctx, 22, 2, 7, 6, '#f5f5f5');
    rect(ctx, 27, 3, 4, 4, '#ffffff');
    rect(ctx, 2, 2, 6, 2, '#ffd166');
    rect(ctx, 2, 6, 6, 2, '#ffd166');
    rect(ctx, 0, 4, 3, 2, 'rgba(255,209,102,0.55)');
  });

  // 烈焰战旗的旗子：旗杆 + 金顶 + 红底金边燕尾旗 + 金色纹样
  makeTexture(scene, 'war_flag', 96, 128, (ctx) => {
    ctx.fillStyle = '#4a2c12';
    ctx.fillRect(18, 14, 6, 112);
    ctx.fillStyle = '#e8c76a';
    ctx.beginPath();
    ctx.arc(21, 11, 6, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(26, 0, 92, 0);
    g.addColorStop(0, '#8a1f18');
    g.addColorStop(0.5, '#d23b2a');
    g.addColorStop(1, '#a8261c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(24, 22);
    ctx.lineTo(90, 18);
    ctx.lineTo(90, 78);
    ctx.lineTo(76, 88);
    ctx.lineTo(62, 80);
    ctx.lineTo(24, 88);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f0c04a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,192,74,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(56, 52, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f0c04a';
    ctx.beginPath();
    ctx.moveTo(56, 40); ctx.lineTo(64, 52); ctx.lineTo(56, 64); ctx.lineTo(48, 52); ctx.closePath();
    ctx.fill();
    // 旗尾飘带
    ctx.strokeStyle = '#d23b2a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(76, 88);
    ctx.quadraticCurveTo(84, 102, 68, 116);
    ctx.stroke();
  });

  // 张角法球：紫金能量球
  makeTexture(scene, 'orb', 20, 20, (ctx) => {
    const g = ctx.createRadialGradient(10, 10, 1, 10, 10, 10);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(220,150,255,1)');
    g.addColorStop(0.75, 'rgba(120,40,200,0.95)');
    g.addColorStop(1, 'rgba(60,20,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(10, 10, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  // 枪影旋舞：竖直长枪（银枪头 + 木杆 + 红缨），旋转时不再像斧头
  makeTexture(scene, 'blade', 24, 40, (ctx) => {
    // 木杆
    rect(ctx, 10, 10, 4, 28, '#8b5a2b');
    rect(ctx, 11, 10, 1, 28, '#b07a42');
    // 红缨
    rect(ctx, 7, 9, 10, 4, '#c0392b');
    rect(ctx, 5, 12, 4, 5, '#e74c3c');
    rect(ctx, 15, 12, 4, 5, '#e74c3c');
    // 银枪头
    rect(ctx, 9, 1, 6, 8, '#dde5ee');
    rect(ctx, 10, 0, 4, 4, '#ffffff');
    rect(ctx, 11, 8, 2, 2, '#b9c2cc');
  });

  makeTexture(scene, 'flame', 44, 44, (ctx) => {
    const g = ctx.createRadialGradient(22, 22, 2, 22, 22, 22);
    g.addColorStop(0, 'rgba(255,240,190,0.95)');
    g.addColorStop(0.35, 'rgba(255,150,60,0.8)');
    g.addColorStop(0.7, 'rgba(210,60,40,0.35)');
    g.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(22, 22, 22, 0, Math.PI * 2);
    ctx.fill();
  });

  makeTexture(scene, 'spark', 8, 8, (ctx) => {
    circle(ctx, 4, 4, 3.5, '#ffe9b0', 0.9);
    circle(ctx, 4, 4, 2, '#ffffff', 1);
  });

  // 椭圆软阴影：64x32，中心深、边缘透明，避免方形裁切
  makeTexture(scene, 'shadow', 64, 32, (ctx) => {
    ctx.save();
    ctx.translate(32, 16);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  makeTexture(scene, 'icon_passive', 64, 64, (ctx) => {
    circle(ctx, 32, 32, 26, '#2a2118', 1);
    circle(ctx, 32, 32, 24, '#e8c76a', 0.25);
    ctx.strokeStyle = '#e8c76a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(50, 32);
    ctx.lineTo(32, 54);
    ctx.lineTo(14, 32);
    ctx.closePath();
    ctx.stroke();
    circle(ctx, 32, 32, 6, '#4fd1a5', 1);
  });

  makeTexture(scene, 'icon_rare', 64, 64, (ctx) => {
    circle(ctx, 32, 32, 26, '#2a2118', 1);
    circle(ctx, 32, 32, 24, '#ff8a65', 0.3);
    ctx.strokeStyle = '#ff8a65';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 44);
    ctx.lineTo(16, 22);
    ctx.lineTo(26, 32);
    ctx.lineTo(32, 18);
    ctx.lineTo(38, 32);
    ctx.lineTo(48, 22);
    ctx.lineTo(48, 44);
    ctx.closePath();
    ctx.stroke();
  });

  makeTexture(scene, 'vignette', 540, 960, (ctx) => {
    const g = ctx.createRadialGradient(270, 480, 180, 270, 480, 560);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 540, 960);
  });
}
