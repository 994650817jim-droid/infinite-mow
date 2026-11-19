/**
 * 场景审查 P3「底图去模板化」（用户 2026-11-18 同意）：第 3~12 章约 16 关共用两套底图——「暗地 + 土十字路」「沙地 + 石板十字路」，
 * 野战（汉水、猇亭、连营、街亭、五丈原……）也铺着城里的石板十字大道。这里按「章节.关」改：
 *  - ground：地面 v2 图（草地 ground_v2_grass / 荒土 ground_v2_dirt——美术会话为野战关出的图；河北平原 hebei / 江岸湿地 jiang / 关中黄土 / 长安夯土）；overlay：叠色（null = 不叠）。
 *  - road：路面 v2 图（土路 road_v2_dirt / 石板 road_v2_stone）；roads：路怎么铺——竖 v / 横 h / 十字 cross / 不铺 none（草地）。
 *    有河、山崖的关只留不会冲进江里、撞上崖壁的那一条（桥不在路上时竖路会直接冲进江里）。
 * 城池 / 关隘（长安、江陵、桂阳、长沙、阳平关、陈仓）保留石板官道。未列出的关照旧。
 */
export interface SceneLook { ground?: string; overlay?: string | null; road?: string; roads?: 'v' | 'h' | 'cross' | 'none' }

export const SCENE_LOOKS: Readonly<Record<string, SceneLook>> = {
  // 5-2 赤壁：江在北面、浮桥在两侧——只留横向江岸土路
  'chibi.2': { roads: 'h' },
  // 6-2 零陵武陵：南方湿林地；两侧山崖横在 y 0 一带，只留南北向山道
  'jingnan.2': { ground: 'ground_v2_jiang', overlay: 'rgba(20,34,18,.28)', roads: 'v' },
  // 8-2 定军山：草坡（白天，不再是夜色暗地），十字土路（北面山口正对竖路）
  'hanzhong.2': { ground: 'ground_v2_grass', overlay: 'rgba(40,32,20,.12)' },
  // 8-3 汉水：草地 + 沿江横向土路（原来石板十字）
  'hanzhong.3': { ground: 'ground_v2_grass', overlay: null, road: 'road_v2_dirt', roads: 'h' },
  // 10-1 猇亭：江边湿地连营，竖向土路穿过营寨辕门
  'yiling.1': { ground: 'ground_v2_jiang', overlay: null, road: 'road_v2_dirt', roads: 'v' },
  // 10-2 连营：林中湿地（夜色减淡）
  'yiling.2': { ground: 'ground_v2_jiang', overlay: 'rgba(8,18,32,.35)' },
  // 10-3 火烧连营：烧过的荒土 + 十字土路（原来石板十字）
  'yiling.3': { ground: 'ground_v2_dirt', overlay: 'rgba(30,20,12,.15)', road: 'road_v2_dirt', roads: 'cross' },
  // 12-1 街亭：草地，不铺路（南面南山，竖路会撞进山崖）
  'beifa.1': { ground: 'ground_v2_grass', overlay: null, roads: 'none' },
  // 12-3 五丈原：原上荒土（暮色），只留横向土路（渭水在南、桥在两侧）
  'beifa.3': { ground: 'ground_v2_dirt', overlay: 'rgba(16,20,34,.28)', roads: 'h' },
};

/**
 * 各关敌方势力（营帐 / 军旗 / 营栅 / 望楼用哪套营具：PropsV2.FACTION_PROPS）。配色（审查报告建议，统筹 11-18 定）：西凉红黑、袁黄蓝、曹藏青配金（不改红黑，免得和西凉撞色）、吴紫、蜀绿、蛮族棕。
 * 1 董卓西凉 · 2 袁绍河北 · 3 曹军 · 4 东吴 · 5 蜀（刘璋益州）· 6 南蛮。4~6 的营具图由美术风格会话出；没到之前退回旧营具图（sishui_props）。
 * 原来第三章起的篇章场景一律用西凉营具（李傕、荆南、曹军各关都是红黑帐篷）。
 */
export const ARC_FACTIONS: Readonly<Record<string, number>> = {
  'qunxiong.1': 1, 'qunxiong.2': 1, 'qunxiong.3': 2, // 李傕、张绣（西凉系）；袁术（袁氏）
  'chibi.1': 3, 'chibi.2': 3, 'chibi.3': 3,
  'shu.1': 5, 'shu.2': 5, 'shu.3': 5, // 刘璋益州军
  'hanzhong.1': 3, 'hanzhong.2': 3, 'hanzhong.3': 3,
  'xiangfan.1': 3, 'xiangfan.2': 3, 'xiangfan.3': 4, // 麦城：吴军合围
  'yiling.1': 4, 'yiling.2': 4, 'yiling.3': 4,
  'nanzheng.1': 6, 'nanzheng.2': 6, 'nanzheng.3': 6,
  'beifa.1': 3, 'beifa.2': 3, 'beifa.3': 3, // 魏军
};
