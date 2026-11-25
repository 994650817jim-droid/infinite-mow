import type { Fighter, Foe, ServerMessage } from './protocol';
export type BattleSnapshot = Extract<ServerMessage, {type:'state'}>;
type Sample = { state: BattleSnapshot; ms: number; arrived: number; foes: Map<number,Foe>; party: Map<number,Fighter> };

/** Small presentation-only buffer. Server hit tests, inputs and rescue timers stay authoritative. */
export class SnapshotTimeline {
  private frames: Sample[] = [];
  private cursor = -Infinity;
  clear(): void { this.frames.length = 0; this.cursor = -Infinity; }
  push(state: BattleSnapshot, arrived: number): void {
    const prev = this.frames.at(-1);
    const ms = state.battleMs ?? state.seconds * 1000;
    if (prev && (ms < prev.ms || state.gauntlet.wave < prev.state.gauntlet.wave)) return;
    // A suspended browser or a reconnect can have a long arrival gap with little battle time elapsed.
    // Start from the authoritative pose in both cases; blending across the outage replays stale cues.
    if (prev && (prev.state.gauntlet.wave !== state.gauntlet.wave || ms-prev.ms>550 || arrived-prev.arrived>550)) this.clear();
    if (this.frames.at(-1)?.ms === ms) this.frames.pop();
    this.frames.push({state,ms,arrived,foes:new Map(state.enemies.map(e=>[e.id,e])),party:new Map(state.players.map(p=>[p.slot,p]))});
    if (this.frames.length>8) this.frames.shift();
  }
  sample(now: number) {
    const latest=this.frames.at(-1);
    if (!latest) return null;
    this.cursor=Math.max(this.frames[0].ms,this.cursor,Math.min(latest.ms,latest.ms-110+Math.max(0,now-latest.arrived)));
    while (this.frames.length>1 && this.frames[1].ms<=this.cursor) this.frames.shift();
    const a=this.frames[0], b=this.frames[1]??a;
    return {a,b,latest,ms:this.cursor,mix:b===a?0:(this.cursor-a.ms)/(b.ms-a.ms)};
  }
}
