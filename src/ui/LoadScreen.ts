/**
 * 加载画面（2026-11-20 首屏加载优化）：水墨风、不要大框——墨色底、一行字、一条细金线进度、一句小提示。
 * 用 DOM 画，所以在任何场景（含 BootScene 还没有任何贴图时）都能用；开机和进关各一次。加载失败时在同一块画面上写提示并给「重试」。
 */
const TIPS = [
  '兵贵神速，进关前整饬军伍。', '加点之后别忘了洗点：重整构筑随时可用。', '战法凑够 2 / 4 / 6 势，会有流派加成。', '擒贼先擒王：首领血条在屏幕下方。',
  '锦囊每关限用，攒着关键时刻放。', '行营休整时，将帅帐能看到完整构筑。', '兵器 Lv5 选专职，Lv7 加四势进阶。',
];
let root: HTMLDivElement | null = null, bar: HTMLDivElement | null = null, title: HTMLDivElement | null = null, tip: HTMLDivElement | null = null, act: HTMLDivElement | null = null, tipTimer = 0;

function ensure(): HTMLDivElement {
  if (root && document.body.contains(root)) return root;
  root = document.createElement('div'); root.id = 'load-screen';
  root.style.cssText = 'position:fixed;inset:0;z-index:50;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 45%,#2a2118 0%,#120d09 70%);color:#e8d9b4;font-family:"IMWarHeading","STKaiti","KaiTi","Noto Serif SC",serif;transition:opacity .35s;opacity:0;';
  title = document.createElement('div'); title.style.cssText = 'font-size:26px;letter-spacing:.35em;text-indent:.35em;text-shadow:0 2px 6px #000;';
  const track = document.createElement('div'); track.style.cssText = 'width:min(360px,70vw);height:3px;background:rgba(201,163,94,.18);border-radius:2px;overflow:hidden;';
  bar = document.createElement('div'); bar.style.cssText = 'width:0%;height:100%;background:linear-gradient(90deg,#8a6a30,#f3d48a);transition:width .18s ease-out;'; track.appendChild(bar);
  tip = document.createElement('div'); tip.style.cssText = 'font-size:13px;color:#a8977a;letter-spacing:.12em;min-height:20px;text-align:center;padding:0 24px;';
  act = document.createElement('div'); act.style.cssText = 'display:none;margin-top:6px;padding:7px 26px;border:1px solid #c9a35e;border-radius:3px;color:#f3d48a;font-size:15px;letter-spacing:.3em;cursor:pointer;background:rgba(0,0,0,.25);pointer-events:auto;';
  root.append(title, track, tip, act); document.body.appendChild(root); return root;
}

export const loadScreen = {
  /** 显示（text = 主标题）；同时隐藏 index.html 里的旧「正在进入乱世…」。 */
  show(text: string): void {
    const r = ensure(); title!.textContent = text; bar!.style.width = '0%'; act!.style.display = 'none';
    const old = document.getElementById('boot-hint'); if (old) old.style.display = 'none';
    r.style.display = 'flex'; requestAnimationFrame(() => { if (root) root.style.opacity = '1'; });
    const rot = (): void => { if (tip) tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }; rot(); window.clearInterval(tipTimer); tipTimer = window.setInterval(rot, 3500);
  },
  progress(p: number): void { if (bar) bar.style.width = Math.max(2, Math.min(100, p * 100)).toFixed(0) + '%'; },
  note(text: string): void { if (tip) tip.textContent = text; },
  /** 失败提示 + 重试按钮。 */
  fail(text: string, retry: () => void, label = '重 试'): void {
    ensure(); if (tip) tip.textContent = text; window.clearInterval(tipTimer); if (act) { act.textContent = label; act.style.display = 'block'; act.onclick = () => { act!.style.display = 'none'; retry(); }; }
  },
  hide(): void {
    window.clearInterval(tipTimer); if (!root) return; const r = root; r.style.opacity = '0'; window.setTimeout(() => { if (r.style.opacity === '0') r.style.display = 'none'; }, 380);
    const old = document.getElementById('boot-hint'); if (old) old.style.display = 'none';
  },
};
