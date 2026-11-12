/** DEV-only 测试面板：仅在 `?dev=1` + 开发构建出现，正式构建不加载。 */
export type DevActions = Record<string, () => void>;

const ROWS: Array<{ title: string; items: Array<[string, string]> }> = [
  { title: '天下与主城（退出当前测试局）', items: [['worldMap', '进入地图选择'], ['homeCity', '进入义军营寨']] },
  { title: '起始章节（开始新测试局）', items: [['chapter1', '从第一章开始'], ['chapter2', '从第二章开始'], ['selectStart', '返回选将选章']] },
  {
    title: '等级 / 时间',
    items: [
      ['level+1', '等级+1'],
      ['level5', 'Lv5'],
      ['level10', 'Lv10'],
      ['wave1', '第1波'],
      ['wave2', '第2波'],
      ['wave3', '第3波'],
      ['wave4', '第4波'],
      ['wave5', '第5波'],
      ['wave6', '第6波'],
      ['wave7', '第7波'],
      ['wave8', '第8波'],
      ['time+10', '+10秒'],
      ['speed0.5', '0.5×'],
      ['speed1', '1×'],
      ['speed2', '2×'],
      ['speed4', '4×'],
    ],
  },
  {
    title: 'Boss',
    items: [
      ['boss', '召唤本章Boss'],
      ['boss50', '50% 血'],
      ['bossEnergy', '满能量'],
      ['bossUlt', '释放本章大招'],
    ],
  },
  {
    title: '武器',
    items: [
      ['weaponSpear1', '枪 Lv1'],
      ['weaponSpear5', '枪 Lv5'],
      ['weaponBow3', '弓 Lv3'],
      ['weaponFlag3', '旗 Lv3'],
      ['clearWeapons', '清空武器'],
    ],
  },
  {
    title: '蜀军',
    items: [
      ['allySword', '刀兵'],
      ['allyArcher', '弓兵'],
      ['allySpear', '枪兵'],
      ['allyLevel3', '全体 Lv3'],
      ['clearAllies', '清空蜀军'],
      ['legionFood', '+100军粮'],
      ['legionEight', '八兵种各3人'],
      ['aid', '援军事件'],
    ],
  },
  {
    title: '玩家 / 敌人',
    items: [
      ['heal', '回满血'],
        ['supply','回血补给罐'],
      ['god', '无敌开关'],
      ['enemy50', '50 敌'],
      ['enemy150', '150 敌'],
      ['clearEnemies', '清场'],
      ['movementNew', '新版群移'],
      ['movementOld', '旧版追踪'],
    ],
  },
  {
    title: '预设 / 重置',
    items: [
      ['presetLow', '低构筑'],
      ['presetNormal', '普通构筑'],
      ['presetStrong', '强构筑'],
      ['reset', '重置正常局'],
    ],
  },
];

export function createDevPanel(actions: DevActions): () => void {
  const old = document.getElementById('dev-panel');
  if (old) old.remove();
  const root = document.createElement('div');
  root.id = 'dev-panel';
  root.style.cssText = [
    'position:fixed',
    'right:8px',
    'top:8px',
    'z-index:999999',
    'background:rgba(20,14,10,0.92)',
    'border:1px solid #c9a45c',
    'border-radius:8px',
    'font:12px/1.3 system-ui,sans-serif',
    'color:#f0e2c8',
    'width:250px',
    'max-width:calc(100vw - 16px)',
    'pointer-events:auto',
    'box-sizing:border-box',
  ].join(';');

  // 标题栏：点按展开 / 收起，默认收起避免遮挡手机视野与摇杆
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;cursor:pointer;user-select:none;font-weight:700;color:#ffd166';
  const title = document.createElement('span');
  title.textContent = 'DEV 测试面板';
  const toggle = document.createElement('span');
  toggle.textContent = '▶';
  toggle.style.cssText = 'color:#c9a45c;font-size:10px';
  header.appendChild(title);
  header.appendChild(toggle);
  root.appendChild(header);

  // 内容区：独立滚动，最高 65vh
  const body = document.createElement('div');
  body.style.cssText = 'display:none;max-height:65vh;overflow:auto;padding:0 8px 8px;box-sizing:border-box';
  const info = document.createElement('div');
  info.style.cssText = 'color:#b9a88c;margin-bottom:6px;white-space:pre';
  body.appendChild(info);
  for (const row of ROWS) {
    const h = document.createElement('div');
    h.textContent = row.title;
    h.style.cssText = 'margin:6px 0 3px;color:#e8c76a;font-weight:600';
    body.appendChild(h);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
    for (const [action, label] of row.items) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = 'font:11px system-ui;padding:4px 6px;border-radius:4px;border:1px solid #8a6a3a;background:#3a2a1c;color:#f0e2c8;cursor:pointer';
      btn.onclick = () => actions[action]?.();
      wrap.appendChild(btn);
    }
    body.appendChild(wrap);
  }
  root.appendChild(body);

  let collapsed = true;
  const applyState = (): void => {
    body.style.display = collapsed ? 'none' : 'block';
    toggle.textContent = collapsed ? '▶' : '▼';
  };
  header.onclick = () => { collapsed = !collapsed; applyState(); };
  applyState();
  document.body.appendChild(root);

  const timer = window.setInterval(() => {
    const dev = (window as unknown as { __DEV_INFO?: () => string }).__DEV_INFO;
    if (dev) info.textContent = dev();
  }, 500);
  return () => {
    window.clearInterval(timer);
    root.remove();
  };
}
