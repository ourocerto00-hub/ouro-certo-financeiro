// Run against an isolated, empty test database. Never target a production service.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {balance,salaryDue,paidMovements,today} from '../app/engine.mjs';
const base=process.env.TEST_BASE_URL||'http://localhost:3133';
const origin=process.env.TEST_ORIGIN||'https://ouro-certo.test';
const secret=process.env.TEST_BOOTSTRAP_SECRET;
assert.ok(secret,'Defina TEST_BOOTSTRAP_SECRET e use um banco de teste vazio.');
let cookie='',revision=0,state;
async function call(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data};}
const email='v13-test@example.invalid',password=randomUUID()+'Aa1!';
let r=await call('/api/auth/bootstrap',{email,password,name:'Teste V13',secret});assert.equal(r.status,200,JSON.stringify(r.data));
r=await call('/api/state');assert.equal(r.status,200);state=r.data.state;
async function op(op,input){const body={op,input,revision,requestId:randomUUID()},r=await call('/api/state',body);assert.equal(r.status,200,JSON.stringify(r.data));state=r.data.state;revision=r.data.revision;return body;}
const day=today(),month=day.slice(0,7);
await op('account',{id:'pay',name:'Caixa teste',purpose:'pay',opening:'10000',date:month+'-01'});
await op('employee',{name:'João teste',role:'Comprador',unit:'u1',salary:'2500',admission:day,month});
await op('grams',{id:state.payroll[0].id,grams:'12,345'});
const body=await op('advance',{employee:state.employees[0].id,month,date:day,account:'pay',amount:'500',description:'Vale de teste'});
const before=revision;
const repeats=await Promise.all(Array.from({length:3},()=>call('/api/state',body)));
for(const r of repeats){assert.equal(r.status,200);assert.equal(r.data.revision,before);assert.equal(r.data.state.advances.length,1);assert.equal(paidMovements(r.data.state).length,1);}
assert.equal(balance(state,'pay'),950000);assert.equal(salaryDue(state,state.payroll[0]),212345);
r=await call('/api/state',{...body,requestId:randomUUID()});assert.equal(r.status,409);
await op('cancel',{table:'movements',id:state.movements[0].id,reason:'Estorno de teste'});assert.equal(balance(state,'pay'),1000000);assert.equal(paidMovements(state).length,0);assert.equal(salaryDue(state,state.payroll[0]),262345);
await op('advance',{employee:state.employees[0].id,month,date:day,account:'pay',amount:'500',description:'Vale correto'});
await op('confirmSalary',{id:state.payroll[0].id});await op('paySalary',{id:state.payroll[0].id,date:day,account:'pay',amount:'2123,45'});
assert.equal(salaryDue(state,state.payroll[0]),0);assert.equal(balance(state,'pay'),737655);assert.equal(paidMovements(state).length,2);
const concurrent=await Promise.all([1,2].map(()=>call('/api/state',{revision,requestId:randomUUID(),op:'movement',input:{account:'pay',date:day,direction:'in',amount:'1',description:'Aporte concorrente',origin:'Teste'}})));
assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
console.log('Integração HTTP aprovada: autenticação, vale único, 3 repetições idempotentes, revisão obsoleta, estorno, salário líquido e concorrência.');
