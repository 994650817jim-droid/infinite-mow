import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const [archive,base,...heroes]=process.argv.slice(2);
const seeds={zhangfei:177,huangzhong:91173};
const runner=fileURLToPath(new URL('run.mjs',import.meta.url));
const chosen=heroes.length?heroes:Object.keys(seeds);
if(!archive||!base||chosen.some(h=>!seeds[h])||!process.env.GAUNTLET_ARMY_EVIDENCE)throw Error('Set GAUNTLET_ARMY_EVIDENCE and supply archive path, local URL, optional heroes');
const work=chosen.flatMap(hero=>['army','personal'].map(build=>new Promise((done,reject)=>{
  const args=[runner,resolve(archive),hero,String(seeds[hero]),build,'guard',hero+'-'+build,base];
  const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});
  child.once('error',reject);child.once('exit',code=>done({hero,build,code}));
})));
const result=await Promise.all(work);
console.log(result);
if(result.some(r=>r.code!==0))process.exitCode=1;
