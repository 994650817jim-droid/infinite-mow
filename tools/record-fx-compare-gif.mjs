// 名将「当主将」与「当随行」的出手特效对照 GIF（电脑布局）：每人左边主将、右边随行，并排；依次播放。
// 输出 assets/review/recruit/fx-compare.gif。用法：BASE=... HEROES=guanyu,zhuge,... node tools/record-fx-compare-gif.mjs（需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/recruit', vid = out + '/video-fxcmp';
const HEROES = (process.env.HEROES ?? 'guanyu,zhuge,huangyueying,sunshangxiang,machao,diaochan').split(',');
const SEG = Number(process.env.SEG ?? 2600), OUTNAME = process.env.NAME ?? 'fx-compare';
rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true });
const rec = id => ({ id, kind: 'hero', hero: id, name: id, template: 'spear', quality: 'orange', rank: 1, picks: [] });
const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 1000, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home'], ownedCities: [], eraSeen: 2, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 4 };
const NAMES = { zhaoyun: '赵云', guanyu: '关羽', huangzhong: '黄忠', zhuge: '诸葛亮', zhangfei: '张飞', machao: '马超', weiyan: '魏延', liubei: '刘备', pangtong: '庞统', huangyueying: '黄月英', sunshangxiang: '孙尚香', diaochan: '貂蝉' };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const t0 = Date.now();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.addInitScript(w => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(w)); sessionStorage.setItem('s', '1'); } }, world);
await p.goto(base + '?layout=desktop&dev=1&autostart=1&stage=1&followers=1');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 120000 }); await p.waitForTimeout(1500);
const segs = [];
const shoot = async (lord, fol, label) => {
  const r = { version: 1, lord, lordFinal: true, owned: [rec(lord), ...(fol ? [rec(fol)] : [])], followers: fol ? [fol] : [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 3 };
  await p.evaluate(([r, lord]) => { localStorage.setItem('im_roster_v1', JSON.stringify(r)); const s = window.__game.scene.getScene('GameScene'); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: lord, weapon: undefined }); window.__prevPlayer = s.player; s.scene.restart(); }, [r, lord]);
  await p.waitForTimeout(500);
  await p.waitForFunction(([lord, n]) => { const s = window.__game.scene.getScene('GameScene'); // 认准重启后新建的主将对象（同一主将连测两批时，旧场景上条件也成立，会抢跑）
    return s?.player && s.player !== window.__prevPlayer && s.runConfig?.character === lord && (s.followers?.members.length ?? 0) === n && s.__DEV_ACTIONS; }, [lord, fol ? 1 : 0], { timeout: 60000 });
  await p.waitForTimeout(600);
  await p.evaluate(([fol, label]) => {
    const s = window.__game.scene.getScene('GameScene'), pl = s.player; pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; if (fol) { pl.weapons = []; const f = s.followers.members[0]; f.maxHp = f.hp = 1e9; }
    s.add.text(pl.x, pl.y - 118, label, { fontFamily: 'sans-serif', fontSize: '20px', color: '#ffe9b0', backgroundColor: '#2a1408cc', padding: { x: 8, y: 3 } }).setOrigin(.5).setDepth(9999); // 世界坐标，主将头顶（录制时主将不动）
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; s.spawnEnemy('infantry', pl.x + Math.cos(a) * 150, pl.y + Math.sin(a) * 150, 12); }
  }, [fol, label]);
  const start = Date.now(); await p.waitForTimeout(SEG); segs.push({ label, start: (start - t0) / 1000, end: (Date.now() - t0) / 1000 });
};
for (const h of HEROES) { await shoot(h, null, `${NAMES[h]} · 主将`); await shoot(h === 'zhaoyun' ? 'guanyu' : 'zhaoyun', h, `${NAMES[h]} · 随行`); }
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(x => x.endsWith('.webm')).map(x => vid + '/' + x).pop();
// 视频从建上下文开始录：用记下的起止时间剪出每段（480×270），每人主将 | 随行并排，再按顺序接起来
const ins = [], filt = [];
segs.forEach((s, i) => { ins.push('-ss', s.start.toFixed(2), '-t', (s.end - s.start).toFixed(2), '-i', webm); filt.push(`[${i}:v]fps=9,crop=640:360:320:180,scale=480:-1:flags=lanczos,setpts=PTS-STARTPTS[v${i}]`); });
const pairs = HEROES.map((_, k) => `[v${2 * k}][v${2 * k + 1}]hstack=inputs=2[h${k}]`);
const concat = HEROES.map((_, k) => `[h${k}]`).join('') + `concat=n=${HEROES.length}:v=1:a=0[all]`;
const pal = '[all]split[a][b];[a]palettegen=max_colors=96[pl];[b][pl]paletteuse=dither=bayer:bayer_scale=5[o]';
execFileSync('ffmpeg', ['-y', ...ins, '-filter_complex', [...filt, ...pairs, concat, pal].join(';'), '-map', '[o]', out + '/' + OUTNAME + '.gif'], { stdio: 'ignore' });
rmSync(vid, { recursive: true, force: true });
console.log('gif ok', JSON.stringify(segs.map(s => [s.label, s.start.toFixed(1)])));
