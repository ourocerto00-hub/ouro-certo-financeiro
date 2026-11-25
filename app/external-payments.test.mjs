import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,balance,billPaid,billExternalPaid,summary,cashSummary,paidMovements,paidRecords,today,money} from './engine.mjs';
import {selectBills,billStatus,billTotals} from './bills-view.mjs';
import {selectPaid} from './paid-view.mjs';
import {createReport} from './reports.mjs';
import {managementView} from './management.mjs';
import {buildPDF} from './pdf-v13.mjs';

const actor='financeiro@example.invalid',date='2025-10-10',month='2025-10';
const act=(s,op,input)=>apply(s,op,input,actor);
const input={name:'Energia da filial',description:'Fatura de energia outubro',unit:'u1',category:'c1',amount:'123,45',date};
function fixture(){const s=initial(actor);s.accounts.forEach(a=>{a.date='2020-01-01';a.opening=500000;});return s;}
const balances=s=>s.accounts.map(a=>balance(s,a.id));
const external=(s,overrides={})=>act(s,'bill',{...input,paymentSource:'external',paymentDate:date,externalOrigin:'Banco de fora',...overrides});

test('nova obrigação fica pendente e só debita uma vez ao pagar internamente',()=>{
 const before=fixture(),snapshot=structuredClone(before);let s=act(before,'bill',input);const b=s.bills[0];
 assert.deepEqual(balances(s),balances(before));assert.deepEqual(s.movements,[]);assert.equal(billPaid(s,b),0);
 assert.deepEqual(summary(s,month,'u1'),{total:12345,pending:12345,paid:0,advances:0,gold:500000,pay:500000});
 s=act(s,'paybill',{id:b.id,amount:'123,45',date,account:'pay'});
 assert.equal(balance(s,'pay'),487655);assert.equal(s.movements.length,1);assert.equal(billStatus(s,b),'Paga');
 assert.throws(()=>act(s,'paybill',{id:b.id,amount:'123,45',date,account:'pay'}),/saldo pendente/);
 assert.equal(summary(s,month).total,12345);assert.deepEqual(before,snapshot);
});

test('quitação externa integral tem registro auditável próprio e não cria movimento nem conta bancária',()=>{
 const before=fixture(),snapshot=structuredClone(before),s=external(before),b=s.bills[0],p=s.externalPayments[0];
 assert.deepEqual(balances(s),balances(before));assert.deepEqual(s.accounts,before.accounts);assert.deepEqual(s.movements,before.movements);
 assert.equal(p.amount,12345);assert.equal(p.date,date);assert.equal(p.unit,'u1');assert.equal(p.category,'c1');assert.equal(p.description,input.description);assert.equal(p.origin,'Banco de fora');assert.equal(p.actor,actor);assert.ok(p.id&&p.createdAt);assert.equal(p.bill,b.id);assert.ok(!('account' in p));
 assert.equal(billPaid(s,b),12345);assert.equal(billStatus(s,b),'Paga (externamente)');
 assert.equal(summary(s,month).pending,0);assert.equal(summary(s,month).paid,12345);assert.equal(summary(s,month).total,12345);
 assert.equal(paidMovements(s).length,0);assert.equal(paidRecords(s).length,1);
 assert.throws(()=>act(s,'paybill',{id:b.id,amount:'0.01',date,account:'pay'}),/saldo pendente/);
 assert.throws(()=>act(s,'paybill',{id:b.id,paymentSource:'external',amount:'0.01',date}),/saldo pendente/);
 assert.throws(()=>act(s,'bill',{...input,id:b.id,reason:'Alterar valor'}),/com pagamentos/);
 assert.throws(()=>act(s,'cancel',{table:'bills',id:b.id,reason:'Cancelar conta'}),/Cancele os pagamentos/);
 assert.deepEqual(before,snapshot);
});

test('valida origem, data real, valor, unidade e categoria sem deixar gravação parcial',()=>{
 const s=fixture(),snapshot=structuredClone(s),future=new Date(today()+'T00:00:00Z');future.setUTCDate(future.getUTCDate()+1);
 for(const overrides of [{paymentSource:'other'},{paymentDate:''},{paymentDate:'2025-02-30'},{paymentDate:future.toISOString().slice(0,10)},{amount:'0'},{amount:'-1'},{unit:'inexistente'},{category:'inexistente'},{account:'pay'},{externalOrigin:'x'.repeat(501)}]){
  assert.throws(()=>external(s,overrides));assert.deepEqual(s,snapshot);
 }
 const optional=external(s,{externalOrigin:''});assert.equal(optional.externalPayments[0].origin,'');
});

test('parcial externo e interno compartilham o limite; só a parcela interna reduz o caixa',()=>{
 let s=act(fixture(),'bill',input);const b=s.bills[0];
 s=act(s,'paybill',{id:b.id,paymentSource:'external',amount:'23,45',date,externalOrigin:'Sócio'});
 assert.equal(billStatus(s,b),'Parcialmente paga (externamente)');assert.equal(balance(s,'pay'),500000);assert.equal(summary(s,month).pending,10000);
 assert.throws(()=>act(s,'paybill',{id:b.id,amount:'101',date,account:'pay'}),/saldo pendente/);
 s=act(s,'paybill',{id:b.id,amount:'100',date,account:'pay'});
 assert.equal(billStatus(s,b),'Paga (mista)');assert.equal(billExternalPaid(s,b),2345);assert.equal(billPaid(s,b),12345);assert.equal(balance(s,'pay'),490000);assert.equal(summary(s,month).paid,12345);assert.equal(summary(s,month).total,12345);assert.equal(summary(s,month).pending,0);assert.equal(s.movements.length,1);
 s=act(s,'cancel',{table:'movements',id:s.movements[0].id,reason:'Estorno da parcela interna'});
 assert.equal(balance(s,'pay'),500000);assert.equal(billPaid(s,b),2345);
 s=act(s,'paybill',{id:b.id,paymentSource:'external',amount:'100',date});
 assert.equal(billStatus(s,b),'Paga (externamente)');assert.equal(balance(s,'pay'),500000);
});

test('cancelamento externo preserva auditoria, reabre obrigação e nunca estorna saldo interno',()=>{
 let s=external(fixture());const b=s.bills[0],p=s.externalPayments[0],before=balances(s);
 assert.throws(()=>act(s,'cancel',{table:'externalPayments',id:p.id,reason:''}),/justificativa/);
 s=act(s,'cancel',{table:'externalPayments',id:p.id,reason:'Lançamento externo incorreto'});
 assert.deepEqual(balances(s),before);assert.equal(s.externalPayments.length,1);assert.equal(s.externalPayments[0].cancelledBy,actor);assert.ok(s.externalPayments[0].cancelledAt);assert.equal(summary(s,month).paid,0);assert.equal(summary(s,month).pending,12345);assert.equal(paidRecords(s).length,0);assert.equal(paidRecords(s,{includeCancelled:true}).length,1);
 assert.throws(()=>act(s,'cancel',{table:'externalPayments',id:p.id,reason:'Outra vez'}),/já cancelado/);
 s=act(s,'cancel',{table:'bills',id:b.id,reason:'Cancelar obrigação duplicada'});
 assert.equal(summary(s,month).total,0);assert.equal(summary(s,month).pending,0);assert.equal(billStatus(s,s.bills[0]),'Cancelada');assert.deepEqual(s.movements,[]);
});

test('pagamento externo respeita competência do custo e data do pagamento nos KPIs e relatórios',()=>{
 const s=external(fixture(),{date:'2025-09-30'}),b=s.bills[0];
 assert.equal(summary(s,'2025-09').total,12345);assert.equal(summary(s,'2025-09').pending,0);assert.equal(summary(s,'2025-09').paid,0);
 assert.equal(summary(s,month).total,0);assert.equal(summary(s,month).paid,12345);assert.equal(billPaid(s,b),12345);
 assert.equal(managementView(s,'2025-09').cost,12345);assert.equal(managementView(s,month).source.paid,12345);
 assert.equal(selectBills(s,{month:'2025-09'}).length,1);assert.equal(selectPaid(s,{month}).length,1);
});

test('filtros, Contas Pagas, custos por filial, resumo e PDFs contam a despesa uma única vez',()=>{
 let s=external(fixture());s=external(s,{unit:'u0',category:'c0',amount:'10',externalOrigin:'Outra origem'});
 const filters={month,unit:'u1',category:'c1',source:'external',search:'Banco de fora',from:date,to:date};
 assert.equal(selectPaid(s,filters).length,1);assert.equal(selectPaid(s,{...filters,source:'internal'}).length,0);assert.equal(selectPaid(s,{...filters,from:'2025-10-01',to:'2025-10-09'}).length,0);
 assert.equal(selectBills(s,{month,search:'Banco de fora'}).length,1);
 const report=createReport(s,1,filters);assert.equal(report.sections[0].rows.length,1);assert.equal(report.sections[0].total,'TOTAL: '+money(12345));assert.ok(report.sections[0].rows[0][2].includes('Paga (externamente) / Origem externa / Banco de fora'));
 const pdf=Buffer.from(buildPDF('Contas Pagas',report)).toString('latin1');assert.ok(pdf.includes('Banco de fora'));assert.ok(pdf.includes('Paga \\(externamente\\)'));assert.ok(pdf.includes('TOTAL: R$ 123,45'));
 const bills=createReport(s,0,{month,unit:'u1'});assert.equal(bills.sections[0].rows[0][5],'Paga (externamente)');assert.deepEqual(billTotals(s,selectBills(s,{month,unit:'u1'})),{amount:12345,paid:12345,pending:0,cancelled:0});
 for(const index of [5,9]){const r=createReport(s,index,{month,unit:'u1'});assert.equal(r.sections[0].rows.length,1);assert.deepEqual(r.sections[0].rows[0].slice(-2),[money(12345),money(12345)]);assert.equal(r.stats[0].value,money(12345));}
 assert.equal(createReport(s,8,{month}).sections[0].rows.length,0);
});

test('caixas fechados e seus PDFs permanecem idênticos ao registrar ou cancelar pagamento externo',()=>{
 let s=fixture();s=act(s,'close',{account:'pay',date,real:'5000'});
 const cash=cashSummary(s,'pay',date),report=createReport(s,3,{month,from:date,to:date}),closing=structuredClone(s.closings);
 s=external(s);assert.deepEqual(cashSummary(s,'pay',date),cash);assert.deepEqual(s.closings,closing);assert.deepEqual(createReport(s,3,{month,from:date,to:date}).sections,report.sections);
 s=act(s,'cancel',{table:'externalPayments',id:s.externalPayments[0].id,reason:'Corrigir quitação'});assert.deepEqual(cashSummary(s,'pay',date),cash);
 assert.throws(()=>act(s,'paybill',{id:s.bills[0].id,amount:'1',date,account:'pay'}),/Período encerrado/);
});

test('recorrência paga externamente gera próxima obrigação pendente sem replicar quitação',()=>{
 let s=external(fixture(),{recurring:true});s=act(s,'period',{month:'2025-11'});s=act(s,'period',{month:'2025-11'});
 const next=s.bills.find(b=>b.date==='2025-11-10');assert.ok(next);assert.equal(billPaid(s,next),0);assert.equal(s.externalPayments.length,1);assert.equal(s.movements.length,0);assert.equal(summary(s,'2025-11').pending,12345);
});

test('estado legado sem coleção externa continua legível e não é migrado destrutivamente',()=>{
 const s=fixture(),before=structuredClone(s);assert.equal(s.externalPayments,undefined);assert.deepEqual(paidRecords(s),[]);assert.equal(summary(s,month).paid,0);assert.deepEqual(s,before);
 const next=external(s);assert.equal(next.externalPayments.length,1);assert.equal(s.externalPayments,undefined);assert.deepEqual(next.units,s.units);assert.deepEqual(next.categories,s.categories);assert.deepEqual(next.accounts,s.accounts);
});

test('quitação de conta legada sem descrição usa o nome original',()=>{
 const original=fixture();original.bills.push({id:'legacy',name:'Conta legada',amount:1000,date,unit:'u0',category:'c0'});
 const s=act(original,'paybill',{id:'legacy',paymentSource:'external',amount:'10',date});
 assert.equal(s.externalPayments[0].description,'Conta legada');assert.equal(balance(s,'pay'),500000);assert.equal(billPaid(s,s.bills[0]),1000);
});
