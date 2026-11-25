const {app} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { IM_AUDIT_CONTROL: control, IM_AUDIT_SLOT: slot, IM_USER_DATA: profile, IM_AUDIT_PROJECT: project } = process.env;
const marker = (event, value) => fs.writeFileSync(path.join(control,slot+'.'+event+'.json'),JSON.stringify(value));
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const writeKey = 'audit_'+slot;
for(const event of ['ready','before-quit','will-quit','quit']){
  app.on(event,()=>marker('lifecycle-'+event,{at:Date.now(),pid:process.pid}));
}
app.on('second-instance',()=>marker('second-instance',{pid:process.pid}));
app.on('browser-window-created',(_event,window)=>{
  marker('window',true);
  window.show = () => marker('showSuppressed',true);
  window.showInactive = () => {};
  window.focus = () => marker('focus',true);
  window.webContents.setAudioMuted(true);
  window.webContents.once('did-finish-load',async()=>{
    try{
      const save=await window.webContents.executeJavaScript('window.imDesktop.store.path()');
      if(path.resolve(save)!==path.join(profile,'save.json'))throw Error('Unexpected profile');
      const initial=await window.webContents.executeJavaScript("window.localStorage.getItem('audit_seed')");
      marker('ready',{pid:process.pid,initial,visible:window.isVisible()});
      while(!fs.existsSync(path.join(control,slot+'.write')))await delay(25);
      const result=await window.webContents.executeJavaScript(
        "window.localStorage.setItem("+JSON.stringify(writeKey)+",'1');window.imDesktop.store.load()");
      marker('written',Object.fromEntries(Object.entries(result).filter(([key])=>key.startsWith('audit_'))));
      while(!fs.existsSync(path.join(control,slot+'.quit')))await delay(25);
      app.quit();
    }catch(error){marker('error',String(error));app.exit(2);}
  });
});
require(path.join(project,'electron/main.cjs'));
