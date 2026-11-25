import {localStore} from '../../server/local-store';
import {synchronizeLocal} from '../../server/offline-routes';
import {finishDevice} from '../../server/offline-service';
import {pool,transaction} from '../../server/db';
await synchronizeLocal(true);const store=localStore();const configuration=store.configuration();if(configuration&&store.state(configuration.snapshot.device_id).phase!=='FINISHED'){const c=store.beginFinish();await transaction(db=>finishDevice(db,c.snapshot.device_id,c.secret));store.finished();console.log('Retained test invoices synchronized; unused stock released.')}else console.log('No active retained test counter.');store.close();await pool.end();
