import type Phaser from 'phaser';
import './defense-objective.css';
export interface DefenseBrief {
  target: string;
  phase: string;
  gate: string;
  details: string[];
  anomalies: string[];
  diagnostic: Record<string, unknown>;
}
interface Host {
  scene: Phaser.Scene;
  read: () => DefenseBrief;
  available: () => boolean;
  pause: () => () => void;
}
/** 小型任务签与玩家主动复制的军情；不读存档、不联网、不代玩家改变目标。 */
export class DefenseObjectiveUI {
  private chip = document.createElement('button');
  private title = document.createElement('strong');
  private gate = document.createElement('span');
  private layer?: HTMLDivElement;
  private resume?: () => void;
  private next = 0;
  private closed = false;
  constructor(private readonly h: Host) {
    this.chip.type = 'button'; this.chip.className = 'defense-objective-chip';
    this.chip.setAttribute('aria-label', '查看守城目标与诊断');
    const heading = document.createElement('small'); heading.textContent = '守城军情 · 查看';
    this.chip.append(heading, this.title, this.gate); document.body.append(this.chip);
    this.chip.onclick = () => this.open();
    h.scene.events.once('shutdown', () => this.destroy());
    h.scene.events.once('destroy', () => this.destroy());
    this.update(0);
  }
  update(now: number): void {
    if (this.closed) return;
    this.chip.hidden = !!this.layer || !this.h.available() || this.h.scene.children.list.some(o => o.name === 'combat-notice' && 'visible' in o && !!o.visible);
    if (now < this.next || this.chip.hidden) return;
    this.next = now + 250;
    const b = this.h.scene.game.canvas.getBoundingClientRect(), d = this.h.read();
    this.chip.style.left = Math.max(8, b.right - Math.min(248, b.width * .49) - 10) + 'px';
    this.chip.style.top = (b.top + Math.min(180, Math.max(140, b.height * .18))) + 'px';
    this.chip.style.width = Math.min(248, b.width * .49) + 'px';
    this.title.textContent = d.target;
    this.gate.textContent = d.anomalies.length ? '状态待核对 · 点击查看' : d.gate;
    this.chip.title = d.phase;
  }
  private key = (e: KeyboardEvent): void => {
    if (!this.layer) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'Tab') {
      const nodes = [...this.layer.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button,textarea')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  private open(): void {
    if (this.layer || !this.h.available()) return;
    // 暂停之前采样，诊断里的暂停原因不能被这个查看窗口本身覆盖。
    const d = this.h.read(); this.resume = this.h.pause(); this.chip.hidden = true;
    const layer = this.layer = document.createElement('div'); layer.className = 'defense-objective-layer';
    const card = document.createElement('section'); card.className = 'defense-objective-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'defense-objective-title');
    const h = document.createElement('h2'); h.id = 'defense-objective-title'; h.textContent = '守城军情';
    const sub = document.createElement('p'); sub.className = 'defense-objective-phase'; sub.textContent = d.phase + ' · 查看期间暂停';
    const target = document.createElement('h3'); target.textContent = '当前任务 · ' + d.target;
    const gate = document.createElement('p'); gate.className = 'defense-objective-gate'; gate.textContent = d.gate;
    const list = document.createElement('ul'); for (const line of d.details) { const li = document.createElement('li'); li.textContent = line; list.append(li); }
    const check = document.createElement('p'); check.className = 'defense-objective-check';
    check.textContent = d.anomalies.length ? '待核对：' + d.anomalies.join('；') : '未发现明显状态冲突。若仍无法推进，可复制诊断反馈。';
    const report = JSON.stringify({ schema: 1, feature: 'defense-objective-20261123', capturedAt: new Date().toISOString(),
      build: import.meta.env.DEV ? 'development' : 'production', module: new URL(import.meta.url).pathname.split('/').pop(),
      viewport: { width: innerWidth, height: innerHeight }, target: d.target, gateReason: d.gate, anomalies: d.anomalies, ...d.diagnostic }, null, 2);
    const area = document.createElement('textarea'); area.className = 'defense-objective-report'; area.readOnly = true;
    area.setAttribute('aria-label', '守城诊断信息'); area.value = report; area.hidden = true;
    const feedback = document.createElement('p'); feedback.className = 'defense-objective-feedback'; feedback.setAttribute('role', 'status');
    feedback.textContent = '仅含本局状态，不包含完整存档或联机凭证。';
    const actions = document.createElement('footer');
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = '复制诊断';
    copy.onclick = async () => {
      let copied = false;
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(report); copied = true; } } catch { /* 局域网HTTP可手动复制 */ }
      if (!layer.isConnected) return;
      if (!copied) { area.hidden = false; area.focus(); area.select(); try { copied = document.execCommand('copy'); } catch { /* 保留选中的文本 */ } }
      feedback.textContent = copied ? '诊断已复制，可发给开发者排查。' : '无法自动复制，请长按或按 Ctrl+C 复制下方文本。';
    };
    const back = document.createElement('button'); back.type = 'button'; back.textContent = '返回战斗'; back.className = 'defense-objective-return'; back.onclick = () => this.close();
    actions.append(copy, back); card.append(h, sub, target, gate, list, check, feedback, actions, area); layer.append(card); document.body.append(layer);
    window.addEventListener('keydown', this.key, true); back.focus();
  }
  private close(): void {
    this.layer?.remove(); this.layer = undefined; window.removeEventListener('keydown', this.key, true);
    const resume = this.resume; this.resume = undefined; resume?.(); this.next = 0;
    if (!this.closed) { this.update(0); if (!this.chip.hidden) this.chip.focus(); }
  }
  destroy(): void {
    if (this.closed) return; this.closed = true;
    this.resume = undefined; this.layer?.remove(); this.layer = undefined;
    window.removeEventListener('keydown', this.key, true); this.chip.remove();
  }
}
