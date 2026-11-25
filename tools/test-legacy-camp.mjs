import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage();
try{
  const url=new URL(process.env.BASE??'http://127.0.0.1:5173/');
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  await page.route('**/camp-migration-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));
  await page.goto(new URL('camp-migration-fixture',url).href);
  const rows=await page.evaluate(async()=>{
    const w=await import('/src/world/WorldStore.ts'),t=await import('/src/town/TownData.ts');
    const results=[];
    const check=(name,ok)=>{if(!ok)throw Error(name);results.push(name);};
    const reset=source=>{localStorage.clear();if(source)localStorage.setItem(w.WORLD_KEY,JSON.stringify(source));};
    reset();const fresh=w.loadWorld();
    const {campLevelCeilings:_,...legacy}=fresh;
    function seed(version){
      const s={...legacy,version,provisions:5000,merits:30,buildings:{barracks:3,farm:2,clinic:3},nodes:['home','fort-old'],receipts:[{id:'old',merits:1,provisions:2}]};
      delete s.town;
      if(version>=8)s.town={levels:{hall:1,barracks:3,farm:2,academy:3,talent:3,stable:2,granary:2,pavilion:1},year:184,season:0};
      if(version===8){Object.assign(s.town.levels,{smithy:3,market:2});s.town.money=40;s.town.caravans=[{value:15}];}
      if(version>=9)s.town.tech=['medicine'];
      return s;
    }
    for(let version=1;version<=10;version++){
      reset(seed(version));const s=w.loadWorld(),lv=s.town.levels,food=s.provisions;
      check('v'+version+' earned levels and locked upgrades',lv.barracks===3&&lv.farm===2&&!w.townUpgrade('farm').ok&&w.loadWorld().provisions===food);
      check('v'+version+' preserved yield and economy',t.settleSeason(structuredClone(s.town),{troops:0,cities:[],provisionsHave:0}).grain===t.FARM_GRAIN[2]&&s.nodes.includes('fort-old')&&s.receipts[0].id==='old'&&food===5000+30*t.MERIT_TO_GRAIN+(version===8?Math.round(55*t.MONEY_TO_GRAIN)+t.v8Spent('market',2):0));
      if(version<8)check('v'+version+' converted clinic',s.town.tech.includes('medicine'));
      else check('v'+version+' all town buildings',lv.academy===3&&lv.talent===3&&lv.stable===2&&lv.granary===2&&lv.pavilion===1&&t.buildingBattleEffects(s.town).damage===.06);
      for(let i=0;i<3;i++){w.saveWorld();const a=w.loadWorld();check('v'+version+' idempotent '+i,JSON.stringify(a.town.levels)===JSON.stringify(lv)&&a.provisions===food&&JSON.stringify(a.campLevelCeilings)===JSON.stringify(s.campLevelCeilings)&&a.merits===0);}
    }
    reset(seed(3));const initial=w.loadWorld();w.saveWorld();
    check('first capture releases legacy ceiling',w.grantCity('sishui')&&w.loadWorld().town.levels.hall===2&&!Object.keys(w.loadWorld().campLevelCeilings).length);
    const cost=t.nextCost(w.loadWorld().town,'academy');
    check('actual paid upgrade after capture',w.townUpgrade('academy').ok&&w.loadWorld().town.levels.academy===2&&w.loadWorld().provisions===initial.provisions-cost);
    const high=seed(10);high.town.levels.hall=3;reset(high);
    check('old high hall cannot unlock paid upgrades before a capture',w.loadWorld().town.levels.hall===3&&!w.townUpgrade('farm').ok);
    const plots=seed(8);plots.town={plots:[{id:'farm',level:2},{id:'barracks',level:2},{id:'wall',level:1},{id:'post',level:1}]};reset(plots);
    const ps=w.loadWorld();check('legacy plots and converted defense',ps.town.levels.hall===2&&ps.town.levels.farm===2&&ps.town.levels.barracks===2&&ps.town.tech.includes('armor')&&!w.townUpgrade('farm').ok);
    reset();w.saveWorld();const normal=JSON.parse(localStorage.getItem(w.WORLD_KEY));
    check('fresh record has empty allowance',Object.keys(normal.campLevelCeilings).length===0&&!w.townUpgrade('farm').ok);
    normal.town.levels.farm=3;normal.town.levels.hall=3;reset(normal);
    check('new save cannot inherit unearned buildings',w.loadWorld().town.levels.farm===1&&w.loadWorld().town.levels.hall===1);
    const damaged=seed(8);delete damaged.town;reset(damaged);w.saveWorld();localStorage.setItem(w.WORLD_KEY,'{');
    check('backup migration preserves old building record',w.loadWorld().town.levels.barracks===3);
    reset(seed(3));localStorage.setItem('im_roster_v1',JSON.stringify({hall:3}));w.saveWorld();
    check('separate old recruitment hall stays earned after transfer',w.talentLevel()===3&&w.loadWorld().campLevelCeilings.talent===3);
    const changed=JSON.parse(localStorage.getItem(w.WORLD_KEY));changed.town.levels.farm=3;reset(changed);
    check('an earned ceiling cannot grow between reads',w.loadWorld().town.levels.farm===2);
    const lost=seed(10);lost.capturedEver=['sishui'];lost.town.levels.hall=2;lost.town.levels.farm=1;
    reset(lost);check('lost city keeps prior capture and ordinary paid upgrades',w.townUpgrade('farm').ok&&w.loadWorld().town.levels.farm===2);
    return results;
  });
  console.log(rows.join('\n'));console.log(rows.length+' passed');
}finally{await browser.close();}
