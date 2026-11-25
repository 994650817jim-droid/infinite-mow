import './gauntletCampaignPanel.css';

interface CampaignPanel {
  theme:'mortal'|'ghost'|'divine'; title:string; subtitle:string; stats:string[];
  chapterArt?:string; portrait?:string;
  details?:{label:string; body:string}[];
  bosses?:{name:string; image?:string}[];
  actions:{label:string; run:()=>void}[];
}

/** One owned dialog per scene. Both keyboard and touch call the same original game actions. */
export function campaignPanel(owner:Phaser.Scene, data:CampaignPanel):()=>void {
  const dialog=document.createElement('dialog');
  dialog.className='campaign-gate '+data.theme;
  const sheet=document.createElement('article');
  const add=(tag:string,content:string,parent:HTMLElement=sheet)=>{
    const el=document.createElement(tag);el.textContent=content;parent.append(el);return el;
  };
  if(data.chapterArt)sheet.style.setProperty('--chapter-art','url("'+data.chapterArt+'")');
  if(data.portrait){
    const art=document.createElement('img');art.className='commander';art.alt='';art.src=data.portrait;sheet.append(art);
  }
  const story=add('section','');
  const title=add('h2',data.title,story);title.id='gauntlet-dialog-heading';dialog.setAttribute('aria-labelledby',title.id);
  add('p',data.subtitle,story);
  const stats=add('ul','',story);
  for(const line of data.stats)add('li',line,stats);
  if(data.bosses?.length){
    const defeated=add('details','',story);add('summary','已击败名将 · '+data.bosses.length,defeated);
    const roster=add('div','',defeated);roster.className='roster';
    for(const b of data.bosses){
      const item=add('span','',roster);
      if(b.image){const img=document.createElement('img');img.src=b.image;img.alt='';item.append(img);}
      add('small',b.name,item);
    }
  }
  for(const d of data.details??[]){const item=add('details','',story);add('summary',d.label,item);add('p',d.body,item);}
  const foot=add('footer','');
  function close(){
    owner.events.off('shutdown',close);dialog.remove();
  }
  for(const action of data.actions){
    const btn=add('button',action.label,foot) as HTMLButtonElement;
    btn.type='button';btn.addEventListener('click',()=>{if(dialog.isConnected){close();action.run();}});
  }
  dialog.addEventListener('cancel',e=>e.preventDefault());
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  dialog.append(sheet);document.body.append(dialog);dialog.showModal();
  owner.events.once('shutdown',close);
  return close;
}
