/** Railway/Node runtime. Persistent data lives under DATA_DIR mounted to a Railway Volume. */
import { DatabaseSync } from 'node:sqlite';
import {mkdirSync, readFileSync, existsSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
const base=resolve(process.env.DATA_DIR || './data');
let database:DatabaseSync|null=null;
function getDatabase():DatabaseSync {
 if(database)return database;
 mkdirSync(base,{recursive:true});
 const db=new DatabaseSync(join(base,'ouro-certo.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 try {
  // Only create missing schema objects; preserve existing financial history.
  const statements=[
   `CREATE TABLE IF NOT EXISTS revisions (revision integer PRIMARY KEY NOT NULL,request_id text NOT NULL,state text NOT NULL,actor text NOT NULL,operation text NOT NULL,created_at text NOT NULL,justification text DEFAULT '' NOT NULL)`,
   `CREATE UNIQUE INDEX IF NOT EXISTS revisions_request_id_unique ON revisions(request_id)`,
   `CREATE TABLE IF NOT EXISTS auth_users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','financeiro')),salt TEXT NOT NULL,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1)`,
   `CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES auth_users(id),expires_at INTEGER NOT NULL)`,
   `CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at)`
  ];
  db.exec('BEGIN IMMEDIATE');
  try{for(const statement of statements)db.exec(statement);db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  database=db;
  return db;
 }catch(error){db.close();throw error;}
}
class Statement {
 private sql:string; private args:any[];
 constructor(sql:string,args:any[]=[]){this.sql=sql;this.args=args;}
 bind(...args:any[]){return new Statement(this.sql,args);}
 async first(){return getDatabase().prepare(this.sql).get(...this.args)??null;}
 async all(){return {results:getDatabase().prepare(this.sql).all(...this.args)};}
 async run(){const info=getDatabase().prepare(this.sql).run(...this.args);return {meta:{changes:Number(info.changes)}};}
}
const DB={prepare(sql:string){return new Statement(sql);}};
const storage=join(base,'uploads');mkdirSync(storage,{recursive:true});
const BUCKET={
 async put(key:string,bytes:Uint8Array,opts:any){
  if(!/^[0-9a-f-]{36}$/i.test(key))throw Error('Invalid attachment key');
  writeFileSync(join(storage,key),bytes,{flag:'wx'});
  writeFileSync(join(storage,key+'.json'),JSON.stringify({httpMetadata:opts?.httpMetadata,customMetadata:opts?.customMetadata}),{flag:'wx'});
 },
 async get(key:string){
  if(!/^[0-9a-f-]{36}$/i.test(key)||!existsSync(join(storage,key)))return null;
  const metadata=JSON.parse(readFileSync(join(storage,key+'.json'),'utf8'));
  return {...metadata,body:new Uint8Array(readFileSync(join(storage,key)))};
 }
};
export const env={DB,BUCKET,get BOOTSTRAP_SECRET(){return process.env.BOOTSTRAP_SECRET||'';}};
