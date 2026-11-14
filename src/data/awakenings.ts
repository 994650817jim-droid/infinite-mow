import type {BuildTag} from './builds';
export const AWAKENINGS=[
 {id:'fire_gate',name:'八门火阵',tags:['control','flame'],icon:'build_icon_control_disk',desc:'攻击受控敌人生成火阵，持续1.5秒，每半秒20%伤害，最多5人，冷却6秒'},
 {id:'peerless',name:'无双追击',tags:['combo','critical'],icon:'build_icon_soul_bell',desc:'每4次本命命中且本次暴击，追击附近3人，造成40%伤害，冷却2秒'},
 {id:'roaming_break',name:'游龙破军',tags:['skirmish','charge'],icon:'build_icon_concentration',desc:'主动移动约4.5个身位并蓄满势后，下一次命中冲击周围最多5人，造成50%伤害，冷却4秒'},
 {id:'iron_army',name:'玄甲军阵',tags:['command','bulwark'],icon:'build_icon_army_seal',desc:'士兵受伤时为附近3人提供2秒25%保护，并震退附近3名普通敌人，冷却8秒'},
 {id:'pure_combo',name:'连击 · 追击扩散',tags:['combo'],icon:'build_icon_pursuit',desc:'每6次本命命中追击附近4人，35%伤害，冷却2秒'},
 {id:'pure_critical',name:'暴击 · 破甲崩击',tags:['critical'],icon:'build_icon_sunder',desc:'暴击产生崩击，最多4人、40%伤害，冷却3秒'},
 {id:'pure_skirmish',name:'游击 · 战意破阵',tags:['skirmish'],icon:'build_icon_horse_order',desc:'主动移动约5个身位后，下一击对周围最多4人追加40%伤害，冷却3秒'},
 {id:'pure_flame',name:'烈焰 · 烽火连城',tags:['flame'],icon:'build_icon_wildfire_lamp',desc:'被你点燃的敌人死亡时，点燃附近4人（弱火2秒）；传出去的火不会再传，冷却1秒'},
 {id:'pure_charge',name:'蓄势 · 贯阵',tags:['charge'],icon:'build_icon_stored_jade',desc:'满蓄势命中沿原方向追击最多5人，50%伤害，冷却3秒'},
 {id:'pure_control',name:'控场 · 阵法震荡',tags:['control'],icon:'build_icon_traction',desc:'命中受控敌人震荡附近4人，30%伤害，冷却2秒'},
 {id:'pure_command',name:'军令 · 进退有度',tags:['command'],icon:'build_icon_general_tally',desc:'护阵时每6秒治疗2名伤兵5%生命并护佑；出击时每6秒指挥士兵集火，友军攻击提高15%'},
 {id:'pure_bulwark',name:'铁壁 · 绝境不屈',tags:['bulwark'],icon:'build_icon_iron_mirror',desc:'每关首次致命伤害保留1生命并获得1秒无敌，随后震退附近普通敌人'},
] as const;
export function activeAwakenings(tags:Record<BuildTag,number>){return AWAKENINGS.filter(a=>a.tags.every(t=>tags[t]>=(a.tags.length===1?4:2)));}
export function awakeningProgress(tags:Record<BuildTag,number>):string{return activeAwakenings(tags).map(a=>a.name).join(' · ')||'集齐同系4来源，或指定双系各2来源觉醒';}
