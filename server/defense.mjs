import world from '../src/coop/arena.json' with { type: 'json' };

const waves = [
  { at: 0, name: '西路先锋', edges: [0], interval: 1.5 },
  { at: 16, name: '东西夹击', edges: [1, 0], interval: 1.13 },
  { at: 32, name: '南北夺旗', edges: [3, 2], interval: 1 },
  { at: 48, name: '北门决战', edges: [2, 1], interval: 1.9 },
];

export function defenseWave(seconds) {
  return waves.findLast(wave => seconds >= wave.at);
}

export function createBanner() {
  return { x: world.width / 2, y: world.height / 2, hp: 100, maxHp: 100, radius: 85, progress: 0, readyAt: 0, repairs: 0 };
}

export function aimsAtBanner(enemy, banner, distanceToHero) {
  if (!enemy.raider) return false;
  const distanceToFlag = Math.hypot(banner.x - enemy.x, banner.y - enemy.y);
  return distanceToHero > 65 || distanceToHero > distanceToFlag;
}

export function hitBanner(flag, boss, seconds) {
  flag.hp = Math.max(0, flag.hp - (boss ? 9 : 4));
  flag.progress = 0;
  flag.readyAt = Math.max(flag.readyAt, seconds + 1.5);
}

export function rally(flag, players, seconds, dt) {
  if (flag.hp <= 0 || flag.hp >= flag.maxHp || seconds < flag.readyAt ||
      players.length !== 2 || !players.every(p => p.hp > 0 && Math.hypot(p.x - flag.x, p.y - flag.y) <= flag.radius)) {
    flag.progress = 0;
    return;
  }
  flag.progress += dt;
  if (flag.progress + 1e-8 < 3) return;
  flag.hp = Math.min(flag.maxHp, flag.hp + 16);
  flag.progress = 0;
  flag.readyAt = seconds + 12;
  flag.repairs++;
}

export function defenseState(flag, seconds) {
  const wave = defenseWave(seconds);
  const next = waves[waves.indexOf(wave) + 1];
  const remaining = next ? Math.ceil(next.at - seconds) : 0;
  return { x: flag.x, y: flag.y, hp: flag.hp, maxHp: flag.maxHp, radius: flag.radius, repairs: flag.repairs,
    progress: Math.floor(Math.min(1, flag.progress / 3) * 100), readyIn: Math.max(0, Math.ceil(flag.readyAt - seconds)),
    wave: wave.name, next: next && remaining <= 5 ? next.name : null, remaining };
}

export const defenseBossAt = waves.at(-1).at;
