import {randomBytes} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import {pool,transaction} from '../server/db';
const env=await readFile('.env','utf8');if((env.match(/^CASHIER_PASSWORD=/gm)||[]).length!==1)throw Error('Expected one demo cashier credential entry.');
const password=randomBytes(32).toString('base64url');
try{await transaction(async db=>{const user=(await db.query("SELECT id FROM users WHERE username='cashier' FOR UPDATE")).rows[0];if(!user)throw Error('Demo cashier not found.');await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[await bcrypt.hash(password,12),user.id]);await db.query('DELETE FROM sessions WHERE user_id=$1',[user.id])});await writeFile('.env.rotation.tmp',env.replace(/^CASHIER_PASSWORD=.*$/m,'CASHIER_PASSWORD='+password),{flag:'wx',mode:0o600});await rename('.env.rotation.tmp','.env');console.log('Demo cashier credential rotated and sessions revoked. No credential value printed.')}finally{await pool.end()}
