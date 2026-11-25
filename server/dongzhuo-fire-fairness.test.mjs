import test from 'node:test';
import assert from 'node:assert/strict';
import { insideDongzhuoFire } from '../src/data/dongzhuoFire.ts';

test('Dong Zhuo fire uses the projected foot position on both axes', () => {
  for (const [dx,dy,hit] of [[0,0,true],[50,0,true],[0,30,true],[0,-31,false],[51,0,false],[40,18,true],[40,19,false]]) {
    assert.equal(insideDongzhuoFire(120+dx,260+dy,120,260,50),hit);
  }
});
