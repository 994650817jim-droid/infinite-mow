import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {cp,mkdtemp,mkdir,readFile,readdir,realpath,rm,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const repo=resolve(import.meta.dirname,'..');
const reportPath=process.argv[2];
const root=await mkdtemp(join(tmpdir(),'infinite-mow-process-audit-'));
const ctl=join(root,'control'), profile=join(root,'profile'), other=join(root,'other-profile');
const runtime=join(root,'runtime'),appPath=join(root,'app');
for(const dir of [ctl,profile,other,appPath])await mkdir(dir);
await cp(resolve(repo,'node_modules/electron/dist'),runtime,{recursive:true});
await cp(join(import.meta.dirname,'desktop-instance-window.cjs'),join(appPath,'main.cjs'));
await writeFile(join(appPath,'package.json'),JSON.stringify({name:'infinite-mow',version:'0.1.0',main:'main.cjs'}));
await writeFile(join(profile,'save.json'),JSON.stringify({audit_seed:'seed'}));
await writeFile(join(other,'save.json'),JSON.stringify({audit_seed:'other'}));
const filename=(slot,event)=>join(ctl,slot+'.'+event+'.json');
const exists=async p=>{try{await stat(p);return true;}catch{return false;}};
const active=[], statuses={};
function launch(slot,directory=profile){
  const env={...process.env,IM_AUDIT_PROJECT:repo,IM_AUDIT_SLOT:slot,IM_AUDIT_CONTROL:ctl,IM_USER_DATA:directory,IM_STEAM_APPID:'0',IM_WINDOWED:'1',IM_SAFE_GPU:'1',IM_TEST:'1'};
  delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(join(runtime,'electron.exe'),[appPath,'--mute-audio'],{cwd:appPath,windowsHide:true,env,stdio:'ignore'});
  active.push(child);
  child.on('exit',(code,signal)=>{statuses[slot]={code,signal};});
  return child;
}
async function readMarker(slot,event,timeout=45000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(await exists(filename(slot,'error')))throw Error(await readFile(filename(slot,'error'),'utf8'));
    if(await exists(filename(slot,event)))return JSON.parse(await readFile(filename(slot,event),'utf8'));
    if(statuses[slot])throw Error(slot+' exited before '+event+' '+JSON.stringify(statuses[slot]));
    await delay(30);
  }
  throw Error('Timed out waiting for '+slot+'/'+event);
}
const signal=(slot,event)=>writeFile(join(ctl,slot+'.'+event),'');
const disk=async directory=>Object.fromEntries(Object.entries(JSON.parse(await readFile(join(directory,'save.json'),'utf8'))).filter(([key])=>key.startsWith('audit_')));
try{
  launch('first');const first=await readMarker('first','ready');assert.equal(first.initial,'seed');assert(!first.visible);
  const secondAt=Date.now();launch('second');
  await readMarker('first','second-instance');await readMarker('first','focus');
  const end=Date.now()+30000;while(!statuses.second&&Date.now()<end)await delay(20);
  const lifecycleFiles=(await readdir(ctl)).filter(name=>name.startsWith('second.lifecycle-'));
  const lifecycle=Object.fromEntries(await Promise.all(lifecycleFiles.map(async name=>[name,JSON.parse(await readFile(join(ctl,name),'utf8')).at-secondAt])));
  assert.equal(statuses.second?.code,0,'Second process must exit. Lifecycle (ms): '+JSON.stringify(lifecycle));
  const secondExitMs=Date.now()-secondAt;
  assert.equal(await exists(filename('second','window')),false);
  launch('third',other);
  const third=await readMarker('third','ready');assert.equal(third.initial,'other');assert(!third.visible);
  assert.notEqual(first.pid,third.pid);
  await Promise.all(['first','third'].map(slot=>signal(slot,'write')));
  const [firstAck,thirdAck]=await Promise.all(['first','third'].map(slot=>readMarker(slot,'written')));
  assert.deepEqual(firstAck,{audit_seed:'seed',audit_first:'1'});
  assert.deepEqual(thirdAck,{audit_seed:'other',audit_third:'1'});
  assert.deepEqual(await disk(profile),firstAck);assert.deepEqual(await disk(other),thirdAck);
  const result={first,third,secondExit:statuses.second,secondExitMs,lifecycle,secondWindowCreated:false,focusRequested:true,firstAck,thirdAck,isolatedDirectories:true};
  console.log(JSON.stringify(result,null,2));
  if(reportPath)await writeFile(reportPath,JSON.stringify(result,null,2)+'\n');
}finally{
  await Promise.all(['first','second','third'].map(slot=>signal(slot,'quit')));
  const end=Date.now()+2500;while(active.some(p=>p.exitCode===null&&p.signalCode===null)&&Date.now()<end)await delay(20);
  for(const p of active)if(p.exitCode===null&&p.signalCode===null)p.kill();
  const tempRoot=await realpath(tmpdir()), owned=await realpath(root);
  assert.equal(dirname(owned),tempRoot);assert(basename(owned).startsWith('infinite-mow-process-audit-'));
  await rm(owned,{recursive:true,force:true,maxRetries:6,retryDelay:250});
}
