import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const {chromium}=createRequire(resolve('package.json'))('playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage();
  await page.route('**/storage-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));
  await page.goto(new URL('storage-fixture',process.env.BASE??'http://127.0.0.1:5216/').href);
  const results=await page.evaluate(async()=>{
    const slots=await import('/src/systems/SaveSlots.ts');
    const key='im_last_hero', meta='im_save_slots', bag='im_items_v2', target='im_slot_1';
    const a={ [key]:'zhaoyun',[bag]:'old items' }, b={ [key]:'guanyu',[bag]:'other items' };
    function fixture(failAt=0){
      const m=new Map(Object.entries({...a,[target]:JSON.stringify(b),music:'70'}));
      let n=0;
      function write(){if(++n===failAt)throw new DOMException('full','QuotaExceededError');}
      const s={getItem:k=>m.get(k)??null,setItem:(k,v)=>{write();m.set(k,String(v));},removeItem:k=>{write();m.delete(k);}};
      Object.defineProperty(window,'localStorage',{configurable:true,value:s});
      return m;
    }
    const rows=[];
    for(const fail of [1,2,3,4,5]){
      const m=fixture(fail);
      const switched=slots.switchSlot(1);
      rows.push({name:'写入失败 '+fail,ok:switched===false && slots.activeSlot()===0 && m.get(key)===a[key]&&m.get(bag)===a[bag]&&m.get(target)===JSON.stringify(b)});
    }
    let m=fixture();m.set(target,'invalid JSON');slots.switchSlot(1);
    rows.push({name:'损坏目标保留',ok:slots.activeSlot()===0&&m.get(key)===a[key]&&m.get(target)==='invalid JSON'});
    m=fixture();slots.switchSlot(1);const entered=slots.activeSlot()===1&&m.get(bag)===b[bag];slots.switchSlot(0);
    rows.push({name:'双向读回',ok:entered&&m.get(key)===a[key]&&m.get(bag)===a[bag]&&m.get('music')==='70'});
    if(slots.recoverSlotTransfer){
      m=fixture();m.set('im_slot_0',JSON.stringify(a));m.set('im_slot_transfer',JSON.stringify({from:0,to:1}));m.set(key,b[key]);
      slots.recoverSlotTransfer();
      rows.push({name:'提交前中断恢复',ok:slots.activeSlot()===0&&m.get(key)===a[key]&&m.get(target)===JSON.stringify(b)&&!m.has('im_slot_transfer')});
      m=fixture();m.set('im_slot_0',JSON.stringify(a));m.set('im_slot_transfer',JSON.stringify({from:0,to:1}));m.set(meta,JSON.stringify({active:1}));m.set(key,b[key]);m.set(bag,b[bag]);
      slots.recoverSlotTransfer();
      rows.push({name:'提交后中断恢复',ok:slots.activeSlot()===1&&m.get(key)===b[key]&&m.has('im_slot_0')&&!m.has('im_slot_transfer')});
    }
    return rows;
  });
  console.log(JSON.stringify(results));assert.ok(results.every(r=>r.ok));
}finally{await browser.close();}
