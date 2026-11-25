import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
/** Isolated loopback server and two clients. Only encounter setup is accelerated. */
export async function pairedBattle(version,run){
  const rooms=new Map(),server=createCoopServer({rooms,gauntletWarmup:300,reconnectMs:8000});
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const host='127.0.0.1:'+server.http.address().port,clients=[];
  async function connect(){
    const ws=new WebSocket('ws://'+host+'/coop-socket',{origin:'http://'+host});clients.push(ws);
    const messages=[];ws.on('message',packet=>messages.push(JSON.parse(packet)));await once(ws,'open');
    return {ws,send:msg=>ws.send(JSON.stringify(msg)),async read(check){
      const until=Date.now()+6000;while(Date.now()<until){const i=messages.findIndex(check);if(i>=0)return messages.splice(0,i+1).pop();await new Promise(r=>setTimeout(r,12));}
      throw Error('expected room message timed out');
    }};
  }
  try{
    const a=await connect();a.send({type:'create',heroes:['zhuge'],starDraft:version});
    const session=await a.read(m=>m.type==='session'),room=rooms.get(session.code);
    const b=await connect();b.send({type:'join',code:session.code,heroes:['guanyu'],starDraft:version});
    await b.read(m=>m.type==='session');a.send({type:'pickHero',hero:'zhuge'});b.send({type:'pickHero',hero:'guanyu'});
    await a.read(m=>m.picks?.every(p=>p.hero));a.send({type:'start'});await a.read(m=>m.type==='state');
    await run({a,b,room,session,connect});
  }finally{for(const ws of clients)ws.terminate();await server.close();}
}
