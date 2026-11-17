/** DEV-only 测试面板：仅在 `?dev=1` + 开发构建出现，正式构建不加载。 */
export type DevActions = Record<string, () => void>;
export interface DevItem { key: string; label: string; active?: () => boolean; hint?: string }
export interface DevSection { title: string; items: DevItem[]; /** 第一次打开面板时是否展开（之后记住用户的选择）。 */ open?: boolean; /** 分组标题右侧的小字（每 0.5 秒刷新）。 */ note?: () => string }
export interface DevPanelSpec { sections: DevSection[]; actions: DevActions; info: () => string; /** 标题栏上的醒目标签（如「测试存档」）。 */ tag?: string }

const STORE = 'im_dev_panel';
interface Saved { collapsed: boolean; x?: number; y?: number; scroll?: number; /** 分组展开状态（按标题）。 */ groups?: Record<string, boolean>; v?: number }
/** 版式版本：2 = 2026-11-16 电脑布局改版（旧版保存的位置在右侧压住 HUD，升级时丢掉）。 */
const LAYOUT_V = 2;
const load = (): Saved => {
  try { const s = { collapsed: true, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') } as Saved; return s.v === LAYOUT_V ? s : { collapsed: true, groups: s.groups, v: LAYOUT_V }; } catch { return { collapsed: true, v: LAYOUT_V }; }
};
const save = (s: Saved): void => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ } };

/**
 * 面板（2026-11-16 电脑布局改版）：
 * - 默认停在画面顶部、左侧 HUD 与中间计时之间的空档（约 24% 宽处），收起时只占一条标题栏，不挡战斗画面；
 * - 标题栏点按展开 / 收起、拖动换位置，位置 / 展开 / 滚动 / 各分组开合都记在本机；
 * - 分组标题点按折叠；字号随窗口变大（1920 宽时 13px）；
 * - 开关类按钮按 active() 高亮；信息栏与分组小字每 0.5 秒刷新。
 */
export function createDevPanel(spec: DevPanelSpec): () => void {
  document.getElementById('dev-panel')?.remove();
  const state = load(); state.groups ??= {};
  const big = window.innerWidth >= 1600, font = big ? 13 : 12, width = big ? 380 : 340;
  const root = document.createElement('div');
  root.id = 'dev-panel';
  root.style.cssText = [
    'position:fixed', 'z-index:999999', 'background:rgba(20,14,10,0.95)', 'border:1px solid #c9a45c', 'border-radius:6px',
    `font:${font}px/1.4 system-ui,sans-serif`, 'color:#f0e2c8', `width:${width}px`, 'max-width:calc(100vw - 16px)', 'box-sizing:border-box',
    'box-shadow:0 4px 18px rgba(0,0,0,.45)', 'touch-action:none',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;user-select:none;font-weight:700;color:#ffd166;white-space:nowrap';
  const grip = document.createElement('span'); grip.textContent = '⠿'; grip.title = '拖动'; grip.style.cssText = 'cursor:move;color:#8a6a3a;font-size:14px;padding:0 2px';
  const title = document.createElement('span'); title.textContent = 'DEV 测试面板';
  const tag = document.createElement('span'); tag.textContent = spec.tag ?? ''; tag.style.cssText = `display:${spec.tag ? 'inline' : 'none'};font-weight:600;font-size:${font - 1}px;color:#ffe2a0;background:#7a2a1c;border:1px solid #c9a45c;border-radius:3px;padding:0 5px`;
  const quick = document.createElement('span'); quick.style.cssText = `flex:1;text-align:right;font-weight:400;color:#b9a88c;font-size:${font - 1}px`;
  const toggle = document.createElement('span'); toggle.style.cssText = 'color:#c9a45c;font-size:10px';
  header.append(grip, title, tag, quick, toggle);
  root.appendChild(header);

  const body = document.createElement('div');
  body.style.cssText = 'max-height:calc(100vh - 44px);overflow:auto;padding:0 8px 8px;box-sizing:border-box';
  const info = document.createElement('div');
  info.style.cssText = `color:#d8c7a6;background:rgba(0,0,0,.25);border-radius:4px;padding:4px 6px;margin-bottom:4px;white-space:pre-wrap;font:${font - 1}px/1.45 ui-monospace,Consolas,monospace`;
  body.appendChild(info);
  const toggles: Array<[HTMLButtonElement, () => boolean]> = [];
  const notes: Array<[HTMLSpanElement, () => string]> = [];
  for (const section of spec.sections) {
    if (!section.items.length) continue;
    const head = document.createElement('div');
    head.style.cssText = `display:flex;align-items:center;gap:6px;margin:6px 0 3px;padding:2px 4px;color:#e8c76a;font-weight:600;cursor:pointer;user-select:none;border-bottom:1px solid rgba(201,164,92,.35)`;
    const arrow = document.createElement('span'); arrow.style.cssText = 'font-size:10px;width:10px;color:#c9a45c';
    const name = document.createElement('span'); name.textContent = section.title;
    const note = document.createElement('span'); note.style.cssText = `flex:1;text-align:right;font-weight:400;color:#b9a88c;font-size:${font - 1}px`;
    if (section.note) notes.push([note, section.note]);
    head.append(arrow, name, note);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:2px 0 4px';
    const isOpen = (): boolean => state.groups![section.title] ?? !!section.open;
    const paint = (): void => { wrap.style.display = isOpen() ? 'flex' : 'none'; arrow.textContent = isOpen() ? '▼' : '▶'; };
    head.onclick = (ev) => { ev.stopPropagation(); state.groups![section.title] = !isOpen(); save(state); paint(); };
    paint();
    for (const item of section.items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.hint) btn.title = item.hint;
      btn.style.cssText = `font:${font}px system-ui;padding:3px 8px;border-radius:4px;border:1px solid #8a6a3a;background:#3a2a1c;color:#f0e2c8;cursor:pointer`;
      btn.onclick = (ev) => {
        ev.stopPropagation();
        try { spec.actions[item.key]?.(); } catch (e) { console.error('[DEV]', item.key, e); btn.style.borderColor = '#e05a4a'; }
        refresh();
      };
      if (item.active) toggles.push([btn, item.active]);
      wrap.appendChild(btn);
    }
    body.append(head, wrap);
  }
  root.appendChild(body);
  body.addEventListener('scroll', () => { state.scroll = body.scrollTop; save(state); });

  const place = (): void => {
    const w = root.offsetWidth || width, h = root.offsetHeight || 28;
    const x = Math.min(Math.max(4, state.x ?? Math.round(window.innerWidth * .235)), window.innerWidth - w - 4);
    // 展开时整块面板都要在屏幕内：下方放不下就上移（不改保存的位置）。
    const y = Math.min(Math.max(2, state.y ?? 2), window.innerHeight - (state.collapsed ? Math.min(h, 32) : h) - 4);
    root.style.left = x + 'px'; root.style.top = y + 'px';
  };
  const applyState = (): void => {
    body.style.display = state.collapsed ? 'none' : 'block';
    toggle.textContent = state.collapsed ? '▶' : '▼';
    // 收起时标题缩成「DEV」，整条约 160px，停在左侧 HUD 与中间计时之间
    title.textContent = state.collapsed ? 'DEV' : 'DEV 测试面板';
    root.style.width = state.collapsed ? 'auto' : width + 'px';
    place();
    if (!state.collapsed && state.scroll) body.scrollTop = state.scroll;
  };

  // 拖动：按住标题栏移动超过 6px 视为拖动，否则视为点按展开/收起。
  let drag: { sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  header.addEventListener('pointerdown', (e) => { drag = { sx: e.clientX, sy: e.clientY, ox: root.offsetLeft, oy: root.offsetTop, moved: false }; header.setPointerCapture(e.pointerId); e.stopPropagation(); });
  header.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return; drag.moved = true;
    state.x = drag.ox + dx; state.y = drag.oy + dy; place();
  });
  header.addEventListener('pointerup', (e) => {
    e.stopPropagation(); const d = drag; drag = null;
    if (d?.moved) { save(state); return; }
    state.collapsed = !state.collapsed; save(state); applyState();
  });
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  const refresh = (): void => {
    let text = '-'; try { text = spec.info(); } catch { /* ignore */ }
    info.textContent = text;
    for (const [btn, active] of toggles) {
      let on = false; try { on = active(); } catch { /* ignore */ }
      btn.style.background = on ? '#7a5a2a' : '#3a2a1c'; btn.style.borderColor = on ? '#f0cf86' : '#8a6a3a'; btn.style.color = on ? '#fff3d0' : '#f0e2c8';
    }
    for (const [el, fn] of notes) { try { el.textContent = fn(); } catch { el.textContent = ''; } }
    const first = text.split('\n')[0] ?? '';
    quick.textContent = state.collapsed ? first.replace(/^.*?(FPS \d+).*$/, '$1') : '';
  };
  document.body.appendChild(root);
  applyState(); refresh();
  const onResize = (): void => place();
  window.addEventListener('resize', onResize);
  const timer = window.setInterval(refresh, 500);
  return () => { window.clearInterval(timer); window.removeEventListener('resize', onResize); root.remove(); };
}
