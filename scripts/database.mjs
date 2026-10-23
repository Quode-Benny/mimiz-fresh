import {createRequire} from 'node:module';
import {loadEnvFile} from 'node:process';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
try{loadEnvFile(resolve(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const requireApi=createRequire(resolve(root,'apps/api/package.json'));
const {Pool}=requireApi('pg'),argon2=requireApi('argon2');
const command=process.argv[2];
if(!['migrate','provision'].includes(command))throw new Error('Use node scripts/database.mjs migrate | provision. Provision requires COMPANY_NAME and OWNER_EMAIL.');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
try{
 const client=await pool.connect();
 try{
  const directory=resolve(root,'apps/api/src/database');
  for(const file of (await readdir(directory)).filter(name=>/^\d{3}_[a-z_]+\.sql$/.test(name)).sort()){
   const name=file.slice(0,-4);await client.query('BEGIN');
   try{await client.query('SELECT pg_advisory_xact_lock(7234169)');const exists=(await client.query("SELECT to_regclass('public.schema_migrations') AS present")).rows[0].present;
    if(!exists||!(await client.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount){await client.query(await readFile(resolve(directory,file),'utf8'));await client.query('INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING',[name]);}
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}
   console.log('Migration checked: '+name);
  }
  if(command==='provision'){
   const name=process.env.COMPANY_NAME?.trim(),email=process.env.OWNER_EMAIL?.trim().toLowerCase();
   if(!name||name.length<2||name.length>100||!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Set a valid COMPANY_NAME (2-100 characters) and OWNER_EMAIL.');
   const password=process.env.OWNER_PASSWORD||randomBytes(32).toString('base64url');if(password.length<16)throw new Error('OWNER_PASSWORD must be at least 16 characters.');
   const credentialPath=resolve(root,process.env.PROVISION_CREDENTIALS_FILE||'.provisioned-owner');
   await writeFile(credentialPath,email+'\n'+password+'\n',{flag:'wx',mode:0o600});
   await client.query('BEGIN');
   try{await client.query('SELECT pg_advisory_xact_lock(7234170)');
    if((await client.query("SELECT id FROM users WHERE role='super_admin' LIMIT 1")).rowCount)throw new Error('An owner already exists. Provisioning never replaces existing accounts.');
    if((await client.query('SELECT id FROM companies LIMIT 1')).rowCount)throw new Error('A company already exists. Review the existing installation before provisioning.');
    await client.query('INSERT INTO companies(id,name) VALUES($1,$2)',[randomUUID(),name]);
    await client.query("INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,'super_admin',$4)",[randomUUID(),email,'Restaurant owner',await argon2.hash(password)]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');console.error('Provisioning did not complete. The private credentials file was retained for inspection.');throw error;}
   console.log('Company and owner provisioned. Credentials saved privately. No sample kitchen, menu, or customer data was inserted.');
  }
 }finally{client.release();}
}finally{await pool.end();}
