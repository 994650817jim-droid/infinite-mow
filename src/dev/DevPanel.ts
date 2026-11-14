/** DEV-only 测试面板：仅在 `?dev=1` + 开发构建出现，正式构建不加载。 */
export type DevActions = Record<string, () => void>;
export interface DevItem { key: string; label: string; active?: () => boolean; hint?: string }
export interface DevSection { title: string; items: DevItem[] }
export interface DevPanelSpec { sections: DevSection[]; actions: DevActions; info: () => string }

const STORE = 'im_dev_panel';
interface Saved { collapsed: boolean; x?: number; y?: number; scroll?: number }
const load = (): Saved => { try { return { collapsed: true, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') }; } catch { return { collapsed: true }; } };
const save = (s: Saved): void => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* ignore */ } };

/**
 * 面板：标题栏点按展开/收起、拖动换位置（避开暂停按钮等 HUD），位置/展开/滚动记忆在本机。
 * 开关类按钮按 active() 高亮；信息栏每 0.5 秒刷新。
 */
export function createDevPanel(spec: DevPanelSpec): () => void {
  document.getElementById('dev-panel')?.remove();
  const state = load();
  const root = document.createElement('div');
  root.id = 'dev-panel';
  root.style.cssText = [
    'position:fixed', 'z-index:999999', 'background:rgba(20,14,10,0.94)', 'border:1px solid #c9a45c', 'border-radius:8px',
    'font:12px/1.35 system-ui,sans-serif', 'color:#f0e2c8', 'width:272px', 'max-width:calc(100vw - 16px)', 'box-sizing:border-box',
    'box-shadow:0 4px 18px rgba(0,0,0,.45)', 'touch-action:none',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;user-select:none;font-weight:700;color:#ffd166;white-space:nowrap';
  const grip = document.createElement('span'); grip.textContent = '⠿'; grip.title = '拖动'; grip.style.cssText = 'cursor:move;color:#8a6a3a;font-size:14px;padding:0 2px';
  const title = document.createElement('span'); title.textContent = 'DEV 测试面板'; title.style.flex = '1';
  const quick = document.createElement('span'); quick.style.cssText = 'font-weight:400;color:#b9a88c;font-size:11px';
  const toggle = document.createElement('span'); toggle.style.cssText = 'color:#c9a45c;font-size:10px';
  header.append(grip, title, quick, toggle);
  root.appendChild(header);

  const body = document.createElement('div');
  body.style.cssText = 'max-height:min(62vh,calc(100vh - 60px));overflow:auto;padding:0 8px 8px;box-sizing:border-box';
  const info = document.createElement('div');
  info.style.cssText = 'color:#d8c7a6;background:rgba(0,0,0,.25);border-radius:4px;padding:4px 6px;margin-bottom:4px;white-space:pre-wrap;font:11px/1.45 ui-monospace,Consolas,monospace';
  body.appendChild(info);
  const toggles: Array<[HTMLButtonElement, () => boolean]> = [];
  for (const section of spec.sections) {
    if (!section.items.length) continue;
    const h = document.createElement('div');
    h.textContent = section.title;
    h.style.cssText = 'margin:7px 0 3px;color:#e8c76a;font-weight:600';
    body.appendChild(h);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    for (const item of section.items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.hint) btn.title = item.hint;
      btn.style.cssText = 'font:11px system-ui;padding:4px 7px;border-radius:4px;border:1px solid #8a6a3a;background:#3a2a1c;color:#f0e2c8;cursor:pointer';
      btn.onclick = (ev) => {
        ev.stopPropagation();
        try { spec.actions[item.key]?.(); } catch (e) { console.error('[DEV]', item.key, e); btn.style.borderColor = '#e05a4a'; }
        refresh();
      };
      if (item.active) toggles.push([btn, item.active]);
      wrap.appendChild(btn);
    }
    body.appendChild(wrap);
  }
  root.appendChild(body);
  body.addEventListener('scroll', () => { state.scroll = body.scrollTop; save(state); });

  const place = (): void => {
    const w = root.offsetWidth || 272, h = root.offsetHeight || 32;
    const x = Math.min(Math.max(4, state.x ?? window.innerWidth - w - 8), window.innerWidth - w - 4);
    // 展开时整块面板都要在屏幕内：下方放不下就上移（不改保存的位置）。
    const y = Math.min(Math.max(4, state.y ?? Math.round(window.innerHeight * .42)), window.innerHeight - (state.collapsed ? Math.min(h, 40) : h) - 4);
    root.style.left = x + 'px'; root.style.top = y + 'px';
  };
  const applyState = (): void => {
    body.style.display = state.collapsed ? 'none' : 'block';
    toggle.textContent = state.collapsed ? '▶' : '▼';
    root.style.width = state.collapsed ? 'auto' : '272px';
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
    try { info.textContent = spec.info(); } catch { info.textContent = '-'; }
    for (const [btn, active] of toggles) {
      let on = false; try { on = active(); } catch { /* ignore */ }
      btn.style.background = on ? '#7a5a2a' : '#3a2a1c'; btn.style.borderColor = on ? '#f0cf86' : '#8a6a3a'; btn.style.color = on ? '#fff3d0' : '#f0e2c8';
    }
    const first = spec.info().split('\n')[0] ?? '';
    quick.textContent = state.collapsed ? first.replace(/^.*?(FPS \d+).*$/, '$1') : '';
  };
  document.body.appendChild(root);
  applyState(); refresh();
  const onResize = (): void => place();
  window.addEventListener('resize', onResize);
  const timer = window.setInterval(refresh, 500);
  return () => { window.clearInterval(timer); window.removeEventListener('resize', onResize); root.remove(); };
}
