import {pool,transaction} from './db';
import {bootstrap,bootstrapInput} from './bootstrap-service';
try{await transaction(db=>bootstrap(db,bootstrapInput.parse({name:process.env.PHARMACY_NAME,username:process.env.BOOTSTRAP_OWNER_USERNAME,password:process.env.BOOTSTRAP_OWNER_PASSWORD})));console.log('Initialized an empty pharmacy and owner account. No demo data created. Profile/tax confirmation is required.')}finally{await pool.end()}
