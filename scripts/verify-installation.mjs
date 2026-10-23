import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {unlink,readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
loadEnvFile('.env');if(process.env.NODE_ENV==='production')throw new Error('Installation rehearsal is development-only.');
const requireApi=createRequire(resolve('apps/api/package.json'));const {Pool}=requireApi('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const name='mimiz_install_'+Date.now();if(!/^mimiz_install_[0-9]+$/.test(name))throw new Error('Invalid isolated target.');
const url=new URL(process.env.DATABASE_URL);url.pathname='/'+name;
const file=join(tmpdir(),name+'-owner.txt'),password=randomBytes(32).toString('base64url');
function run(command){const result=spawnSync(process.execPath,['scripts/database.mjs',command],{env:{...process.env,DATABASE_URL:url.toString(),COMPANY_NAME:'Installation rehearsal',OWNER_EMAIL:'installation@example.invalid',OWNER_PASSWORD:password,PROVISION_CREDENTIALS_FILE:file},windowsHide:true,encoding:'utf8'});if(result.status)throw new Error('Isolated '+command+' failed: '+result.stderr);}
let isolated;
try{await pool.query('CREATE DATABASE '+name);run('migrate');run('migrate');run('provision');
 isolated=new Pool({connectionString:url.toString(),max:1});
 const row=(await isolated.query("SELECT (SELECT count(*) FROM schema_migrations)::int AS migrations,(SELECT count(*) FROM companies)::int AS companies,(SELECT count(*) FROM users WHERE role='super_admin')::int AS owners,(SELECT count(*) FROM branches)::int AS branches,(SELECT count(*) FROM orders)::int AS orders")).rows[0];
 if(row.migrations!==10||row.companies!==1||row.owners!==1||row.branches!==0||row.orders!==0)throw new Error('Unexpected installation contents.');
 if((await readFile(file,'utf8')).split('\n')[1]!==password)throw new Error('Private owner credential file did not match.');
 console.log('Installation rehearsal passed: ten migrations, idempotent rerun, one owner/company, no demo kitchens or orders.');
}finally{if(isolated)await isolated.end();await pool.query('DROP DATABASE IF EXISTS '+name);await pool.end();await unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});}
