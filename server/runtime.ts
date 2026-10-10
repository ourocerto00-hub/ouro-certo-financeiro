/** Railway/Node runtime. Persistent data lives under DATA_DIR mounted to a Railway Volume. */
import { DatabaseSync } from 'node:sqlite';
import {mkdirSync, readFileSync, existsSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
const base=resolve(process.env.DATA_DIR || './data');
mkdirSync(base,{recursive:true});
const db=new DatabaseSync(join(base,'ouro-certo.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
const migration=resolve(process.cwd(),'drizzle','0000_watery_sage.sql');
// Migration is applied idempotently once; never drop user data on deploy.
if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='auth_users'").get()){
 const sql=readFileSync(migration,'utf8').replaceAll('--> statement-breakpoint','\n');
 db.exec(sql);
}
class Statement {
 private sql:string; private args:any[];
 constructor(sql:string,args:any[]=[]){this.sql=sql;this.args=args;}
 bind(...args:any[]){return new Statement(this.sql,args);}
 async first(){return db.prepare(this.sql).get(...this.args)??null;}
 async all(){return {results:db.prepare(this.sql).all(...this.args)};}
 async run(){const info=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(info.changes)}};}
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
