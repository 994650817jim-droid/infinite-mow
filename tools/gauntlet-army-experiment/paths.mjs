import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
export const evidenceDir=resolve(process.env.GAUNTLET_ARMY_EVIDENCE??import.meta.dirname);
const previous=resolve(evidenceDir,'../../gauntlet-experience/solo/challenge.json');
export const historyFile=process.env.GAUNTLET_ARMY_HISTORY??(existsSync(previous)?previous:join(import.meta.dirname,'sample-baseline.json'));
await mkdir(evidenceDir,{recursive:true});
