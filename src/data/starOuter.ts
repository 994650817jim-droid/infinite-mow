/** Initial outer-ring parameters. No permanent-stat multipliers are reapplied on load. */
export const STAR_OUTER_TUNING={
 hitGap:100,surgeCd:6000,surgeLength:180,surgeWidth:70,surgeTargets:5,surgeRatio:.55,fixedRatio:.2,
 deathCd:1500,deathRadius:65,deathTargets:3,deathRatio:.15,
 travel:280,smallTravel:200,decay:60,echoRatio:.6,smallEchoRatio:.2,stopRatio:.15,echoCd:3000,echoDelay:150,echoLeash:220,stopWindow:1500,
 markMs:3000,markTargets:3,chainTargets:2,chainRadius:180,chainRatio:.3,smallChainRatio:.1,chainCd:1200,spellCost:.9,
 slowCd:1000,slowMs:500,slowFactor:.8,
 volleyTargets:3,volleyCd:6000,volleyNear:220,volleyWindow:1000,volleyReady:.12,shieldRatio:.08,shieldMs:1500,commandCost:.9,
} as const;
export const STAR_OUTER_NAMES={
 strength:['定锋','余威','摧锋破阵'],agility:['移步','回身','逐影追锋'],intellect:['牵印','滞行','连环奇谋'],command:['接战','援护','三军接战'],
} as const;
export const STAR_OUTER_DESCS={
 strength:['持续命中同一目标，每第3次追加20%追击；换目标损失一半计数。','本命击杀向65px内最多3敌溅射15%伤害；冷却1.5秒。','同一目标命中6次后，下一击向其身后180px×70px冲击，最多5敌受到55%伤害。换目标损失一半计数；冷却6秒。'],
 agility:['主动移动200px后，下一次本命命中追加20%追击；停下每秒流失60px，冷却3秒。','停步后1.5秒内本命命中追加15%追击；与移步、逐影取较强一次，共享3秒冷却。','主动移动280px后，下一次本命命中追加60%追击。停下每秒流失60px，冷却3秒；追击不递归。'],
 intellect:['本命法术留下至多2枚印记，持续3秒；后续命中向180px内另一印记传导10%伤害，冷却1.2秒。','本命法术命中使普通敌人减速20%，持续0.5秒；冷却1秒，Boss免疫。','本命法术留下至多3枚印记，后续命中向180px内最多2枚印记各传导30%伤害。印记3秒，冷却1.2秒；本命法术伤害降低10%。'],
 command:['本命命中后，附近1名符合射程与安全条件的士兵提前准备协同攻击；冷却6秒，不打断撤退或军令。','本命命中后，为附近1名能攻击目标的士兵提供8%最大生命护盾，持续1.5秒；不叠加，冷却6秒。','本命命中后，附近最多3名符合射程与安全条件的士兵提前准备协同攻击；冷却6秒，不强制移动。主将本命伤害降低10%。'],
} as const;


/** Derived from the equipped pair; never another slot, reward, or saved level. */
export const STAR_COMBOS = {
 'combo.dragon': {name:'游龙摧阵',keys:['strength.K2','agility.K2'],cd:3000,description:'摧锋破阵＋逐影追锋。移动追击实际命中同一目标，额外积累1次破阵（最多6次）；下一次本命命中再放冲击波。冷却3秒，不递归。'},
 'combo.tactics': {name:'军师授策',keys:['intellect.K2','command.K2'],cd:3000,description:'连环奇谋＋三军接战。协同士兵命中印记敌人，向180px内另外最多2枚印记各传导30%印记基础法术伤害。每轮协同仅1次，冷却3秒，奇谋冷却时短暂待传，命令2.5秒内有效。'},
} as const;
export type StarComboId=keyof typeof STAR_COMBOS;
export const activeStarCombos=(has:(id:string)=>boolean):StarComboId[] => (Object.keys(STAR_COMBOS) as StarComboId[]).filter(id=>STAR_COMBOS[id].keys.every(has));
export interface StarOuterRow {id:string;label:string;text:string;progress:number;ready:boolean;}
export interface StarOuterView {rows:StarOuterRow[];combos:StarComboId[];notice:string;}
export const STAR_COMBO_ORDER_MS=2500;
