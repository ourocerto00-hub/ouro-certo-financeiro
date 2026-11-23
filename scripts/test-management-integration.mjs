// Only starts a loopback server with a fresh checkout-local SQLite database.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const port=process.env.MANAGEMENT_TEST_PORT||'3134',base=`http://127.0.0.1:${port}`,origin='https://ouro-certo.test';
await mkdir('work',{recursive:true});
const dataDir=await mkdtemp(resolve('work/management-http-'));
const secret=randomUUID(),password=randomUUID()+'Aa1!';
let server;
async function start(){
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',port],{stdio:['ignore','pipe','pipe'],env:{...process.env,DATA_DIR:dataDir,APP_URL:origin,BOOTSTRAP_SECRET:secret,FECHA_REAL_ADMIN_EMAIL:'admin@example.invalid'}});
 let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 for(let i=0;i<150;i++){
  if(server.exitCode!==null)throw Error(logs);
  try{await fetch(base+'/login');return;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Servidor isolado não iniciou: '+logs);
}
async function stop(){if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}}
async function request(path,{body,cookie='',requestOrigin=origin}={}){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const binary=r.headers.get('content-type')?.includes('application/pdf');
 return {status:r.status,data:binary?Buffer.from(await r.arrayBuffer()):await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
try{
 await start();
 assert.equal((await request('/api/state')).status,401);
 assert.equal((await request('/api/management/pdf?month=2026-10')).status,401);
 let res=await request('/api/auth/bootstrap',{body:{email:'admin@example.invalid',password,name:'André Victor',secret}});
 assert.equal(res.status,200,JSON.stringify(res.data));const admin=res.cookie;
 res=await request('/api/auth/users',{cookie:admin,body:{email:'financeiro@example.invalid',password,role:'financeiro',name:'Financeiro teste'}});assert.equal(res.status,200);
 res=await request('/api/auth/login',{body:{email:'financeiro@example.invalid',password}});assert.equal(res.status,200);const finance=res.cookie;
 res=await request('/api/auth/users',{cookie:admin,body:{email:'other-admin@example.invalid',password,role:'admin',name:'André Victor'}});assert.equal(res.status,200);
 res=await request('/api/auth/login',{body:{email:'other-admin@example.invalid',password}});assert.equal(res.status,200);const otherAdmin=res.cookie;
 for(const cookie of [finance,otherAdmin]){
  const r=await request('/api/state',{cookie});assert.equal(r.status,200);assert.equal(r.data.canManageReal,false);
  assert.equal((await request('/api/management/pdf?month=2026-10&mode=partial',{cookie})).status,403);
 }
 let revision=0,state;
 async function read(){const r=await request('/api/state',{cookie:admin});assert.equal(r.status,200);revision=r.data.revision;state=r.data.state;}
 await read();
 const seeded=await request('/api/state',{cookie:admin,body:{op:'period',input:{month:'2026-10'},revision,requestId:randomUUID()}});assert.equal(seeded.status,200);await read();
 const original=structuredClone(state);
 const input={month:'2026-10',grams:'1000,125',gross:'70000',cost:'100000',adjustment:'Valor exato conciliado externamente',reviewed:true,reason:'Conferência de fechamento mensal'};
 const body=(op,input)=>({op,input,revision,requestId:randomUUID()});
 const denied=body('managementClose',input);
 assert.equal((await request('/api/state',{cookie:finance,body:denied})).status,403);
 assert.equal((await request('/api/state',{cookie:admin,body:denied,requestOrigin:'https://invalid.example'})).status,400);
 let sent=body('managementPartial',input);
 for(const cookie of [finance,otherAdmin])assert.equal((await request('/api/state',{cookie,body:sent})).status,403);
 res=await request('/api/state',{cookie:admin,body:sent});assert.equal(res.status,200);await read();
 const partial=await request('/api/management/pdf?month=2026-10&mode=partial',{cookie:admin});assert.equal(partial.status,200);assert.ok(partial.data.toString('latin1').includes('PARCIAL - NÃO OFICIAL'));
 await writeFile(resolve(dataDir,'parcial.pdf'),partial.data);
 assert.equal((await request('/api/management/pdf?month=2026-10',{cookie:admin})).status,400);
 sent=body('managementClose',input);res=await request('/api/state',{cookie:admin,body:sent});assert.equal(res.status,200,JSON.stringify(res.data));await read();
 const closedRevision=revision;
 res=await request('/api/state',{cookie:admin,body:sent});assert.equal(res.status,200);assert.equal(res.data.revision,closedRevision);
 assert.equal((await request('/api/state',{cookie:admin,body:{...sent,requestId:randomUUID()}})).status,409);
 assert.equal((await request('/api/state',{cookie:admin,body:body('managementPartial',input)})).status,400);
 assert.equal((await request('/api/management/pdf?month=2026-10&version=1',{cookie:finance})).status,403);
 let pdf=await request('/api/management/pdf?month=2026-10&version=1',{cookie:admin});assert.equal(pdf.status,200);assert.ok(pdf.data.toString('latin1').includes('-R$ 30.000,00'));
 await writeFile(resolve(dataDir,'fechamento-negativo.pdf'),pdf.data);
 const reopen={month:'2026-10',reason:'Correção da receita matriz'};
 assert.equal((await request('/api/state',{cookie:finance,body:body('managementReopen',reopen)})).status,403);
 assert.equal((await request('/api/state',{cookie:admin,body:body('managementReopen',reopen)})).status,200);await read();
 pdf=await request('/api/management/pdf?month=2026-10&version=1',{cookie:admin});assert.ok(pdf.data.toString('latin1').includes('HISTÓRICO'));
 const concurrent=await Promise.all([1,2].map(()=>request('/api/state',{cookie:admin,body:body('managementClose',{...input,gross:'120000'})})));
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);await read();
 assert.equal(state.managementMonths[0].version,2);
 for(const key of Object.keys(original))assert.deepEqual(state[key],original[key],key);
 const finalRevision=revision;
 await stop();await start();await read();assert.equal(revision,finalRevision);assert.equal(state.managementMonths[0].gross,12000000);
 pdf=await request('/api/management/pdf?month=2026-10&version=2',{cookie:admin});assert.equal(pdf.status,200);assert.ok(pdf.data.toString('latin1').includes('+R$ 20.000,00'));
 await writeFile(resolve(dataDir,'fechamento-positivo.pdf'),pdf.data);
 res=await request('/api/state?audit',{cookie:admin});assert.equal(res.data.events[0].operation,'managementClose');assert.equal(res.data.events[0].justification,input.reason);
 const future='2099-12';
 async function managementOp(op,input){const r=await request('/api/state',{cookie:admin,body:body(op,input)});assert.equal(r.status,200,JSON.stringify(r.data));await read();}
 await managementOp('managementPartial',{month:future,grams:'100',gross:'700'});
 await managementOp('managementPartial',{month:future,grams:'200',gross:'1200'});
 const history=state.managementMonths.find(r=>r.month===future).history;
 const firstId=history[0].id,lastId=history[1].id;
 await managementOp('managementEditPartial',{month:future,entryId:firstId,grams:'150',gross:'900'});
 assert.equal(state.managementMonths.find(r=>r.month===future).gross,120000);
 await managementOp('managementDeletePartial',{month:future,entryId:lastId});
 assert.equal(state.managementMonths.find(r=>r.month===future).gross,90000);
 await stop();await start();await read();
 assert.equal(state.managementMonths.find(r=>r.month===future).gross,90000);
 await managementOp('managementDeletePartial',{month:future,entryId:firstId});
 assert.equal(state.managementMonths.find(r=>r.month===future).gross,null);
 assert.equal(state.managementMonths.find(r=>r.month==='2026-10').gross,12000000);
 await managementOp('managementClose',{...input,month:future});
 assert.equal(state.managementMonths.find(r=>r.month===future).status,'closed');
 for(const cookie of [finance,otherAdmin]){
  let r=await request('/api/state',{cookie});assert.equal(r.status,200);assert.equal(r.data.canManageReal,false);assert.ok(!('managementMonths' in r.data.state));assert.ok(!('managementAccumulated' in r.data.state));
  r=await request('/api/state?revision='+closedRevision,{cookie});
  for(const key of ['before','after'])if(r.data[key])assert.ok(!('managementMonths' in r.data[key]));
  r=await request('/api/state?audit',{cookie});assert.ok(r.data.events.every(e=>!e.operation.startsWith('management')));
  assert.equal((await request('/api/state',{cookie,body:sent})).status,403); // denied even for replayed owner requests
  for(const op of ['managementPartial','managementEditPartial','managementDeletePartial','managementAccumulated','managementEditAccumulated','managementDeleteAccumulated','managementClose','managementReopen'])assert.equal((await request('/api/state',{cookie,body:body(op,{month:future,canManageReal:true})})).status,403);
  assert.equal((await request('/api/management/pdf?month='+future+'&mode=partial',{cookie})).status,403);
  assert.equal((await request('/api/management/pdf?month='+future,{cookie})).status,403);
 }
 const unchanged=structuredClone(state.managementMonths),ordinary=body('period',{month:'2026-10'});
 res=await request('/api/state',{cookie:finance,body:ordinary});assert.equal(res.status,200);assert.ok(!('managementMonths' in res.data.state));const ordinaryRevision=res.data.revision;await read();assert.deepEqual(state.managementMonths,unchanged);
 res=await request('/api/state',{cookie:finance,body:ordinary});assert.equal(res.status,200);assert.ok(!('managementMonths' in res.data.state));assert.equal(res.data.revision,ordinaryRevision);await read();assert.equal(revision,ordinaryRevision);
 const owner=await request('/api/state',{cookie:admin});assert.equal(owner.data.canManageReal,true);assert.ok(owner.data.state.managementMonths.length>0);
 console.log('Integração mensal aprovada: login, papéis, origem, idempotência, concorrência, reabertura, auditoria, versões PDF, preservação dos módulos e persistência após reinício.');
 console.log('PDFs de teste: '+dataDir);
}finally{await stop();}
