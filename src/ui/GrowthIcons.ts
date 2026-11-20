import type {UpgradeOption} from '../types';
/** Shared by reward cards and the compact buff HUD. Existing approved art takes priority. */
export const GROWTH_ICON_IDS=['dragon_gallop','cloud_pierce','dragon_charge','dragging_blade','steady_aim','pearl_volley','wildfire','eight_trigrams','might','quickness','critical','constitution','agility','points','rejuvenation','berserk','tiger_tally','heart_mirror','wind_boots','hp','pickup','recovery','kaishan','gujun','fulei','lianying','huishen','baibi','nichang','meirenji','jingxin','laoji','wanrendi','dahe','jinma','tieqi','taoyuan','xiemin','chitu','huaji','xiandeng','weiming'] as const;
export function upgradeIcon(option:UpgradeOption):string|undefined {
 if(option.icon)return option.icon;
 if(option.kind==='martial'){const id=GROWTH_ICON_IDS.find(id=>option.id.startsWith('martial_'+id+'_'));if(id)return 'growth_icon_'+id;}
 if(option.kind==='attribute')return 'growth_icon_points';
 if(option.kind==='potion')return 'growth_icon_'+option.id.replace('potion_','');
 if(option.kind==='foundation')return 'growth_icon_'+option.id.replace('foundation_','');
 return undefined;
}
