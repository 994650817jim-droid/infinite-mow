import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
// Exercise the actual Electron IPC handlers with an in-memory disk, including rename failure.
const src=readFileSync('electron/main.cjs','utf8');
const handlers=src.slice(src.indexOf('let store = null;'),src.indexOf('let win = null;'));
assert.ok(handlers.includes("ipcMain.on('store:replace'"));
function boot(initial){
  const files=new Map(initial===undefined?[]:[['save.json',initial]]), ipc=new Map();
  let diskFull=false;
  runInNewContext(handlers,{SAVE_FILE:()=>'save.json',path:{dirname},ipcMain:{on:(k,f)=>ipc.set(k,f)},
    fs:{mkdirSync(){},readFileSync(f){if(!files.has(f))throw Object.assign(Error(),{code:'ENOENT'});return files.get(f);},
      writeFileSync:(f,v)=>files.set(f,v),renameSync(f,to){if(diskFull)throw Error('disk full');files.set(to,files.get(f));files.delete(f);}}});
  return {call(k,...args){const e={};ipc.get('store:'+k)(e,...args);return e.returnValue;},files,setFull:v=>diskFull=v};
}
for(const content of ['{broken','null','[]']) {
  const disk=boot(content);assert.equal(disk.call('load'),false);assert.equal(disk.files.get('save.json'),content);
}
const fresh=boot();assert.equal(fresh.call('load'),null);
const disk=boot('{"hero":"赵云"}');assert.equal(disk.call('load').hero,'赵云');disk.setFull(true);
for(const [op,...args] of [['set','hero','关羽'],['remove','hero'],['replace',{hero:'黄忠'}]]) {
  assert.equal(disk.call(op,...args),false);assert.equal(disk.call('load').hero,'赵云');assert.equal(disk.files.get('save.json'),'{"hero":"赵云"}');
}
disk.setFull(false);assert.equal(disk.call('set','food','8'),true);
assert.deepEqual(JSON.parse(disk.files.get('save.json')),{hero:'赵云',food:'8'});
console.log('PASS Electron storage handlers: missing vs unreadable, 3 interrupted writes, retry preserving prior progress.');
