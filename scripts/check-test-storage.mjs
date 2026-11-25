import {statfs} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function checkTestStorage(minimum=3){
 if(!Number.isFinite(minimum)||minimum<.5)throw Error('Use a test-storage budget of at least 0.5 GiB.');
 const disk=await statfs(process.cwd()),free=Number(disk.bavail)*Number(disk.bsize)/1024**3;
 if(free<minimum)throw Error(`Retained qualification fixtures need at least ${minimum} GiB free; ${free.toFixed(2)} GiB is available. Reclaim disposable cache or archive/compress stopped test fixtures. Never delete application data to bypass this check.`);
 console.log(`Test storage preflight: ${free.toFixed(2)} GiB free; ${minimum} GiB minimum.`);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await checkTestStorage(Number(process.argv[2]||3));
