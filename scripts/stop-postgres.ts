import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import type EmbeddedPostgres from 'embedded-postgres';
export async function stopPostgres(db:EmbeddedPostgres,directory:string){
 if(process.platform==='win32'&&(db as any).process){await promisify(execFile)(resolve('node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'),['-D',resolve(directory),'-m','fast','-w','stop'],{windowsHide:true});(db as any).process=undefined;}
 else await db.stop();
}
