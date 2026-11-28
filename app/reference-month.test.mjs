import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,summary,balance,cashSummary,referenceMonth,paidRecords} from './engine.mjs';
import {selectPaid} from './paid-view.mjs';
import {selectBills} from './bills-view.mjs';
import {createReport} from './reports.mjs';
import {buildPDF} from './pdf-v13.mjs';
import {monthlyReport} from './management.mjs';

const actor='reference-test@example.invalid',ref='2026-12',day='2026-11-22';
const act=(s,op,v)=>apply(s,op,v,actor);
function fixture(){const s=initial();s.accounts.forEach(a=>{a.opening=1000000;a.date='2026-01-01';});return s;}
const expense={date:day,referenceMonth:ref,account:'pay',direction:'out',amount:'50',unit:'u1',category:'c3',description:'Anúncio de teste'};
const bill={date:'2026-11-30',referenceMonth:ref,amount:'200',unit:'u1',category:'c0',name:'Locação de teste'};
const employee={name:'Funcionário de teste',role:'Comprador',salary:'1000',unit:'u1',admission:'2026-01-01',month:ref};
function checkEquation(s,month=ref){for(const unit of ['all',...s.units.map(u=>u.id)]){const t=summary(s,month,unit);assert.equal(t.pending,t.total-t.paid);assert.equal(t.advances,paidRecords(s).filter(p=>p.referenceMonth===month&&p.kind==='advance'&&(unit==='all'||p.unit===unit)).reduce((n,p)=>n+p.value,0));}}

test('Pix de novembro com referência dezembro conta no custo e pago de dezembro; caixa usa novembro',()=>{
 const s=act(fixture(),'movement',expense),m=s.movements[0];
 assert.equal(m.date,day);assert.equal(m.referenceMonth,ref);assert.ok(m.createdAt);
 assert.equal(summary(s,ref).total,5000);assert.equal(summary(s,ref).paid,5000);assert.equal(summary(s,ref).pending,0);
 assert.equal(summary(s,'2026-11').total,0);assert.equal(summary(s,'2026-11').paid,0);
 assert.equal(cashSummary(s,'pay',day).exits,5000);assert.equal(cashSummary(s,'pay',ref+'-01').exits,0);
 assert.equal(balance(s,'pay'),995000);checkEquation(s);
});

test('vencimento, referência e pagamento externo podem ser três períodos diferentes sem duplicar custo',()=>{
 const before=fixture(),s=act(before,'bill',{...bill,paymentSource:'external',paymentDate:'2027-01-05'});
 assert.equal(s.bills[0].date,'2026-11-30');assert.equal(s.bills[0].referenceMonth,ref);
 assert.equal(summary(s,ref).total,20000);assert.equal(summary(s,ref).paid,20000);assert.equal(summary(s,ref).pending,0);
 assert.equal(summary(s,'2026-11').total,0);assert.equal(summary(s,'2027-01').paid,0);
 assert.equal(paidRecords(s)[0].date,'2027-01-05');assert.equal(paidRecords(s)[0].referenceMonth,ref);
 assert.equal(selectBills(s,{month:ref}).length,1);assert.equal(selectPaid(s,{month:ref}).length,1);
 assert.equal(selectPaid(s,{month:ref,from:'2026-12-01',to:'2026-12-31'}).length,0);
 assert.deepEqual(s.movements,before.movements);assert.equal(balance(s,'pay'),1000000);checkEquation(s);
});

test('parcelas internas e externas de meses diferentes abatem uma única obrigação de referência',()=>{
 let s=act(fixture(),'bill',bill),id=s.bills[0].id;
 s=act(s,'paybill',{id,amount:'75',account:'pay',date:day});
 s=act(s,'paybill',{id,amount:'50',paymentSource:'external',date:'2027-01-10'});
 assert.equal(summary(s,ref).total,20000);assert.equal(summary(s,ref).paid,12500);assert.equal(summary(s,ref).pending,7500);
 assert.equal(balance(s,'pay'),992500);checkEquation(s);
 const cash=balance(s,'pay');s=act(s,'cancel',{table:'externalPayments',id:s.externalPayments[0].id,reason:'Parcela duplicada no teste'});
 assert.equal(summary(s,ref).paid,7500);assert.equal(summary(s,ref).pending,12500);assert.equal(balance(s,'pay'),cash);checkEquation(s);
});

test('salário, comissão, vale antecipado e salário pago depois fecham mensal menos pago sem duplicação',()=>{
 let s=act(fixture(),'employee',employee),p=s.payroll[0];
 s=act(s,'movement',expense);s=act(s,'bill',{...bill,paymentSource:'external',paymentDate:day});
 s=act(s,'advance',{employee:p.employee,month:ref,date:day,amount:'100',description:'Adiantamento de teste',account:'pay'});
 assert.equal(summary(s,ref).total,125000);assert.equal(summary(s,ref).paid,35000);assert.equal(summary(s,ref).advances,10000);checkEquation(s);
 s=act(s,'grams',{id:p.id,grams:'10'});s=act(s,'confirmSalary',{id:p.id});
 s=act(s,'paySalary',{id:p.id,amount:'250',date:'2027-01-05',account:'pay'});
 assert.equal(summary(s,ref).total,135000);assert.equal(summary(s,ref).paid,60000);assert.equal(summary(s,ref).pending,75000);
 assert.equal(summary(s,'2027-01').paid,0);assert.equal(cashSummary(s,'pay','2027-01-05').exits,25000);
 const paid=selectPaid(s,{month:ref});assert.equal(paid.length,4);assert.equal(paid.filter(p=>p.kind==='advance').length,1);checkEquation(s);
});

test('adiantamento superior à remuneração conhecida mantém diferença negativa e aguarda comissão',()=>{
 let s=act(fixture(),'employee',{...employee,salary:'0',compensationType:'grams_only'}),p=s.payroll[0];
 s=act(s,'advance',{employee:p.employee,month:ref,date:day,amount:'100',description:'Adiantamento de comissão',account:'pay'});
 assert.equal(summary(s,ref).total,0);assert.equal(summary(s,ref).paid,10000);assert.equal(summary(s,ref).pending,-10000);checkEquation(s);
 s=act(s,'grams',{id:p.id,grams:'30'});assert.equal(summary(s,ref).total,30000);assert.equal(summary(s,ref).pending,20000);checkEquation(s);
});

test('mudar a data real não desloca referência; lançamento automático não aceita data fornecida pelo cliente',()=>{
 const before=Date.now();let s=act(fixture(),'movement',{...expense,createdAt:'1900-01-01T00:00:00Z'}),m=s.movements[0];
 assert.ok(Date.parse(m.createdAt)>=before);assert.ok(Date.parse(m.createdAt)<=Date.now());const created=m.createdAt;
 s=act(s,'editExpense',{id:m.id,date:'2026-11-25',amount:'50',description:m.description,unit:m.unit,category:m.category,reason:'Corrigir dia real',createdAt:'2100-01-01T00:00:00Z'});
 assert.equal(s.movements[0].createdAt,created);assert.equal(s.movements[0].referenceMonth,ref);assert.equal(summary(s,ref).paid,5000);
 assert.equal(cashSummary(s,'pay',day).exits,0);assert.equal(cashSummary(s,'pay','2026-11-25').exits,5000);
});

test('leitura legada preserva referência histórica, não inventa pagamento ou horário e não escreve migração',()=>{
 const s=fixture();s.movements=[{id:'legacy',account:'pay',date:'2026-12-01',amount:-5000,unit:'u1',category:'c3',kind:'expense',description:'Legado'}];
 const old=structuredClone(s);const report=createReport(s,1,{month:ref});
 assert.equal(referenceMonth(s.movements[0]),ref);assert.equal(summary(s,ref).paid,5000);assert.match(JSON.stringify(report),/Não registrado \(legado\)/);assert.deepEqual(s,old);
 const edited=act(s,'editExpense',{id:'legacy',date:day,amount:'50',unit:'u1',category:'c3',description:'Legado',reason:'Conferir data real'});
 assert.equal(edited.movements[0].referenceMonth,ref);assert.equal(edited.movements[0].createdAt,undefined);assert.equal(edited.movements[0].date,day);
});

test('recorrências seguem referência, preservam deslocamento do vencimento e não replicam quitação',()=>{
 let s=act(fixture(),'bill',{...bill,recurring:true,paymentSource:'external',paymentDate:day});
 s=act(s,'period',{month:'2027-01'});s=act(s,'period',{month:'2027-01'});
 assert.equal(s.bills.length,2);assert.equal(s.bills[1].referenceMonth,'2027-01');assert.equal(s.bills[1].date,'2026-12-30');
 assert.notEqual(s.bills[1].createdAt,undefined);assert.equal(s.externalPayments.length,1);
 assert.equal(summary(s,'2027-01').total,20000);assert.equal(summary(s,'2027-01').paid,0);checkEquation(s,'2027-01');
});

test('referência inválida rejeita toda operação e cliente não altera horário do registro de contas ou vales',()=>{
 const s=fixture(),snapshot=structuredClone(s);
 for(const referenceMonth of ['2026-13','2026-1','',null]){
  // null keeps old clients compatible; malformed explicit strings are rejected.
  if(referenceMonth===null)continue;
  assert.throws(()=>act(s,'movement',{...expense,referenceMonth}));assert.throws(()=>act(s,'bill',{...bill,referenceMonth}));assert.deepEqual(s,snapshot);
 }
 const b=act(s,'bill',{...bill,createdAt:'1900-01-01'});assert.notEqual(b.bills[0].createdAt,'1900-01-01');
 let e=act(s,'employee',employee);e=act(e,'advance',{employee:e.employees[0].id,month:ref,date:day,amount:'10',description:'Vale teste',account:'pay',createdAt:'1900-01-01'});
 assert.notEqual(e.advances[0].createdAt,'1900-01-01');assert.equal(e.advances[0].createdAt,e.movements[0].createdAt);
});

test('tabela, PDFs e resumo usam referência e preservam datas reais e data do lançamento',()=>{
 let s=act(fixture(),'movement',expense);s=act(s,'bill',{...bill,paymentSource:'external',paymentDate:day});const old=structuredClone(s);
 const billReport=createReport(s,0,{month:ref}),paidReport=createReport(s,1,{month:ref}),costReport=createReport(s,5,{month:ref}),general=createReport(s,9,{month:ref});
 assert.equal(billReport.sections[0].rows.length,1);assert.equal(paidReport.sections[0].rows.length,2);
 assert.match(billReport.sections[0].rows[0][0],/2026-12.*30\/11\/2026/);assert.match(paidReport.sections[0].rows[0][0],/2026-12.*22\/11\/2026/);
 assert.match(JSON.stringify(paidReport),/Lançamento:/);assert.equal(general.stats[0].value,general.stats[1].value);assert.match(general.stats[2].value,/0,00/);
 assert.ok(costReport.sections.some(section=>section.total==='TOTAL: R$\u00a0250,00'));
 for(const report of [billReport,paidReport,costReport,general])assert.match(Buffer.from(buildPDF('Teste da referência',report)).toString('latin1'),/2026-12/);
 assert.deepEqual(s,old);
 const cash=createReport(s,3,{month:'2026-11',account:'pay'});
 assert.match(JSON.stringify(cash),/22\/11\/2026/);assert.match(JSON.stringify(cash),/Referência: 2026-12/);assert.match(JSON.stringify(cash),/Lançamento:/);
});

test('pagamento de vale acompanha unidade da folha para conciliar cartões por unidade sem reescrever caixa',()=>{
 let s=act(fixture(),'employee',employee);s=act(s,'advance',{employee:s.employees[0].id,month:ref,date:day,amount:'100',description:'Vale de teste',account:'pay'});
 s=act(s,'employee',{...employee,id:s.employees[0].id,unit:'u2'});
 assert.equal(s.movements[0].unit,'u1');assert.equal(summary(s,ref,'u1').paid,0);assert.equal(summary(s,ref,'u2').paid,10000);assert.equal(summary(s,ref,'u2').total,100000);checkEquation(s);
});

test('PDF de fechamento legado mantém valores salvos e identifica regra de pagamento anterior',()=>{
 const s=fixture();s.managementMonths=[{month:ref,status:'closed',version:1,history:[{operation:'managementClose',version:1,cost:20000,gross:40000,grams:10000,source:{total:20000,paid:12345,unconfirmedPayroll:0,pendingGrams:0},closedAt:'2026-12-10T12:00:00Z',closedBy:actor}]}];
 const before=structuredClone(s),report=monthlyReport(s,ref);assert.match(JSON.stringify(report),/regra anterior/);assert.ok(JSON.stringify(report).includes('123,45'));assert.deepEqual(s,before);
});
