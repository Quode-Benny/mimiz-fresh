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
  const source=await readFile(existsSync(resolve(__dirname,'001_initial.sql'))?resolve(__dirname,'001_initial.sql'):resolve(projectRoot,'apps/api/src/database/001_initial.sql'),'utf8');
  await this.transaction(async client => {await client.query('SELECT pg_advisory_xact_lock(7234169)');await client.query(source);await client.query("INSERT INTO schema_migrations(name) VALUES('001_initial') ON CONFLICT DO NOTHING");});
 }
 async close(){await this.pool.end();}
}
