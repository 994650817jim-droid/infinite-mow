/**
 * 武将圆形头像（头肩特写）——战斗左上主将状态框用（2026-11-19 用户「这个头像优化一下」：原来把水墨立轴整幅缩进圆里，人很小、脸看不清、底色灰白发糊）。
 * 源图：主页厚涂全身立绘 assets/epic-home/<id>.webp（高清）；每位武将单独设裁切（脸约占圆的一半、眼睛在上三分之一）。
 * 画法：画布高质量插值一次缩到 SIZE（同行囊 crispIcon 的做法），圆内先铺墨色晕染底，再画人物，外圈一道细暗描边。
 */
export const MEDAL_SIZE = 160;

/** 每位武将的裁切：cx / cy = 脸中心（占原图宽 / 高的比例），side = 裁切正方形边长（占原图高的比例）。 */
export const MEDAL_CROP: Record<string, { cx: number; cy: number; side: number }> = {
  zhaoyun: { cx: .5, cy: .14, side: .19 },
  guanyu: { cx: .5, cy: .14, side: .19 },
  huangzhong: { cx: .52, cy: .14, side: .19 },
  zhuge: { cx: .48, cy: .14, side: .19 },
  zhangfei: { cx: .5, cy: .145, side: .2 },
  machao: { cx: .5, cy: .14, side: .19 },
  weiyan: { cx: .5, cy: .145, side: .19 },
  liubei: { cx: .5, cy: .14, side: .19 },
  pangtong: { cx: .54, cy: .14, side: .19 },
  huangyueying: { cx: .5, cy: .15, side: .19 },
  sunshangxiang: { cx: .55, cy: .15, side: .19 },
  diaochan: { cx: .54, cy: .15, side: .19 },
  lvbu: { cx: .5, cy: .16, side: .2 },
  zhangliao: { cx: .46, cy: .16, side: .19 },
  zhouyu: { cx: .46, cy: .15, side: .19 },
  taishici: { cx: .45, cy: .15, side: .19 },
  mengde: { cx: .46, cy: .15, side: .19 },
  ganning: { cx: .5, cy: .42, side: .2 }, // 主页立绘没出前是像素头像放大（缺图清单）
  dianwei: { cx: .45, cy: .17, side: .2 }, // 主页立绘没出前用水墨立轴（缺图清单）
  sunquan: { cx: .5, cy: .14, side: .19 }, // 同上
  menghuo: { cx: .5, cy: .19, side: .2 }, // 同上
};
const DEFAULT_CROP = { cx: .5, cy: .14, side: .22 };

/** 把一张立绘画成圆形头像到画布（S×S）。眼睛约在上三分之一：裁切框中心比脸中心略低。 */
export function drawHeroMedal(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, id: string, S = MEDAL_SIZE): void {
  const c = MEDAL_CROP[id] ?? DEFAULT_CROP, side = c.side * img.height, sx = c.cx * img.width - side / 2, sy = c.cy * img.height - side * .4;
  ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
  // 墨色晕染底：中心略暖、四周深墨
  const bg = ctx.createRadialGradient(S * .5, S * .42, S * .05, S * .5, S * .5, S * .62);
  bg.addColorStop(0, '#4a3a28'); bg.addColorStop(.55, '#22180f'); bg.addColorStop(1, '#0b0705');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
  // 底部压一层暗，让肩以下收进墨色；外圈细暗描边
  const sh = ctx.createLinearGradient(0, S * .7, 0, S); sh.addColorStop(0, 'rgba(10,6,4,0)'); sh.addColorStop(1, 'rgba(10,6,4,.55)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, S, S);
  ctx.restore();
  ctx.lineWidth = S * .035; ctx.strokeStyle = 'rgba(20,12,6,.9)'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
}
