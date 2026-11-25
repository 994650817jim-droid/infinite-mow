// A page keeps its own lease until navigation, crash or tab close. Each document gets a new id.
type PageLease = { id:string; registration?:Promise<void> };
const page = globalThis as typeof globalThis & { __imBattlePageLease?: PageLease };
// Vite can load a freshly timestamped module next to an earlier copy in the same document.
const lease: PageLease = page.__imBattlePageLease ??= {
  id:Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join(''),
};
export const battlePageOwner = lease.id;
const leaseKey = (id:string) => 'im-battle-page-'+id;

function register(): Promise<void> {
  const key = leaseKey(battlePageOwner);
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  if (navigator.locks) {
    return new Promise((ready, reject) => {
      void navigator.locks.request(key, () => new Promise<void>(release => {
        window.addEventListener('pagehide', () => release(), {once:true});
        ready();
      })).catch(reject);
    });
  }
  return new Promise((ready,reject) => {
    const request=indexedDB.open(key,1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result;
      window.addEventListener('pagehide',()=>{db.close();indexedDB.deleteDatabase(key);},{once:true});
      ready();
    };
  });
}

export function registerBattlePage(): Promise<void> {
  return lease.registration ??= register();
}

export async function battleOwnerActive(owner: unknown): Promise<boolean> {
  if (typeof owner!=='string' || !/^[a-f0-9]{32}$/.test(owner)) return false;
  const key=leaseKey(owner);
  if (navigator.locks) return navigator.locks.request(key,{ifAvailable:true},lock=>lock===null);
  // A blocked deletion certifies an open owner connection, even for a backgrounded page.
  // Other probes may queue behind it. Treat an inconclusive probe as live.
  return new Promise(resolve => {
    const timer=window.setTimeout(()=>resolve(true),1200);
    const finish=(live:boolean)=>{clearTimeout(timer);resolve(live);};
    const request=indexedDB.deleteDatabase(key);
    request.onsuccess=()=>finish(false);
    request.onblocked=()=>finish(true);
    request.onerror=()=>finish(true);
  });
}
