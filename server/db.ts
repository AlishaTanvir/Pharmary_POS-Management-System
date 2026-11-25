import 'dotenv/config';
import pg from 'pg';
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:3000,query_timeout:10000});
pool.on('error',error=>console.error('PostgreSQL connection lost:',error.message));
export async function transaction<T>(work:(db:pg.PoolClient)=>Promise<T>):Promise<T>{const db=await pool.connect();try{await db.query('BEGIN');const result=await work(db);await db.query('COMMIT');return result}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}}
