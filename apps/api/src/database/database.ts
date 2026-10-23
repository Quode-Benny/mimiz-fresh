import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {existsSync} from 'node:fs';
import {projectRoot} from '../config';
export type Queryable = Pick<Pool,'query'> | Pick<PoolClient,'query'>;
export class Database {
 readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
 readonly orm = drizzle(this.pool);
 async query<T extends QueryResultRow = Record<string,any>>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await this.pool.query<T>(text, values)).rows;
 }
 async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client=await this.pool.connect();
  try { await client.query('BEGIN'); const result=await work(client); await client.query('COMMIT');return result; }
  catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
 }
 async migrate() {
  for(const name of ['001_initial','002_operations','003_workspace_security','004_notifications','005_chat','006_staff_security','007_company_settings','008_photo_deletions','009_assistant','010_delivery_chat']){
   const file=name+'.sql';
   const source=await readFile(existsSync(resolve(__dirname,file))?resolve(__dirname,file):resolve(projectRoot,'apps/api/src/database',file),'utf8');
   await this.transaction(async client=>{await client.query('SELECT pg_advisory_xact_lock(7234169)');if(name!=='001_initial'&&(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount)return;await client.query(source);await client.query('INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING',[name]);});
  }
 }
 async close(){await this.pool.end();}
}
