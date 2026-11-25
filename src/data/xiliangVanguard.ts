import map from './maps/xiliang-vanguard.json';

type CampObject = { x:number; y:number; name:string; properties?: {name:string;value:number}[]; polyline?: {x:number;y:number}[] };
const layer = (name: string): readonly CampObject[] => {
  const layer = map.layers.find(l => l.name === name);
  if (!layer) throw new Error('Missing western camp layer: '+name);
  return layer.objects;
};
const origin=layer('Origin')[0];
const points=(name: string) => layer(name).map(o=>[o.x-origin.x,o.y-origin.y] as const);
const props=[...layer('Palisades'),...layer('Supplies')].map(o=>{
  const properties='properties' in o ? o.properties : undefined;
  const frame=properties?.find(p=>p.name==='frame')?.value;
  const size=properties?.find(p=>p.name==='size')?.value;
  if(frame!==3 && frame!==4 && frame!==5 && frame!==6 && frame!==7 || !size) throw new Error('Invalid western camp prop: '+o.name);
  return {x:o.x-origin.x,y:o.y-origin.y,frame,size} as {x:number;y:number;frame:3|4|5|6|7;size:number};
});
const routes=layer('Routes').map(o=>{
  if(!('polyline' in o) || !o.polyline) throw new Error('Missing camp lane: '+o.name);
  return o.polyline.map(p=>({x:o.x-origin.x+p.x,y:o.y-origin.y+p.y}));
});
export const WESTERN_CAMP={wallY:points('Gate')[0][1],tents:points('Tents'),muster:points('Muster'),routes,props};
