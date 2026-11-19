import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';

/**
 * 人物画风开关（共享笔记 art-style-v2-spec.md）。
 * v1：现有 Q 版高清绘画图集；v2：「营火写实像素」——写实比例、真像素、深色描边、厚涂。
 * 选择顺序：URL ?art=v1|v2 → localStorage im_art_style → 默认 v2（用户认可新画风后改为默认；?art=v1 或设置「人物画风：旧版」切回）。
 * v2 只替换 ART_V2_FILES 里列出的图集，其余单位自动沿用 v1。
 */
export type ArtStyle = 'v1' | 'v2';
export const DEFAULT_ART_STYLE: ArtStyle = 'v2';
const STORE_KEY = 'im_art_style';

/** v2 图集：纹理键 → 文件（行走 4×4、动作 4×7，原生格 176 / 232，人物约 152 美术像素高，160 色）。 */
export const ART_V2_FILES: Readonly<Record<string, string>> = {
  hero_walk_sheet: 'assets/processed-v2/zhaoyun_walk_sheet.png',
  zhaoyun_actions: 'assets/hero-actions-v2/zhaoyun.png',
  guanyu_walk_sheet: 'assets/processed-v2/guanyu_walk_sheet.png',
  guanyu_actions: 'assets/hero-actions-v2/guanyu.png',
  zhangfei_walk_sheet: 'assets/processed-v2/zhangfei_walk_sheet.png',
  zhangfei_actions: 'assets/hero-actions-v2/zhangfei.png',
  machao_walk_sheet: 'assets/processed-v2/machao_walk_sheet.png',
  machao_actions: 'assets/hero-actions-v2/machao.png',
  huangzhong_walk_sheet: 'assets/processed-v2/huangzhong_walk_sheet.png',
  huangzhong_actions: 'assets/hero-actions-v2/huangzhong.png',
  zhuge_walk_sheet: 'assets/processed-v2/zhuge_walk_sheet.png',
  zhuge_actions: 'assets/hero-actions-v2/zhuge.png',
  weiyan_walk_sheet: 'assets/processed-v2/weiyan_walk_sheet.png',
  weiyan_actions: 'assets/hero-actions-v2/weiyan.png',
  liubei_walk_sheet: 'assets/processed-v2/liubei_walk_sheet.png',
  liubei_actions: 'assets/hero-actions-v2/liubei.png',
  pangtong_walk_sheet: 'assets/processed-v2/pangtong_walk_sheet.png',
  pangtong_actions: 'assets/hero-actions-v2/pangtong.png',
  huangyueying_walk_sheet: 'assets/processed-v2/huangyueying_walk_sheet.png',
  huangyueying_actions: 'assets/hero-actions-v2/huangyueying.png',
  diaochan_walk_sheet: 'assets/processed-v2/diaochan_walk_sheet.png',
  diaochan_actions: 'assets/hero-actions-v2/diaochan.png',
  // 孙尚香：新增可玩武将会话出图（分支 claude/new-heroes-46a60c 提交 24916eb，两边合并后文件才齐；缺文件时加载失败自动沿用 v1）
  sunshangxiang_walk_sheet: 'assets/processed-v2/sunshangxiang_walk_sheet.png',
  sunshangxiang_actions: 'assets/hero-actions-v2/sunshangxiang.png',
  // 第 2 批：我方兵种（4×4，见 V2_TROOP_KEYS / applyV2TroopFrames）
  shu_swordsman_walk_sheet: 'assets/processed-v2/troops/swordsman_walk.png',
  shu_swordsman_attack_sheet: 'assets/processed-v2/troops/swordsman_attack.png',
  shu_spearman_walk_sheet: 'assets/processed-v2/troops/spearman_walk.png',
  shu_spearman_attack_sheet: 'assets/processed-v2/troops/spearman_attack.png',
  shu_archer_walk_sheet: 'assets/processed-v2/troops/archer_walk.png',
  shu_archer_attack_sheet: 'assets/processed-v2/troops/archer_attack.png',
  legion_crossbowman_walk: 'assets/processed-v2/troops/crossbowman_walk.png',
  legion_crossbowman_action: 'assets/processed-v2/troops/crossbowman_attack.png',
  legion_guardian_walk: 'assets/processed-v2/troops/guardian_walk.png',
  legion_rider_walk: 'assets/processed-v2/troops/rider_walk.png',
  legion_halberdier_walk: 'assets/processed-v2/troops/halberdier_walk.png',
  legion_halberdier_action: 'assets/processed-v2/troops/halberdier_attack.png',
  legion_medic_walk: 'assets/processed-v2/troops/medic_walk.png',
  legion_medic_action: 'assets/processed-v2/troops/medic_attack.png',
  // 第 3 批（一）：黄巾章小兵 + 通用弓兵
  // 第六章荆南新兵：山越弓手、藤牌兵（行走 512 / 攻击 640，4×4）
  // 第八章汉中新兵：青州兵、魏军强弩手（同上规格）
  hanzhong_qingzhou_walk_sheet: 'assets/processed-v2/enemies/hanzhong_qingzhou_walk.png',
  yiling_jiefan_walk_sheet: 'assets/processed-v2/enemies/yiling_jiefan_walk.png',
  yiling_jiefan_attack_sheet: 'assets/processed-v2/enemies/yiling_jiefan_attack.png',
  hanzhong_qingzhou_attack_sheet: 'assets/processed-v2/enemies/hanzhong_qingzhou_attack.png',
  hanzhong_wei_crossbow_walk_sheet: 'assets/processed-v2/enemies/hanzhong_wei_crossbow_walk.png',
  hanzhong_wei_crossbow_attack_sheet: 'assets/processed-v2/enemies/hanzhong_wei_crossbow_attack.png',
  jingnan_shanyue_archer_walk_sheet: 'assets/processed-v2/enemies/jingnan_shanyue_archer_walk.png',
  jingnan_shanyue_archer_attack_sheet: 'assets/processed-v2/enemies/jingnan_shanyue_archer_attack.png',
  jingnan_rattan_shield_walk_sheet: 'assets/processed-v2/enemies/jingnan_rattan_shield_walk.png',
  jingnan_rattan_shield_attack_sheet: 'assets/processed-v2/enemies/jingnan_rattan_shield_attack.png',
  'yellow_swordsman-walk-v4': 'assets/processed-v2/enemies/yellow_swordsman_walk.png',
  'yellow_swordsman-attack-v4': 'assets/processed-v2/enemies/yellow_swordsman_attack.png',
  'yellow_shield-walk-v4': 'assets/processed-v2/enemies/yellow_shield_walk.png',
  'yellow_shield-attack-v4': 'assets/processed-v2/enemies/yellow_shield_attack.png',
  'yellow_spear-walk-v5': 'assets/processed-v2/enemies/yellow_spear_walk.png',
  'yellow_spear-attack-v5': 'assets/processed-v2/enemies/yellow_spear_attack.png',
  yellow_shaman_walk: 'assets/processed-v2/enemies/yellow_shaman_walk.png',
  yellow_shaman_cast: 'assets/processed-v2/enemies/yellow_shaman_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_lieshou_walk: 'assets/processed-v2/enemies/enemy_lieshou_walk.png',
  enemy_lieshou_attack: 'assets/processed-v2/enemies/enemy_lieshou_attack.png',
  enemy_dongzhou_walk: 'assets/processed-v2/enemies/enemy_dongzhou_walk.png',
  enemy_dongzhou_attack: 'assets/processed-v2/enemies/enemy_dongzhou_attack.png',
  enemy_funu_walk: 'assets/processed-v2/enemies/enemy_funu_walk.png',
  enemy_funu_attack: 'assets/processed-v2/enemies/enemy_funu_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_wuxi_walk: 'assets/processed-v2/enemies/enemy_wuxi_walk.png',
  enemy_wuxi_attack: 'assets/processed-v2/enemies/enemy_wuxi_attack.png',
  enemy_changsha_walk: 'assets/processed-v2/enemies/enemy_changsha_walk.png',
  enemy_changsha_attack: 'assets/processed-v2/enemies/enemy_changsha_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_feishi_walk: 'assets/processed-v2/enemies/enemy_feishi_walk.png',
  enemy_feishi_attack: 'assets/processed-v2/enemies/enemy_feishi_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_shuizu_walk: 'assets/processed-v2/enemies/enemy_shuizu_walk.png',
  enemy_shuizu_attack: 'assets/processed-v2/enemies/enemy_shuizu_attack.png',
  enemy_huochuan_walk: 'assets/processed-v2/enemies/enemy_huochuan_walk.png',
  enemy_huochuan_attack: 'assets/processed-v2/enemies/enemy_huochuan_attack.png',
  enemy_qiangzhen_walk: 'assets/processed-v2/enemies/enemy_qiangzhen_walk.png',
  enemy_qiangzhen_attack: 'assets/processed-v2/enemies/enemy_qiangzhen_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_daji_walk: 'assets/processed-v2/enemies/enemy_daji_walk.png',
  enemy_daji_attack: 'assets/processed-v2/enemies/enemy_daji_attack.png',
  enemy_xiandeng_walk: 'assets/processed-v2/enemies/enemy_xiandeng_walk.png',
  enemy_xiandeng_attack: 'assets/processed-v2/enemies/enemy_xiandeng_attack.png',
  enemy_yaliang_walk: 'assets/processed-v2/enemies/enemy_yaliang_walk.png',
  enemy_yaliang_attack: 'assets/processed-v2/enemies/enemy_yaliang_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_yexi_walk: 'assets/processed-v2/enemies/enemy_yexi_walk.png',
  enemy_yexi_attack: 'assets/processed-v2/enemies/enemy_yexi_attack.png',
  enemy_xianzhen_walk: 'assets/processed-v2/enemies/enemy_xianzhen_walk.png',
  enemy_xianzhen_attack: 'assets/processed-v2/enemies/enemy_xianzhen_attack.png',
  enemy_danyang_walk: 'assets/processed-v2/enemies/enemy_danyang_walk.png',
  enemy_danyang_attack: 'assets/processed-v2/enemies/enemy_danyang_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_mantoushi_walk: 'assets/processed-v2/enemies/enemy_mantoushi_walk.png',
  enemy_mantoushi_attack: 'assets/processed-v2/enemies/enemy_mantoushi_attack.png',
  enemy_dujian_walk: 'assets/processed-v2/enemies/enemy_dujian_walk.png',
  enemy_dujian_attack: 'assets/processed-v2/enemies/enemy_dujian_attack.png',
  enemy_xunshou_walk: 'assets/processed-v2/enemies/enemy_xunshou_walk.png',
  enemy_xunshou_attack: 'assets/processed-v2/enemies/enemy_xunshou_attack.png',
  enemy_beast_walk: 'assets/processed-v2/enemies/enemy_beast_walk.png',
  enemy_beast_attack: 'assets/processed-v2/enemies/enemy_beast_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_qianghu_walk: 'assets/processed-v2/enemies/enemy_qianghu_walk.png',
  enemy_qianghu_attack: 'assets/processed-v2/enemies/enemy_qianghu_attack.png',
  enemy_gunshi_walk: 'assets/processed-v2/enemies/enemy_gunshi_walk.png',
  enemy_gunshi_attack: 'assets/processed-v2/enemies/enemy_gunshi_attack.png',
  enemy_zonghuo_walk: 'assets/processed-v2/enemies/enemy_zonghuo_walk.png',
  enemy_zonghuo_attack: 'assets/processed-v2/enemies/enemy_zonghuo_attack.png',
  // 小怪兵种第一批（2026-11-19 Gemini 出图，原图 enemies/originals/artv2_enemy_*）：行走 4×4、攻击 4×4，行 = 下 / 左 / 右 / 上
  enemy_liumin_walk: 'assets/processed-v2/enemies/enemy_liumin_walk.png',
  enemy_liumin_attack: 'assets/processed-v2/enemies/enemy_liumin_attack.png',
  enemy_fushui_walk: 'assets/processed-v2/enemies/enemy_fushui_walk.png',
  enemy_fushui_attack: 'assets/processed-v2/enemies/enemy_fushui_attack.png',
  enemy_lishi_walk: 'assets/processed-v2/enemies/enemy_lishi_walk.png',
  enemy_lishi_attack: 'assets/processed-v2/enemies/enemy_lishi_attack.png',
  enemy_archer_walk_sheet: 'assets/processed-v2/enemies/enemy_archer_walk.png',
  enemy_archer_attack_sheet: 'assets/processed-v2/enemies/enemy_archer_attack.png',
  // 第 3 批（二）：通用敌军（黄巾装束，各章通用）+ 西凉军（第 2 章，只有行走图）
  enemy_infantry_walk_sheet: 'assets/processed-v2/enemies/enemy_infantry_walk.png',
  enemy_shield_walk_sheet: 'assets/processed-v2/enemies/enemy_shield_walk.png',
  enemy_officer_walk_sheet: 'assets/processed-v2/enemies/enemy_officer_walk.png',
  enemy_cavalry_run_sheet: 'assets/processed-v2/enemies/enemy_cavalry_walk.png',
  enemy_cavalry_charge_sheet: 'assets/processed-v2/enemies/enemy_cavalry_charge.png',
  xiliang_infantry_walk: 'assets/processed-v2/enemies/xiliang_infantry_walk.png',
  xiliang_shield_walk: 'assets/processed-v2/enemies/xiliang_shield_walk.png',
  xiliang_archer_walk: 'assets/processed-v2/enemies/xiliang_archer_walk.png',
  xiliang_cavalry_walk: 'assets/processed-v2/enemies/xiliang_cavalry_walk.png',
  xiliang_elite_walk: 'assets/processed-v2/enemies/xiliang_elite_walk.png',
  // 第 3 批（三）：飞熊军、虎豹骑（战斗开始时由 TroopArt 按需加载）
  feixiong_walk: 'assets/processed-v2/enemies/feixiong_walk.png',
  feixiong_attack: 'assets/processed-v2/enemies/feixiong_attack.png',
  hubao_walk: 'assets/processed-v2/enemies/hubao_walk.png',
  // 兵种小图标（营地「招兵营」页签等）：从 v2 胸像裁出的头肩像
  icon_shu_swordsman: 'assets/troop-portraits-v2/icon_swordsman.png',
  icon_shu_spearman: 'assets/troop-portraits-v2/icon_spearman.png',
  icon_shu_archer: 'assets/troop-portraits-v2/icon_archer.png',
  // 第 4 批：第 3~5 章首领（4×8 动作图集，每格 288；由 loadBossSheet 在章节场景 preload 里载入）
  third_lijue: 'assets/bosses-v2/third_lijue.png', third_guosi: 'assets/bosses-v2/third_guosi.png', // 郭汜（3-1 双首领第二批，Gemini 出图，步战）
  third_yuanshu: 'assets/bosses-v2/third_yuanshu.png',
  third_zhangxiu: 'assets/bosses-v2/third_zhangxiu.png',
  guandu_yanliang: 'assets/bosses-v2/guandu_yanliang.png',
  guandu_wenchou: 'assets/bosses-v2/guandu_wenchou.png',
  guandu_chunyuqiong: 'assets/bosses-v2/guandu_chunyuqiong.png',
  chibi_caimao: 'assets/bosses-v2/chibi_caimao.png',
  chibi_caochun: 'assets/bosses-v2/chibi_caochun.png',
  // 第 4 批（二）：第 1、2 章首领（保持各控制器原帧语义）
  zhangjiao_walk: 'assets/bosses-v2/zhangjiao_walk.png',
  zhangjiao_cast: 'assets/bosses-v2/zhangjiao_cast.png',
  yellow_zhangliang_walk: 'assets/bosses-v2/yellow_zhangliang_walk.png',
  yellow_zhangliang_attack: 'assets/bosses-v2/yellow_zhangliang_attack.png',
  yellow_zhangbao_walk: 'assets/bosses-v2/yellow_zhangbao_walk.png',
  yellow_zhangbao_cast: 'assets/bosses-v2/yellow_zhangbao_cast.png',
  chibi_caoren: 'assets/bosses-v2/chibi_caoren.png',
  // 第六章 平定荆南首领：v2 正式图（画风会话 c4460d9）；v1 无专属图，沿用 jingnanChapter.JINGNAN_SHEETS 的借用图
  jingnan_zhaofan: 'assets/bosses-v2/jingnan_zhaofan.png',
  jingnan_liudu: 'assets/bosses-v2/jingnan_liudu.png',
  jingnan_hanxuan: 'assets/bosses-v2/jingnan_hanxuan.png',
  jingnan_huangzhong: 'assets/bosses-v2/jingnan_huangzhong.png',
  // 第七章入蜀：首领与新兵种（只有 v2 版；场景 ShuGameScene 自己载入，键登记在这里是为了按 v2 规格缩放）
  shu_yanghuai: 'assets/bosses-v2/shu_yanghuai.png', shu_zhangren: 'assets/bosses-v2/shu_zhangren.png', shu_liuzhang: 'assets/bosses-v2/shu_liuzhang.png',
  shu_dongzhou_walk: 'assets/processed-v2/enemies/shu_dongzhou_walk.png', shu_nushou_walk: 'assets/processed-v2/enemies/shu_nushou_walk.png',
  // 第九章襄樊 / 第十一章南征（Gemini 出图；场景自己载入，这里登记是为了按 v2 规格缩放）
  xf_pangde: 'assets/bosses-v2/xf_pangde.png', xf_lvmeng: 'assets/bosses-v2/xf_lvmeng.png', nz_menghuo: 'assets/bosses-v2/nz_menghuo.png', nz_zhurong: 'assets/bosses-v2/nz_zhurong.png', nz_mangyachang: 'assets/bosses-v2/nz_mangyachang.png', nz_wutugu: 'assets/bosses-v2/nz_wutugu.png',
  nz_tengjia_walk: 'assets/processed-v2/enemies/nz_tengjia_walk.png', nz_elephant_walk: 'assets/processed-v2/enemies/nz_elephant_walk.png', nz_manbing_walk: 'assets/processed-v2/enemies/nz_manbing_walk.png',
  xf_baier_walk: 'assets/processed-v2/enemies/xf_baier_walk.png', xf_jiangdong_walk: 'assets/processed-v2/enemies/xf_jiangdong_walk.png',
  // 第八章 汉中之战首领：正式 v2 图到之前借用现有首领 v2 图过渡（hanzhongChapter.HANZHONG_SHEETS 同步改）
  hanzhong_zhanghe: 'assets/bosses-v2/hanzhong_zhanghe.png',
  hanzhong_xiahouyuan: 'assets/bosses-v2/hanzhong_xiahouyuan.png',
  hanzhong_caocao: 'assets/bosses-v2/hanzhong_caocao.png',
  // 第十章 夷陵之战首领：正式 v2 图到之前借用现有首领 v2 图过渡（yilingChapter.YILING_SHEETS 是 v1 回退）
  yiling_sunhuan: 'assets/bosses-v2/yiling_sunhuan.png', // 正式图（Gemini 出图）
  yiling_zhuran: 'assets/bosses-v2/yiling_zhuran.png', // 正式图（Gemini 出图）
  yiling_luxun: 'assets/bosses-v2/yiling_luxun.png', // 正式图（Gemini 出图，art-style ebfcb2b）
  // 第十二章 北伐首领：张郃 / 郝昭正式 v2 图到之前借用现有首领 v2 图过渡（beifaChapter.BEIFA_SHEETS 是 v1 回退）；司马懿已有正式 v2 图（Gemini 3.1 Pro 出图）
  beifa_zhanghe: 'assets/bosses-v2/hanzhong_zhanghe.png',
  beifa_haozhao: 'assets/bosses-v2/jingnan_liudu.png',
  beifa_simayi: 'assets/bosses-v2/beifa_simayi.png',
  // 3-2 典韦（友军守营）双铁戟行走 / 攻击图（ChatGPT 出图，首领 v2 标准：格 288、脚底 256，显示 ×0.5；朝左行由朝右逐格镜像）
  dianwei_walk: 'assets/allies-v2/dianwei_walk.png',
  dianwei_attack: 'assets/allies-v2/dianwei_attack.png',
  huaxiong_walk: 'assets/bosses-v2/huaxiong_walk.png',
  huaxiong_attack: 'assets/bosses-v2/huaxiong_attack.png',
  huaxiong_actions: 'assets/bosses-v2/huaxiong_actions.png',
  xurong: 'assets/bosses-v2/xurong.png',
  boss_lubu: 'assets/bosses-v2/lubu_walk.png',
  lubu_attack: 'assets/bosses-v2/lubu_attack.png',
  dongzhuo_walk: 'assets/bosses-v2/dongzhuo_walk.png',
  dongzhuo_attack: 'assets/bosses-v2/dongzhuo_attack.png',
  // 坐骑 v2 战马（HeroMount 按需载入；鞍辔画在马上，通用马按毛色乘色）
  horse_v2_chitu_walk: 'assets/horses-v2/chitu_walk.png',
  horse_v2_dilu_walk: 'assets/horses-v2/dilu_walk.png',
  horse_v2_wuzhui_walk: 'assets/horses-v2/wuzhui_walk.png',
  horse_v2_jueying_walk: 'assets/horses-v2/jueying_walk.png',
  horse_v2_dawan_walk: 'assets/horses-v2/dawan_walk.png',
  horse_v2_generic_walk: 'assets/horses-v2/generic_walk.png',
  // 敌军骑兵放走的暗橄榄褐战马（死亡特效 DeathFx 按需载入；即梦出图，tools/prepare-enemy-horse.mjs 处理；4×4 同 generic_walk）
  horse_v2_enemy_brown_walk: 'assets/horses-v2/enemy_brown_walk.png',
  // 敌军无骑手战马的惊跳 + 飞奔（4×3，每格 288，只有左向：行 0 = 惊跳 rear_0…3，行 1–2 = 飞奔 gallop_0…7；右向翻转用。DeathFx 按需载入，自己切帧，不走 regridV2）
  horse_v2_enemy_brown_gallop: 'assets/horses-v2/enemy_brown_gallop.png',
  horse_v2_mule_walk: 'assets/horses-v2/mule_walk.png',
  // 骑乘姿态图（只画人，4×8：骑行 + 马上出招；HeroMount 按需载入，没有的武将退回拼接）
  ride_v2_zhaoyun: 'assets/ride-v2/zhaoyun_ride.png',
  ride_v2_guanyu: 'assets/ride-v2/guanyu_ride.png',
  ride_v2_zhangfei: 'assets/ride-v2/zhangfei_ride.png',
  ride_v2_machao: 'assets/ride-v2/machao_ride.png',
  ride_v2_liubei: 'assets/ride-v2/liubei_ride.png',
  ride_v2_huangzhong: 'assets/ride-v2/huangzhong_ride.png',
  ride_v2_zhuge: 'assets/ride-v2/zhuge_ride.png',
  ride_v2_weiyan: 'assets/ride-v2/weiyan_ride.png',
  ride_v2_pangtong: 'assets/ride-v2/pangtong_ride.png',
  ride_v2_huangyueying: 'assets/ride-v2/huangyueying_ride.png',
  ride_v2_sunshangxiang: 'assets/ride-v2/sunshangxiang_ride.png',
  ride_v2_diaochan: 'assets/ride-v2/diaochan_ride.png',
};
/** v2 主将行走整格的显示高度（逻辑像素）：原生格 176 → 88，即 1080p 全屏（渲染 2 倍）下 1 美术像素 = 1 屏幕像素。
 * 人物约 76 逻辑像素高（用户要求比 v1 大一些）。 */
export const V2_WALK_DISPLAY = 88;
/** v2 行走格的脚底行（描边所在最低行，原生像素）与格高。 */
export const V2_WALK_FOOT = 168, V2_WALK_CELL = 176;
/** 行走帧纵向锚点：让脚底落在精灵中心下方 31 逻辑像素，与 v1 一致（阴影、选中光圈、碰撞位置都不用动）。 */
export const V2_WALK_ORIGIN_Y = (V2_WALK_FOOT + 1) / V2_WALK_CELL - 31 / V2_WALK_DISPLAY;
/** 「主将」标记离精灵中心的高度：v2 人物更高，标记跟着上移。 */
export const V2_MARKER_LIFT = 52;
/** v2 图集的采样：渲染倍率 ≥2 时像素 1:1 对屏幕，用最近邻保持清晰；低于 2 倍要缩小显示，用线性避免丢像素。 */
export function v2Filter(renderScale: number): Phaser.Textures.FilterMode {
  return renderScale >= 2 ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR;
}

let cached: ArtStyle | undefined;
export function artStyle(): ArtStyle {
  if (cached) return cached;
  let v: string | null = null;
  try { v = new URLSearchParams(window.location.search).get('art'); } catch { /* ignore */ }
  if (v === 'v1' || v === 'v2') { try { localStorage.setItem(STORE_KEY, v); } catch { /* ignore */ } }
  else try { v = localStorage.getItem(STORE_KEY); } catch { v = null; }
  cached = v === 'v1' || v === 'v2' ? v : DEFAULT_ART_STYLE;
  return cached;
}
/** 设置界面切换用：只写入偏好，刷新页面 / 重启游戏后生效（已加载的图集不变，避免 v1 图按 v2 规则缩放）。 */
export function setArtStyle(style: ArtStyle): void {
  try { localStorage.setItem(STORE_KEY, style); } catch { /* ignore */ }
}

/** 该纹理（或其 readable_ 派生）当前是否使用 v2 图集。 */
export function isV2Texture(key: string): boolean {
  // 派生贴图（readable_ 描边版、第四章袁军换色 yuan_、攻城 / 情报势力换色 f_<势力>_）沿用源图集的规格
  const k = key.replace(/^readable_/, '').replace(/^(yuan_|f_[a-z]+_)/, '');
  return artStyle() === 'v2' && Object.prototype.hasOwnProperty.call(ART_V2_FILES, k) && !V2_FAILED.has(k);
}

/** 把加载队列里有 v2 版本的图集换成 v2 文件（在 preload 末尾调用；键名不变，其余代码无感）。 */
/** 加载失败的 v2 图集（例如别的分支的图还没合进来）：退回 v1，isV2Texture 对它返回 false。 */
const V2_FAILED = new Set<string>();
export function applyArtStyleUrls(load: Phaser.Loader.LoaderPlugin): string[] {
  if (artStyle() !== 'v2') return [];
  const swapped: string[] = [], original = new Map<string, { url: string; type: string; config: unknown }>();
  const files = (load as unknown as { list: Phaser.Structs.Set<Phaser.Loader.File> }).list;
  for (const file of files.getArray()) {
    const url = ART_V2_FILES[file.key];
    if (url && (file.type === 'spritesheet' || file.type === 'image')) {
      original.set(file.key, { url: String(file.url), type: file.type, config: file.config && typeof file.config === 'object' ? { ...(file.config as object) } : file.config });
      file.url = url; swapped.push(file.key);
      // 按数字帧取用的首领表（华雄 / 徐荣 / 吕布）：v2 格子更大，切帧尺寸跟着换
      const cell = V2_SHEET_CELL[file.key];
      if (cell && file.type === 'spritesheet' && file.config) Object.assign(file.config as object, { frameWidth: cell, frameHeight: cell });
    }
  }
  if (original.size) load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    const o = original.get(file.key); if (!o || V2_FAILED.has(file.key)) return;
    V2_FAILED.add(file.key); console.warn('[ArtStyle] v2 图集缺失，退回 v1：' + file.key);
    if (o.type === 'image') load.image(file.key, o.url); else load.spritesheet(file.key, o.url, o.config as Phaser.Types.Loader.FileTypes.ImageFrameConfig);
  });
  return swapped;
}

/** BootScene 里按固定格子载入的首领表，v2 版的格边长（v1 华雄 / 徐荣 128、吕布 256）。 */
export const V2_SHEET_CELL: Record<string, number> = {
  huaxiong_walk: 288, huaxiong_attack: 288, huaxiong_actions: 288, xurong: 288, boss_lubu: 288, lubu_attack: 288,
};
/** v2 首领图集格边长：脚底 256 / 288 ≈ 旧版 114 / 128，首领控制器按 setDisplaySize(144) 显示，正好 1080p 下像素 1:1。 */
export const V2_BOSS_CELL = 288;
/** 章节首领图集（4×8，数字帧 0~31）：v2 时载 288 格新图，失败退回旧图；v1 照旧按 cell 载入。 */
export function loadBossSheet(load: Phaser.Loader.LoaderPlugin, key: string, url: string, cell = 128): void {
  if (!isV2Texture(key)) { load.spritesheet(key, url, {frameWidth: cell, frameHeight: cell}); return; }
  const onError = (file: Phaser.Loader.File): void => {
    if (file.key !== key) return;
    load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    V2_FAILED.add(key); console.warn('[ArtStyle] v2 首领图缺失，退回 v1：' + key);
    load.spritesheet(key, url, {frameWidth: cell, frameHeight: cell});
  };
  load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  load.once(`filecomplete-spritesheet-${key}`, () => { load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError); if (isV2Texture(key)) load.textureManager.get(key).setFilter(v2Filter(RENDER_SCALE)); });
  load.spritesheet(key, ART_V2_FILES[key], {frameWidth: V2_BOSS_CELL, frameHeight: V2_BOSS_CELL});
}

/**
 * v2 兵种图集（我方兵种 / 小兵）：统一 4×4，行 = 下 / 左 / 右 / 上；行走表列 = 步伐 0~3，攻击表列 = 蓄力 / 出手 / 最远 / 收回。
 * 格边长 = 图宽 / 4，脚底在格底往上 8 像素（与 tools/prepare-artv2.mjs 的 FOOT = CELL-8 一致）。
 */
export const V2_TROOP_KEYS: readonly string[] = [
  'shu_swordsman_walk_sheet', 'shu_swordsman_attack_sheet', 'shu_spearman_walk_sheet', 'shu_spearman_attack_sheet',
  'shu_archer_walk_sheet', 'shu_archer_attack_sheet', 'legion_crossbowman_walk', 'legion_crossbowman_action',
  'legion_guardian_walk', 'legion_rider_walk', 'legion_halberdier_walk', 'legion_halberdier_action',
  'legion_medic_walk', 'legion_medic_action',
  // 第 3 批：敌军小兵（黄巾章 + 通用弓兵），Enemy.applyFrame 里按 v2 规则定缩放与脚底
  'yellow_swordsman-walk-v4', 'yellow_swordsman-attack-v4', 'yellow_shield-walk-v4', 'yellow_shield-attack-v4',
  'yellow_spear-walk-v5', 'yellow_spear-attack-v5', 'yellow_shaman_walk', 'yellow_shaman_cast',
  'enemy_archer_walk_sheet', 'enemy_archer_attack_sheet',
  'enemy_infantry_walk_sheet', 'enemy_shield_walk_sheet', 'enemy_officer_walk_sheet', 'enemy_cavalry_run_sheet', 'enemy_cavalry_charge_sheet',
  'xiliang_infantry_walk', 'xiliang_shield_walk', 'xiliang_archer_walk', 'xiliang_cavalry_walk', 'xiliang_elite_walk',
  // 第 4 批（二）：第一章首领张梁 / 张宝 / 张角（走 Enemy 的 walkVisual 通路，4×4 方向表）
  'yellow_zhangliang_walk', 'yellow_zhangliang_attack', 'yellow_zhangbao_walk', 'yellow_zhangbao_cast', 'zhangjiao_walk', 'zhangjiao_cast',
  // 第六章荆南新兵（JingnanGameScene.preload 按需加载）
  'jingnan_shanyue_archer_walk_sheet', 'jingnan_shanyue_archer_attack_sheet', 'jingnan_rattan_shield_walk_sheet', 'jingnan_rattan_shield_attack_sheet',
  'hanzhong_qingzhou_walk_sheet', 'hanzhong_qingzhou_attack_sheet', 'hanzhong_wei_crossbow_walk_sheet', 'hanzhong_wei_crossbow_attack_sheet',
  // 第十章夷陵新兵（YilingGameScene.preload 按需加载；江东弓弩手图到了再加）
  'yiling_jiefan_walk_sheet', 'yiling_jiefan_attack_sheet',
];
/** 章节新兵：v2 时挂行走 / 攻击图集（4×4，行走格 128）并去掉换色；v1 保持换色过渡。图集由各章 GameScene.preload 用 loadV2TroopSheets 按需加载。 */
export function withV2Sheets<D extends { tint?: number }>(def: D, [walk, atk]: readonly [string, string]): D { return isV2Texture(walk) ? { ...def, tint: 0xffffff, walkVisual: { texture: walk, scale: .5, groundY: 121 / 128 }, attackVisual: atk } : def; }
export function loadV2TroopSheets(scene: Phaser.Scene, keys: readonly string[]): void { for (const key of keys) if (isV2Texture(key) && !scene.textures.exists(key)) { scene.load.once(`filecomplete-image-${key}`, () => regridV2(scene, key)); scene.load.image(key, ART_V2_FILES[key]); } }
/** v2 兵种显示倍率：原生像素 → 逻辑像素 0.5，即 1080p 全屏（渲染 2 倍）下像素 1:1。 */
export const V2_TROOP_SCALE = .5;
/** v2 兵种帧的脚底位置（占帧高的比例），用作纵向锚点。 */
export function v2TroopGround(frameHeight: number): number { return (frameHeight - 7) / frameHeight; }

/**
 * 按 v2 规格给兵种图集重切帧：down_0…up_3（行走 / 动作），并给旧攻击表的命名 atk_<方向>_0 / _1
 * 指到第 2、3 列（出手、最远），旧代码按 atk_ 取帧时也能用 v2 四帧攻击表。须在 registerWalkSheet / 各处旧切帧之后调用。
 */
export function applyV2TroopFrames(scene: Phaser.Scene): string[] {
  if (artStyle() !== 'v2') return [];
  return V2_TROOP_KEYS.filter(key => regridV2(scene, key));
}
/** 把一张 v2 4×4 图集按 宽/4 重切帧（down_0…up_3 + atk_ / chg_ 别名）并设采样；不是 v2 或尚未加载时返回 false。按需加载的图（TroopArt）也用它。 */
export function regridV2(scene: Phaser.Scene, key: string): boolean {
  if (!isV2Texture(key) || !scene.textures.exists(key)) return false;
  const t = scene.textures.get(key), w = (t.getSourceImage() as { width?: number }).width ?? 0, cell = w / 4;
  if (!cell) return false;
  for (const name of t.getFrameNames()) t.remove(name);
  ['down', 'left', 'right', 'up'].forEach((dir, row) => {
    for (let col = 0; col < 4; col++) t.add(`${dir}_${col}`, 0, col * cell, row * cell, cell, cell);
    for (let i = 0; i < 2; i++) t.add(`atk_${dir}_${i}`, 0, (i + 1) * cell, row * cell, cell, cell);
    // 骑兵冲锋表旧命名 chg_<方向>_0（预警）/ _1（冲锋）→ 第 1、3 列
    t.add(`chg_${dir}_0`, 0, 0, row * cell, cell, cell); t.add(`chg_${dir}_1`, 0, 2 * cell, row * cell, cell, cell);
  });
  // 旧切帧删掉后 firstFrame 仍指向已不存在的 "0"：不带帧名的 setTexture(key)（如 Enemy.spawn 用 def.texture）会取到 undefined 帧而崩溃
  t.firstFrame = 'down_0';
  if (/walk|run/.test(key)) rotateV2StandFrames(scene, key);
  t.setFilter(v2Filter(RENDER_SCALE));
  return true;
}

/**
 * v2 行走图的站立帧：ChatGPT 画的走路循环第 0 帧是迈步帧，停下时冻在它上面会「侧着站、两脚还分开」。
 * 全游戏停步都用 <方向>_0，这里按每个方向找脚底一带（脚底线往上 8% 格高）横向跨度最小的那一帧（双脚并拢），
 * 把该行的帧名循环平移，让它成为 _0；走路循环顺序不变。只用于行走 / 奔跑表，攻击表不动。
 */
export function rotateV2StandFrames(scene: Phaser.Scene, key: string): number[] {
  if (!isV2Texture(key) || !scene.textures.exists(key)) return [];
  const t = scene.textures.get(key), src = t.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width, h = src.height, cell = w / 4, foot = cell - 8, band = Math.max(4, Math.round(cell * .08));
  if (!cell || h < cell * 4) return [];
  // 帧宽按 宽/4，行数可以是 4（只有走路）或 5（第 5 行是站立图）
  let data: Uint8ClampedArray;
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(src, 0, 0); data = g.getImageData(0, 0, w, h).data;
  } catch { return []; }
  const span = (row: number, col: number): number => {
    let lo = Infinity, hi = -Infinity;
    for (let y = row * cell + foot - band; y <= row * cell + foot; y++) for (let x = col * cell; x < (col + 1) * cell; x++) if (data[(y * w + x) * 4 + 3] > 24) { if (x < lo) lo = x; if (x > hi) hi = x; }
    return hi >= lo ? hi - lo : Infinity;
  };
  const shifts: number[] = [];
  ['down', 'left', 'right', 'up'].forEach((dir, row) => {
    let best = 0, min = Infinity;
    for (let col = 0; col < 4; col++) { const s = span(row, col); if (s < min - 1) { min = s; best = col; } }
    shifts.push(best);
    for (let i = 0; i < 4; i++) { const name = `${dir}_${i}`; if (t.has(name)) t.remove(name); t.add(name, 0, ((i + best) % 4) * cell, row * cell, cell, cell); }
    // <方向>_stand：图集有第 5 行（专门画的站立图，列 = 下 / 左 / 右 / 上）就用它，否则用选出的最并拢帧
    const stand = `${dir}_stand`; if (t.has(stand)) t.remove(stand);
    if (h >= cell * 5) t.add(stand, 0, row * cell, 4 * cell, cell, cell); else t.add(stand, 0, best * cell, row * cell, cell, cell);
  });
  return shifts;
}
