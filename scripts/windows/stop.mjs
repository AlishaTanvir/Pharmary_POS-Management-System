import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
const app=dirname(fileURLToPath(import.meta.url)),data=readFileSync(join(app,'data-location.txt'),'utf8').trim();const env=dotenv.parse(readFileSync(join(data,'.env')));
const response=await fetch('http://127.0.0.1:'+env.PORT+'/_control/stop',{method:'POST',headers:{'X-Control-Token':env.LOCAL_CONTROL_TOKEN}});if(!response.ok)throw Error('Service refused shutdown. No process was killed.');console.log('Graceful shutdown requested; wait for supervisor.lock to disappear before restarting or upgrading.');
