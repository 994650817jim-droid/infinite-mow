/** 六波战斗：6 分钟关卡，5:00 进入第 6 波（张角决战）。 */
export interface WaveDef {
  start: number;
  name: string;
}

export const WAVES: WaveDef[] = [
  { start: 0, name: '黄巾先锋' },
  { start: 60, name: '弓盾合围' },
  { start: 120, name: '轻骑突袭' },
  { start: 180, name: '校尉压阵' },
  { start: 240, name: '黄巾大军' },
  { start: 300, name: '张角决战' },
];

export const WAVE_COUNT = WAVES.length;

export function waveIndexAt(elapsed: number, waves: readonly WaveDef[] = WAVES): number {
  let idx = 0;
  for (let i = 0; i < waves.length; i += 1) {
    if (elapsed >= waves[i].start) idx = i;
  }
  return idx;
}

export function waveNameAt(elapsed: number): string {
  return WAVES[waveIndexAt(elapsed)].name;
}
