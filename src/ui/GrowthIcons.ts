import type {UpgradeOption} from '../types';
/** Shared by reward cards and the compact buff HUD. Existing approved art takes priority. */
export const GROWTH_ICON_IDS=['dragon_gallop','cloud_pierce','dragon_charge','dragging_blade','steady_aim','pearl_volley','wildfire','eight_trigrams','might','quickness','critical','constitution','agility','points','rejuvenation','berserk','tiger_tally','heart_mirror','wind_boots','hp','pickup','recovery','kaishan','gujun','fulei','lianying','huishen','baibi','nichang','meirenji','jingxin','laoji','wanrendi','dahe','jinma','tieqi','taoyuan','xiemin','chitu','huaji','xiandeng','weiming','yaliang','lianchuan','shenshe','qichi','weicai','wangmei'] as const;
/** P3 第二批武艺：专属图标没出之前借现成的（甘宁铃响 → 疾风靴、铁索 → 连营）。 */
export const P3_MARTIAL_ICON: Record<string, string> = { lingxiang: 'wind_boots', tiesuo: 'lianying', tieji: 'pearl_volley', huwei: 'berserk', biyan: 'steady_aim', ziran: 'critical' };
export function upgradeIcon(option:UpgradeOption):string|undefined {
 if(option.icon)return option.icon;
 if(option.kind==='martial'){const p3=Object.keys(P3_MARTIAL_ICON).find(id=>option.id.startsWith('martial_'+id+'_'));if(p3)return 'growth_icon_'+P3_MARTIAL_ICON[p3];const id=GROWTH_ICON_IDS.find(id=>option.id.startsWith('martial_'+id+'_'));if(id)return 'growth_icon_'+id;}
 if(option.kind==='attribute')return 'growth_icon_points';
 if(option.kind==='potion')return 'growth_icon_'+option.id.replace('potion_','');
 if(option.kind==='foundation')return 'growth_icon_'+option.id.replace('foundation_','');
 return undefined;
}
