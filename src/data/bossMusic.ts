/**
 * 首领专属主题（程序合成，Music.ts 演奏）。每位首领：五声调式、速度、主奏乐器、鼓点型、标志性音效，
 * 旋律由首领名作种子生成（同一首领每次相同、不同首领不同）。出场时先奏约 2.4 秒的锣鼓出场段，再进入主题。
 */
export type BossLead = 'pipa' | 'suona' | 'flute' | 'qin';
export type BossDrums = 'march' | 'gallop' | 'ritual' | 'heavy' | 'ceremony' | 'tense';
export type BossFx = 'thunder' | 'bells' | 'horn' | 'fire' | 'earth' | 'gong';
export interface BossProfile {
  name: string;
  /** 出场名号，如“天公将军”。 */
  title: string;
  bpm: number;
  /** 调式主音（MIDI）与五声音程。 */
  tonic: number;
  mode: number[];
  /** 8 小节低音走向（调式音级）。 */
  bass: number[];
  lead: BossLead;
  drums: BossDrums;
  fx: BossFx[];
}

const GONG = [0, 2, 4, 7, 9], SHANG = [0, 2, 5, 7, 10], JUE = [0, 3, 5, 8, 10], ZHI = [0, 2, 5, 7, 9], YU = [0, 3, 5, 7, 10];
/** 妖异调式（含小二度）：黄巾三张的符咒感。 */
const YAO = [0, 1, 5, 7, 8];

const P = (name: string, title: string, bpm: number, tonic: number, mode: number[], bass: number[], lead: BossLead, drums: BossDrums, fx: BossFx[]): BossProfile => ({ name, title, bpm, tonic, mode, bass, lead, drums, fx });

export const BOSS_PROFILES: Record<string, BossProfile> = {
  张梁: P('张梁', '人公将军', 96, 62, YAO, [0, 0, 1, 0, 3, 2, 1, 0], 'suona', 'ritual', ['bells']),
  张宝: P('张宝', '地公将军', 86, 60, YU, [0, 0, 3, 2, 0, 0, 4, 3], 'qin', 'heavy', ['earth']),
  张角: P('张角', '天公将军', 100, 63, YAO, [0, 1, 0, 3, 0, 1, 4, 3], 'suona', 'ritual', ['thunder', 'bells']),
  华雄: P('华雄', '西凉骁将', 104, 62, SHANG, [0, 0, 3, 3, 1, 1, 4, 0], 'pipa', 'march', ['horn', 'gong']),
  徐荣: P('徐荣', '伏兵之将', 112, 64, JUE, [0, 2, 0, 3, 0, 2, 4, 3], 'flute', 'tense', []),
  吕布: P('吕布', '人中吕布', 132, 62, YU, [0, 0, 3, 3, 4, 4, 2, 1], 'pipa', 'gallop', ['gong', 'horn']),
  董卓: P('董卓', '相国', 92, 58, SHANG, [0, 0, 4, 4, 3, 3, 0, 1], 'suona', 'heavy', ['fire', 'gong']),
  李傕: P('李傕', '西凉余部', 116, 61, YU, [0, 3, 0, 4, 0, 3, 2, 1], 'suona', 'gallop', ['horn']),
  张绣: P('张绣', '北地枪王', 120, 64, SHANG, [0, 0, 2, 3, 0, 0, 4, 2], 'pipa', 'gallop', []),
  袁术: P('袁术', '仲家伪帝', 84, 60, GONG, [0, 0, 4, 4, 3, 3, 1, 0], 'suona', 'ceremony', ['bells', 'gong']),
  颜良: P('颜良', '河北上将', 112, 60, ZHI, [0, 0, 3, 3, 0, 4, 2, 0], 'suona', 'heavy', ['horn', 'gong']),
  文丑: P('文丑', '河北名将', 124, 62, ZHI, [0, 3, 0, 4, 0, 3, 1, 0], 'pipa', 'gallop', ['horn']),
  淳于琼: P('淳于琼', '乌巢守将', 100, 63, JUE, [0, 0, 2, 2, 3, 3, 1, 0], 'flute', 'tense', ['fire']),
  曹纯: P('曹纯', '虎豹骑统领', 136, 61, SHANG, [0, 0, 4, 3, 0, 0, 2, 1], 'pipa', 'gallop', ['horn']),
  蔡瑁: P('蔡瑁', '荆州水军都督', 94, 59, YU, [0, 2, 3, 2, 0, 4, 3, 0], 'flute', 'tense', ['fire', 'gong']),
  曹仁: P('曹仁', '天人之将', 108, 60, GONG, [0, 0, 3, 3, 4, 4, 1, 0], 'suona', 'heavy', ['earth', 'gong']),
};
/** 攻城 / 守城等非固定首领共用。 */
export const SIEGE_PROFILE: BossProfile = P('守将', '城池守将', 108, 62, SHANG, [0, 0, 3, 2, 0, 4, 3, 0], 'pipa', 'march', ['horn']);

export function bossProfile(name: string): BossProfile {
  const exact = BOSS_PROFILES[name];
  if (exact) return exact;
  const hit = Object.keys(BOSS_PROFILES).find(k => name.includes(k));
  return hit ? BOSS_PROFILES[hit] : { ...SIEGE_PROFILE, name, title: SIEGE_PROFILE.title };
}

/** 9 个旋律音（两个八度内的调式音）。 */
export function profileScale(p: BossProfile): number[] {
  const out: number[] = [];
  for (let o = 0; out.length < 9; o++) for (const i of p.mode) { if (out.length < 9) out.push(p.tonic + o * 12 + i); }
  return out;
}

function seeded(seed: string): () => number {
  let h = 2166136261; for (const ch of seed) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const RHYTHMS = [[2, 1, 1, 2, 2, 4, 2, 2], [1, 1, 2, 2, 2, 2, 2, 4], [3, 1, 2, 2, 4, 2, 2], [2, 2, 1, 1, 2, 4, 4], [1, 1, 1, 1, 2, 2, 4, 4], [2, 2, 2, 2, 3, 1, 4]];

/** 16 小节旋律：每个十六分步上的 [音级, 十六分时值] 或 null。form：A B A C D B A C'（C' 落主音）。 */
export function composeBossMelody(p: BossProfile): Array<[number, number] | null> {
  const rnd = seeded(p.name + p.title), steps: Array<[number, number] | null> = new Array(16 * 16).fill(null);
  const phrase = (start: number, endOnTonic: boolean): Array<[number, number]> => {
    const r = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)];
    let deg = start; const out: Array<[number, number]> = [];
    r.forEach((len, i) => {
      if (i > 0) { const jump = rnd() < .7 ? (rnd() < .5 ? 1 : -1) : (rnd() < .5 ? 2 : -2); deg = Math.max(0, Math.min(8, deg + jump)); }
      if (i === r.length - 1 && endOnTonic) deg = deg > 4 ? 5 : 0;
      out.push([deg, len * 2]);
    });
    if (rnd() < .35 && out.length > 3) out[out.length - 2] = [-1, out[out.length - 2][1]]; // 偶尔留一拍空
    return out;
  };
  const A = phrase(3 + Math.floor(rnd() * 3), false), B = phrase(4 + Math.floor(rnd() * 3), false), C = phrase(3, true), D = phrase(6 + Math.floor(rnd() * 2), false), C2 = phrase(2, true);
  [A, B, A, C, D, B, A, C2].forEach((ph, slot) => { let pos = slot * 32; for (const [deg, len] of ph) { if (deg >= 0) steps[pos] = [deg, len]; pos += len; } });
  return steps;
}

/** 出场动机：三个音（主音 → 五度 → 高八度主音或调式第四音）。 */
export function bossMotif(p: BossProfile): number[] { const s = profileScale(p); return [s[0], s[3], p.mode[1] === 1 ? s[6] : s[5]]; }
