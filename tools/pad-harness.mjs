// 手柄测试公用：伪造 navigator.getGamepads（标准映射虚拟手柄），提供按键 / 摇杆操作与焦点读取。
export const PADJS = `(() => {
  const st = { buttons: new Array(17).fill(0), axes: [0, 0, 0, 0], t: 0 };
  window.__vpad = st;
  const make = () => ({ id: 'Virtual Xbox Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: ++st.t,
    axes: st.axes.slice(), buttons: st.buttons.map(v => ({ pressed: v > 0.5, touched: v > 0, value: v })) });
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [make(), null, null, null] });
})();`;
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
export function padApi(page) {
  const wait = ms => page.waitForTimeout(ms);
  return {
    async press(name, hold = 80) { const i = BTN[name]; await page.evaluate(i => { window.__vpad.buttons[i] = 1; }, i); await wait(hold); await page.evaluate(i => { window.__vpad.buttons[i] = 0; }, i); await wait(90); },
    async stick(x, y, ms) { await page.evaluate(([x, y]) => { window.__vpad.axes[0] = x; window.__vpad.axes[1] = y; }, [x, y]); if (ms) { await wait(ms); await page.evaluate(() => { window.__vpad.axes[0] = 0; window.__vpad.axes[1] = 0; }); await wait(60); } },
    async focus() { return page.evaluate(() => { const f = window.__pad?.focused; if (!f) return null; return { name: f.name || '', text: window.__pad.focusLabel(), type: f.type, scene: f.scene?.sys.settings.key }; }); },
    async cands() { return page.evaluate(() => { const n = window.__pad; const c = n.collect(window.__game.scene.getScenes(true)); return c.map(c => ({ name: c.obj.name, text: typeof c.obj.text === 'string' ? c.obj.text.slice(0, 16) : '', x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h), scene: c.scene.sys.settings.key })); }); },
    /** 按方向键把焦点移到满足条件的对象上（最多 steps 次尝试每个方向）。 */
    async focusTo(pred, steps = 12) {
      for (const dir of ['DOWN', 'RIGHT', 'UP', 'LEFT', 'DOWN', 'RIGHT']) for (let i = 0; i < steps; i++) { const f = await this.focus(); if (f && pred(f)) return f; await this.press(dir, 60); }
      const f = await this.focus(); return f && pred(f) ? f : null;
    },
  };
}
