import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,balance,paidMovements,summary,cashSummary} from './engine.mjs';
import {createReport} from './reports.mjs';
const act=(s,op,v)=>apply(s,op,v,'editor@example.invalid');
function fixture(){
 const s=initial();s.accounts.forEach(a=>{a.date='2026-10-01';a.opening=100000;});
 return act(s,'movement',{date:'2026-10-10',account:'pay',direction:'out',amount:'100',description:'Anúncio antigo',unit:'u0',category:'c3',attachment:{key:'original.pdf'}});
}
const input=s=>({id:s.movements[0].id,date:'2026-11-12',description:'Anúncio corrigido',unit:'u1',category:'c4',amount:'150,25',notes:'Correção conferida',reason:'Correção do lançamento'});
test('edição mantém uma única despesa paga e recalcula caixa, períodos, unidades e PDFs',()=>{
 const before=fixture(),old=before.movements[0],s=act(before,'editExpense',{...input(before),account:'gold',kind:'income',cancelled:true,bill:'fake',actor:'fake'}),m=s.movements[0];
 assert.equal(s.movements.length,1);assert.equal(paidMovements(s).length,1);
 assert.equal(m.id,old.id);assert.equal(m.account,old.account);assert.equal(m.actor,old.actor);assert.equal(m.kind,'expense');assert.equal(m.cancelled,undefined);assert.equal(m.bill,undefined);
 assert.deepEqual(m.attachment,old.attachment);assert.equal(m.amount,-15025);assert.equal(m.notes,'Correção conferida');assert.equal(m.editedBy,'editor@example.invalid');assert.ok(m.editedAt);assert.equal(m.editReason,input(before).reason);
 assert.equal(before.movements[0].amount,-10000);
 assert.equal(balance(s,'pay'),84975);assert.equal(balance(s,'gold'),100000);
 assert.equal(summary(s,'2026-10').paid,0);assert.equal(summary(s,'2026-11','u0').total,0);assert.equal(summary(s,'2026-11','u1').paid,15025);assert.equal(summary(s,'2026-11','u1').pending,0);
 assert.equal(cashSummary(s,'pay','2026-11-12').exits,15025);
 for(const index of [1,8]){const report=createReport(s,index,{month:'2026-11',unit:'u1'});assert.equal(report.sections[0].rows.length,1);assert.ok(JSON.stringify(report).includes('Anúncio corrigido'));assert.ok(JSON.stringify(report).includes('150,25'));}
 assert.deepEqual(s.bills,before.bills);assert.deepEqual(s.payroll,before.payroll);assert.deepEqual(s.advances,before.advances);
});
test('valida campos e não altera o estado quando rejeita a edição',()=>{
 const s=fixture(),snapshot=structuredClone(s);
 for(const patch of [{id:'ausente'},{date:'2026-02-30'},{date:'2026-09-30'},{amount:'0'},{amount:'-10'},{amount:'1,234'},{description:''},{unit:'ausente'},{category:'ausente'},{reason:''},{notes:'a'.repeat(501)}])assert.throws(()=>act(s,'editExpense',{...input(s),...patch}));
 s.units[1].active=false;assert.throws(()=>act(s,'editExpense',input(s)),/inativa/);s.units[1].active=true;
 s.categories[4].active=false;assert.throws(()=>act(s,'editExpense',input(s)),/inativa/);s.categories[4].active=true;
 assert.deepEqual(s,snapshot);
});
test('preserva cadastros inativos atuais e permite substituir comprovante explicitamente',()=>{
 const s=fixture();s.units[0].active=false;s.categories[3].active=false;
 const next=act(s,'editExpense',{...input(s),unit:'u0',category:'c3',attachment:{key:'novo.pdf'}});
 assert.equal(next.movements[0].unit,'u0');assert.deepEqual(next.movements[0].attachment,{key:'novo.pdf'});
});
test('recusa cancelamentos, outros pagamentos e movimentos com vínculos',()=>{
 for(const patch of [{cancelled:true},{kind:'bill'},{kind:'salary'},{kind:'advance'},{kind:'transfer'},{amount:10000},{bill:'b1'},{payroll:'p1'},{advance:'a1'},{transfer:'t1'},{account:'gold'}]){
  const s=fixture();Object.assign(s.movements[0],patch);assert.throws(()=>act(s,'editExpense',input(s)));
 }
});
test('protege o período original e o destino e respeita reabertura',()=>{
 for(const [closingDate,newDate] of [['2026-10-10','2026-11-12'],['2026-11-15','2026-11-12'],['2026-10-05','2026-10-03']]){
  const s=fixture();s.closings.push({id:'close',account:'pay',date:closingDate});
  assert.throws(()=>act(s,'editExpense',{...input(s),date:newDate}),/encerrado/);
  s.closings[0].reopened=true;assert.equal(act(s,'editExpense',{...input(s),date:newDate}).movements.length,1);
 }
});
