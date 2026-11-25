import test from 'node:test';
import assert from 'node:assert/strict';
import {paintMythicRelease, clearMythicSignature} from '../src/systems/MythicSkillFx.ts';

function fixture() {
  const sprites = [];
  const scene = {add: {image: make}};
  function make() {
    const s = {scene, active:true, once(_event, fn) { this.onDestroy=fn; }, destroy(){ this.active=false; }};
    for (const key of ['Texture','Visible','Origin','Position','DisplaySize','Rotation','Alpha','Depth']) {
      s['set'+key] = function (...values) { s[key]=values; return s; };
    }
    sprites.push(s); return s;
  }
  return {root:make(),sprites};
}

test('aimed strikes use one undistorted motif per actual lane and reuse those sprites', () => {
  const {root,sprites}=fixture();
  const w={kind:'line',x:31,y:17,angle:.4,radius:225,halfWidth:21,lanes:3,spread:.28};
  for (const age of [.03,.10,.26]) {
    paintMythicRelease(root,'divine_zhaoyun',w,age);
    assert.equal(sprites.length,3);
    for (const [i,s] of sprites.entries()) {
      const heading=w.angle+(i-1)*w.spread;
      assert.deepEqual(s.Rotation,[heading]);assert.ok(s.Texture[1]<3);
      assert.equal(s.DisplaySize[0],s.DisplaySize[1]);
      assert.ok(Math.abs(Math.atan2(s.Position[1]-w.y,s.Position[0]-w.x)-heading)<1e-6);
    }
  }
  clearMythicSignature(root);assert.ok(sprites.every(s=>!s.Visible[0]));
  root.onDestroy();assert.ok(sprites.slice(1).every(s=>!s.active));
});

test('ring motifs leave the safe centre clear and stay inside the outer radius', () => {
  const {root,sprites}=fixture();
  const w={kind:'ring',x:20,y:30,angle:.4,radius:150,innerRadius:75};
  paintMythicRelease(root,'test-ring',w,.1);assert.equal(sprites.length,4);
  for (const s of sprites) {
    const d=Math.hypot(s.Position[0]-w.x,s.Position[1]-w.y);
    assert.ok(d-s.DisplaySize[0]/2>=w.innerRadius);assert.ok(d+s.DisplaySize[0]/2<=w.radius);
  }
});
