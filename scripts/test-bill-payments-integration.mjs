// Fresh local SQLite database only. Never connects to the production service or volume.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {balance,billPaid,summary,today} from '../app/engine.mjs';
import {billStatus} from '../app/bills-view.mjs';
import {selectPaid} from '../app/paid-view.mjs';

const port=process.env.BILL_TEST_PORT||'3135',base=`http://127.0.0.1:${port}`,origin='https://ouro-certo.test';
await mkdir('work',{recursive:true});
const dataDir=await mkdtemp(resolve('work/bill-payments-http-'));
const secret=randomUUID(),password=randomUUID()+'Aa1!',email='bill-test@example.invalid';
let server,cookie='',revision=0,state;
async function start(){
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',port],{stdio:['ignore','pipe','pipe'],env:{...process.env,DATA_DIR:dataDir,APP_URL:origin,BOOTSTRAP_SECRET:secret}});
 let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 for(let i=0;i<150;i++){
  if(server.exitCode!==null)throw Error(logs);
  try{await fetch(base+'/login');return;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Servidor isolado não iniciou: '+logs);
}
async function stop(){if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}}
async function call(path,body){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
 return {status:r.status,data};
}
async function op(op,input){
 const body={op,input,revision,requestId:randomUUID()},r=await call('/api/state',body);
 assert.equal(r.status,200,JSON.stringify(r.data));state=r.data.state;revision=r.data.revision;return body;
}
async function rejected(op,input,match){
 const before=structuredClone(state),rev=revision;
 const r=await call('/api/state',{op,input,revision,requestId:randomUUID()});assert.equal(r.status,400);if(match)assert.match(r.data.error,match);
 const saved=await call('/api/state');assert.equal(saved.data.revision,rev);assert.deepEqual(saved.data.state,before);
}
try{
 await start();assert.equal((await call('/api/state')).status,401);
 let r=await call('/api/auth/bootstrap',{email,password,name:'Financeiro de teste',secret});assert.equal(r.status,200);
 // Exercise the financial role as well as the existing administrator access.
 r=await call('/api/auth/users',{email:'financeiro@example.invalid',password,role:'financeiro',name:'Financeiro teste'});assert.equal(r.status,200);
 for(const [email,name] of [['gerente@example.invalid','Gerente teste'],['usuario@example.invalid','Usuário teste']]){
  r=await call('/api/auth/users',{email,password,role:'financeiro',name});assert.equal(r.status,200);
 }
 r=await call('/api/state');state=r.data.state;revision=r.data.revision;
 const day=today(),month=day.slice(0,7);
 await op('account',{id:'pay',name:'Caixa de teste',purpose:'pay',opening:'10000',date:month+'-01'});
 const accounts=structuredClone(state.accounts),gold=balance(state,'gold');
 await call('/api/auth/logout',{});cookie='';r=await call('/api/auth/login',{email:'financeiro@example.invalid',password});assert.equal(r.status,200);
 const input={name:'Energia teste',description:'Fatura teste isolado',amount:'1000',unit:'u1',category:'c1',date:day};
 const body=await op('bill',{...input,paymentSource:'external',paymentDate:day,externalOrigin:'Banco fora do sistema'}),externalId=state.bills.at(-1).id,paymentId=state.externalPayments[0].id;
 assert.equal(balance(state,'pay'),1000000);assert.equal(balance(state,'gold'),gold);assert.deepEqual(state.accounts,accounts);assert.equal(state.movements.length,0);assert.equal(billStatus(state,state.bills[0]),'Paga (externamente)');
 const repeats=await Promise.all([1,2,3].map(()=>call('/api/state',body)));
 for(const repeated of repeats){assert.equal(repeated.status,200);assert.equal(repeated.data.revision,revision);assert.equal(repeated.data.state.externalPayments.length,1);assert.equal(repeated.data.state.bills.length,1);}
 await rejected('paybill',{id:externalId,amount:'1',date:day,account:'pay'},/saldo pendente/);
 await rejected('bill',{...input,paymentSource:'external',paymentDate:day,account:'pay'},/conta financeira interna/);
 const pendingBody=await op('bill',{...input,name:'Obrigação pendente'}),pendingId=state.bills.at(-1).id;
 assert.equal(balance(state,'pay'),1000000);assert.equal(state.movements.length,0);assert.equal(summary(state,month).pending,100000);
 r=await call('/api/state',{...pendingBody,requestId:randomUUID()});assert.equal(r.status,409);
 await op('paybill',{id:pendingId,paymentSource:'external',amount:'400',date:day});assert.equal(balance(state,'pay'),1000000);assert.equal(billPaid(state,state.bills.at(-1)),40000);
 const internal=await op('paybill',{id:pendingId,amount:'600',date:day,account:'pay'});
 assert.equal(balance(state,'pay'),940000);assert.equal(state.movements.length,1);assert.equal(billStatus(state,state.bills.at(-1)),'Paga (mista)');assert.equal(summary(state,month).total,200000);assert.equal(summary(state,month).paid,200000);assert.equal(summary(state,month).pending,0);assert.equal(selectPaid(state,{month}).length,3);
 r=await call('/api/state',internal);assert.equal(r.status,200);assert.equal(r.data.revision,revision);assert.equal(r.data.state.movements.length,1);assert.equal(balance(r.data.state,'pay'),940000);
 await rejected('paybill',{id:pendingId,amount:'1',date:day,account:'pay'},/saldo pendente/);
 const persisted=structuredClone(state),savedRevision=revision;
 await stop();await start();r=await call('/api/state');assert.equal(r.status,200);assert.deepEqual(r.data.state,persisted);assert.equal(r.data.revision,savedRevision);
 await rejected('cancel',{table:'externalPayments',id:paymentId,reason:''},/justificativa/);
 const cancellation=await op('cancel',{table:'externalPayments',id:paymentId,reason:'Registro externo duplicado no teste'});
 assert.equal(balance(state,'pay'),940000);assert.equal(state.movements.length,1);assert.equal(summary(state,month).paid,100000);assert.equal(summary(state,month).pending,100000);assert.equal(state.externalPayments[0].cancelledBy,'financeiro@example.invalid');
 r=await call('/api/state',cancellation);assert.equal(r.status,200);assert.equal(r.data.revision,revision);
 r=await call('/api/state?audit');assert.equal(r.data.events[0].operation,'cancel');assert.equal(r.data.events[0].justification,cancellation.input.reason);
 r=await call('/api/state?revision='+revision);assert.ok(!r.data.before.externalPayments[0].cancelled);assert.equal(r.data.after.externalPayments[0].cancelled,true);
 await op('cancel',{table:'bills',id:externalId,reason:'Obrigação duplicada no teste'});assert.equal(summary(state,month).total,100000);assert.equal(summary(state,month).pending,0);assert.equal(balance(state,'pay'),940000);
 const futureDate=`${Number(day.slice(0,4))+1}-12-10`,futureMonth=futureDate.slice(0,7);
 const logins=[{email,role:'admin'},...['financeiro','gerente','usuario'].map(name=>({email:name+'@example.invalid',role:'financeiro'}))];
 for(const [index,login] of logins.entries()){
  await call('/api/auth/logout',{});cookie='';r=await call('/api/auth/login',{email:login.email,password});assert.equal(r.status,200);
  r=await call('/api/state');assert.equal(r.status,200);assert.equal(r.data.role,login.role);state=r.data.state;revision=r.data.revision;
  const previousAccounts=structuredClone(state.accounts),previousMovements=structuredClone(state.movements),previousBalances=state.accounts.map(a=>balance(state,a.id));
  const futureInput={...input,name:'Conta de dezembro '+login.email,amount:'10',date:futureDate,paymentSource:'external',paymentDate:futureDate};
  const futureBody=await op('bill',futureInput),futureBill=state.bills.at(-1),futurePayment=state.externalPayments.at(-1);
  assert.equal(futureBill.date,futureDate);assert.equal(futurePayment.date,futureDate);assert.equal(futurePayment.actor,login.email);assert.equal(billStatus(state,futureBill),'Paga (externamente)');
  r=await call('/api/state',futureBody);assert.equal(r.status,200);assert.equal(r.data.revision,revision);assert.equal(r.data.state.externalPayments.length,state.externalPayments.length);
  await rejected('paybill',{id:futureBill.id,amount:'1',date:futureDate,account:'pay'},/saldo pendente/);
  await op('bill',{...input,name:'Parcelas de dezembro '+login.email,amount:'10',date:futureDate});const futurePending=state.bills.at(-1).id;
  await op('paybill',{id:futurePending,paymentSource:'external',amount:'4',date:futureDate});assert.equal(billStatus(state,state.bills.at(-1)),'Parcialmente paga (externamente)');
  await op('paybill',{id:futurePending,paymentSource:'external',amount:'6',date:futureDate});assert.equal(billStatus(state,state.bills.at(-1)),'Paga (externamente)');
  assert.deepEqual(state.accounts,previousAccounts);assert.deepEqual(state.movements,previousMovements);assert.deepEqual(state.accounts.map(a=>balance(state,a.id)),previousBalances);
  assert.equal(summary(state,futureMonth).total,(index+1)*2000);assert.equal(summary(state,futureMonth).paid,(index+1)*2000);assert.equal(summary(state,futureMonth).pending,0);assert.equal(selectPaid(state,{month:futureMonth}).length,(index+1)*3);
 }
 const futurePersisted=structuredClone(state),futureRevision=revision;
 await stop();await start();r=await call('/api/state');assert.equal(r.status,200);assert.deepEqual(r.data.state,futurePersisted);assert.equal(r.data.revision,futureRevision);
 // Cross-month reference survives HTTP, SQLite restart and duplicate requests.
 const nextDate=new Date(day+'T12:00:00Z');nextDate.setUTCMonth(nextDate.getUTCMonth()+1,1);const referenceMonth=nextDate.toISOString().slice(0,7);
 const previous=summary(state,referenceMonth),cashBefore=balance(state,'pay'),startedAt=Date.now();
 const referenceBody=await op('movement',{date:day,referenceMonth,account:'pay',direction:'out',amount:'12.34',unit:'u1',category:'c3',description:'Pix para o próximo mês',createdAt:'1900-01-01T00:00:00Z'});
 const referenceMovement=state.movements.at(-1),savedCreatedAt=referenceMovement.createdAt;
 assert.equal(referenceMovement.date,day);assert.equal(referenceMovement.referenceMonth,referenceMonth);assert.ok(Date.parse(savedCreatedAt)>=startedAt);assert.ok(Date.parse(savedCreatedAt)<=Date.now());
 assert.equal(balance(state,'pay'),cashBefore-1234);assert.equal(summary(state,referenceMonth).total,previous.total+1234);assert.equal(summary(state,referenceMonth).paid,previous.paid+1234);
 r=await call('/api/state',referenceBody);assert.equal(r.status,200);assert.equal(r.data.revision,revision);assert.equal(r.data.state.movements.at(-1).createdAt,savedCreatedAt);
 await op('bill',{...input,referenceMonth,name:'Conta do próximo mês',amount:'20',paymentSource:'external',paymentDate:day,createdAt:'1900-01-01'});
 assert.equal(state.bills.at(-1).referenceMonth,referenceMonth);assert.notEqual(state.bills.at(-1).createdAt,'1900-01-01');assert.equal(balance(state,'pay'),cashBefore-1234);
 await op('employee',{name:'Pessoa de teste',role:'Teste',salary:'100',compensationType:'fixed',unit:'u1',admission:month+'-01',month:referenceMonth});
 await op('advance',{employee:state.employees.at(-1).id,month:referenceMonth,date:day,account:'pay',amount:'10',description:'Vale antecipado',createdAt:'1900-01-01'});
 const totals=summary(state,referenceMonth);assert.equal(totals.total,previous.total+13234);assert.equal(totals.paid,previous.paid+4234);assert.equal(totals.pending,totals.total-totals.paid);assert.equal(totals.advances,previous.advances+1000);
 assert.notEqual(state.advances.at(-1).createdAt,'1900-01-01');assert.equal(state.advances.at(-1).createdAt,state.movements.at(-1).createdAt);
 assert.ok(selectPaid(state,{month:referenceMonth}).some(p=>p.id===referenceMovement.id&&p.date===day));
 await rejected('movement',{...referenceBody.input,referenceMonth:'2026-13'},/Mês inválido/);
 const referencePersisted=structuredClone(state),referenceRevision=revision;
 await stop();await start();r=await call('/api/state');assert.equal(r.status,200);assert.equal(r.data.revision,referenceRevision);assert.deepEqual(r.data.state,referencePersisted);
 console.log('Integração de contas aprovada: admin e acessos financeiros, gerente e usuário; datas futuras em novas contas e parcelas sem débito, competência de dezembro, idempotência, débito interno único, auditoria, cancelamento e persistência após reinício.');
 console.log('Referência mensal aprovada via HTTP e SQLite: Pix e vale antecipados, conta externa, horário automático inviolável, mensal menos pago, repetição segura e persistência após reinício.');
}finally{await stop();}
