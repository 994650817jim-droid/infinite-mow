import type { CharacterId } from './characters';
export type ComboKind = 'spearSlash' | 'markedVolley' | 'firePath' | 'arrowCircle' | 'burnSweep' | 'fireVolley';
export const COMBOS: Array<{ ids: CharacterId[]; name: string; kind: ComboKind }> = [
  { ids: ['zhaoyun', 'guanyu'], name: '龙威破阵', kind: 'spearSlash' },
  { ids: ['zhaoyun', 'huangzhong'], name: '穿云追魂', kind: 'markedVolley' },
  { ids: ['zhaoyun', 'zhuge'], name: '龙火燎原', kind: 'firePath' },
  { ids: ['guanyu', 'huangzhong'], name: '青龙箭阵', kind: 'arrowCircle' },
  { ids: ['guanyu', 'zhuge'], name: '青龙焚阵', kind: 'burnSweep' },
  { ids: ['zhangfei', 'guanyu'], name: '桃园义勇', kind: 'spearSlash' },
  { ids: ['zhangfei', 'zhaoyun'], name: '长坂断桥', kind: 'spearSlash' },
  { ids: ['zhangfei', 'huangzhong'], name: '虎啸箭雨', kind: 'markedVolley' },
  { ids: ['zhangfei', 'zhuge'], name: '燕骑火阵', kind: 'firePath' },
  { ids: ['huangzhong', 'zhuge'], name: '烽火连营', kind: 'fireVolley' },
];
