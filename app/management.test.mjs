import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,summary} from './engine.mjs';
import {applyManagement,milligrams,logisticsCents,managementView,monthlyReport,monthEnd,partialEntries,managementSeries,accumulatedEntries,partialMonthlyReport} from './management.mjs';
import {buildPDF} from './pdf-v13.mjs';
const actor='admin@example.invalid',date=new Date('2026-11-30T16:00:00Z');
const input={month:'2026-11',grams:'1000,125',gross:'70000',cost:'100000',reviewed:true,adjustment:'Custo exato conciliado',reason:'Conferência do sistema matriz'};
const act=(s,op,v=input,now=date)=>applyManagement(structuredClone(s),op,v,actor,now);
test('inteiros, unidades, divisão zero e arredondamento de meio centavo',()=>{
 assert.equal(milligrams('123,456'),123456);assert.equal(logisticsCents(10000000,1000000),10000);
 assert.equal(logisticsCents(1,2000),1);assert.equal(logisticsCents(1,3000),0);assert.equal(logisticsCents(1,0),null);
 assert.throws(()=>logisticsCents(10000000000000,1),/precisão/);
 for(const bad of ['-1','NaN','1.2345','1,2,3','Infinity','1e8',''])assert.throws(()=>milligrams(bad));
 assert.equal(monthEnd('2028-02'),'2028-02-29');assert.throws(()=>monthEnd('2026-13'));
});
test('exemplos solicitados, mês separado do acumulado, dados legados preservados',()=>{
 let s=initial();const before=structuredClone(s);
 s=act(s,'managementAccumulated',{grams:'999999',asOf:'2026-11-20',reason:'Saldo histórico conferido'});
 s=act(s,'managementClose');let v=managementView(s,'2026-11');assert.equal(v.net,-3000000);assert.equal(v.grams,1000125);
 for(const key of Object.keys(before))assert.deepEqual(s[key],before[key]);
 assert.equal(s.managementAccumulated.grams,999999000);
 s=act(s,'managementReopen',{month:'2026-11',reason:'Revisão de faturamento'});
 s=act(s,'managementClose',{...input,gross:'120000'});v=managementView(s,'2026-11');assert.equal(v.net,2000000);assert.equal(v.record.version,2);
 assert.equal(v.record.history[0].gross,7000000);
});
test('fechamento em qualquer dia e horário; revisão e justificativas obrigatórias',()=>{
 assert.equal(act(initial(),'managementClose',input,new Date('2026-11-01T02:00:00Z')).managementMonths[0].status,'closed');
 assert.throws(()=>act(initial(),'managementClose',{...input,reviewed:false}),/Revise/);
 assert.throws(()=>act(initial(),'managementClose',{...input,adjustment:''}),/ajuste/);
 assert.throws(()=>act(initial(),'managementClose',{...input,reason:''}),/justificativa/);
 assert.throws(()=>act(initial(),'managementClose',{...input,cost:'-1'}));
 assert.equal(act(initial(),'managementPartial',{month:'2026-12',grams:'1,125',gross:'100'}).managementMonths[0].gross,10000);
});
test('parcial não é oficial; fechado exige reabertura; fonte posterior não muda PDF',()=>{
 let s=act(initial(),'managementPartial');assert.equal(managementView(s,'2026-11').cost,0);assert.throws(()=>monthlyReport(s,'2026-11'));
 s=act(s,'managementClose');assert.throws(()=>act(s,'managementPartial'),/Reabra/);
 s.bills.push({id:'b',date:'2026-11-01',amount:50000,unit:'u0'});
 assert.equal(managementView(s,'2026-11').cost,10000000);assert.equal(managementView(s,'2026-11').source.total,50000);
 assert.ok(JSON.stringify(monthlyReport(s,'2026-11')).includes('100.000,00'));
 s=act(s,'managementReopen',{month:'2026-11',reason:'Correção consciente'});
 assert.match(monthlyReport(s,'2026-11').scope,/HISTÓRICO/);
 s=act(s,'managementClose',{...input,gross:'120000'});
 assert.match(monthlyReport(s,'2026-11',1).scope,/HISTÓRICO/);assert.match(monthlyReport(s,'2026-11',2).scope,/OFICIAL/);
 assert.throws(()=>monthlyReport(s,'2026-11',3));
 const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(restored,s);
});
test('contas previstas incluem salário uma vez e pagamentos não duplicam custo',()=>{
 const s=initial();s.bills=[{id:'b',unit:'u0',amount:10000,date:'2026-11-01'}];
 s.payroll=[{id:'p',month:'2026-11',unit:'u0',salary:20000,grams:null,rate:1000,compensationType:'fixed'}];
 s.advances=[{id:'a',employee:'e',unit:'u0',date:'2026-11-01',month:'2026-11',amount:5000}];
 s.movements=[{kind:'bill',bill:'b',unit:'u0',date:'2026-11-02',amount:-10000},{kind:'advance',advance:'a',unit:'u0',date:'2026-11-02',amount:-5000},{kind:'expense',unit:'u0',date:'2026-11-02',amount:-3000}];
 assert.equal(summary(s,'2026-11').total,33000);assert.equal(summary(s,'2026-11').paid,18000);
 assert.equal(managementView(s,'2026-11').gross,null);assert.equal(managementView(s,'2026-11').logistics,null);
 const next=apply(s,'managementPartial',{...input,month:'2026-10'},actor);assert.equal(next.managementMonths.length,1);
});
test('PDF oficial usa valores exatos, resultado com sinal, estados e auditoria',()=>{
 let s=act(initial(),'managementClose',{...input,grams:'0'});
 let report=monthlyReport(s,'2026-11',1,date);let pdf=Buffer.from(buildPDF('Fechamento mensal',report)).toString('latin1');
 for(const phrase of ['OFICIAL FECHADO','-R$ 30.000,00','nenhuma grama','America/Cuiaba','Conferência do sistema matriz','2026-11-30'])assert.ok(pdf.includes(phrase),phrase);
 s=act(s,'managementReopen',{month:'2026-11',reason:'Retificar receita oficial'});s=act(s,'managementClose',{...input,gross:'120000'});
 pdf=Buffer.from(buildPDF('Fechamento mensal',monthlyReport(s,'2026-11',2,date))).toString('latin1');assert.ok(pdf.includes('+R$ 20.000,00'));
});


test('folha não conferida exige conciliação explícita mesmo com custo igual',()=>{
 const s=initial();s.payroll=[{id:'p',month:'2026-11',unit:'u0',salary:10000,grams:null,rate:1000,confirmed:false}];
 assert.throws(()=>act(s,'managementClose',{...input,cost:'100',adjustment:''}),/conciliação/);
 const next=act(s,'managementClose',{...input,cost:'100',adjustment:'Folha conferida externamente no fechamento'});
 assert.equal(next.managementMonths[0].source.pendingGrams,1);
 assert.equal(next.managementMonths[0].source.unconfirmedPayroll,1);
});


test('parcial futuro sem justificativa, histórico completo e um resultado por mês',()=>{
 let s=act(initial(),'managementPartial',{month:'2026-12',grams:'1000',gross:'70000'});
 s=act(s,'managementPartial',{month:'2026-12',grams:'2000',gross:'120000'});
 assert.equal(partialEntries(s.managementMonths[0]).length,2);
 assert.equal(managementSeries(s).length,1);assert.equal(managementSeries(s)[0].net,12000000);
 assert.equal(managementSeries(s)[0].grams,2000000);
 assert.equal(act(s,'managementClose',{...input,month:'2026-12'}).managementMonths[0].status,'closed');
});
test('editar antigo não substitui último; apagar último restaura anterior sem perder auditoria',()=>{
 let s=act(initial(),'managementPartial',{month:'2026-12',grams:'100',gross:'700'});
 s=act(s,'managementPartial',{month:'2026-12',grams:'200',gross:'1200'});
 const [first,last]=partialEntries(s.managementMonths[0]);
 s=act(s,'managementEditPartial',{month:'2026-12',entryId:first.id,grams:'150',gross:'900'});
 assert.equal(managementView(s,'2026-12').gross,120000);
 assert.equal(s.managementMonths[0].history[0].gross,70000);
 s=act(s,'managementDeletePartial',{month:'2026-12',entryId:last.id});
 assert.equal(managementView(s,'2026-12').gross,90000);
 assert.equal(managementSeries(s).length,1);
 s=act(s,'managementDeletePartial',{month:'2026-12',entryId:first.id});
 assert.equal(managementView(s,'2026-12').gross,null);assert.equal(managementSeries(s).length,0);
 assert.equal(s.managementMonths[0].history.length,5);
 assert.throws(()=>act(s,'managementDeletePartial',{month:'2026-12',entryId:first.id}),/não encontrado/);
});
test('histórico anterior sem IDs é editável e fechamento oficial permanece protegido',()=>{
 let s=act(initial(),'managementPartial',{month:'2026-11',grams:'100',gross:'700'});
 delete s.managementMonths[0].history[0].id;
 const oldId=partialEntries(s.managementMonths[0])[0].id;
 s=act(s,'managementEditPartial',{month:'2026-11',entryId:oldId,grams:'110',gross:'800'});
 assert.equal(managementView(s,'2026-11').gross,80000);
 s=act(s,'managementClose');
 for(const op of ['managementEditPartial','managementDeletePartial'])assert.throws(()=>act(s,op,{month:'2026-11',entryId:oldId,grams:'0',gross:'0'}),/Reabra/);
});
test('acumulado legado pode ser editado e apagado, mantendo registro original',()=>{
 let s=initial();s.managementAccumulated={grams:100000,asOf:'2026-11-01',history:[{grams:100000,asOf:'2026-11-01',actor,at:date.toISOString(),reason:'Saldo anterior'}]};
 const id=accumulatedEntries(s)[0].id;
 s=act(s,'managementEditAccumulated',{entryId:id,grams:'123,456',asOf:'2026-11-02'});
 assert.equal(accumulatedEntries(s)[0].grams,123456);assert.equal(s.managementAccumulated.history[0].grams,100000);
 s=act(s,'managementDeleteAccumulated',{entryId:id});assert.equal(accumulatedEntries(s).length,0);assert.equal(s.managementAccumulated.grams,null);
 assert.equal(s.managementAccumulated.history.length,3);
});


test('PDF parcial existe antes do oficial e identifica sua natureza e última atualização',()=>{
 let s=act(initial(),'managementPartial',{month:'2099-12',grams:'1000,125',gross:'1200'});
 let report=partialMonthlyReport(s,'2099-12',actor,date);
 assert.match(report.scope,/PARCIAL - NÃO OFICIAL/);
 assert.throws(()=>monthlyReport(s,'2099-12'));
 const before=structuredClone(s);
 const pdf=Buffer.from(buildPDF('Fecha Real - Parcial',report)).toString('latin1');
 assert.ok(pdf.includes('PARCIAL - NÃO OFICIAL'));assert.ok(pdf.includes('1.000,125 g'));assert.ok(pdf.includes('+R$ 1.200,00'));
 assert.deepEqual(s,before);
 s=act(s,'managementClose',{...input,month:'2099-12',grams:'1000',gross:'2000',cost:'1000'});
 report=partialMonthlyReport(s,'2099-12',actor,date);
 assert.match(report.scope,/PARCIAL/);assert.match(JSON.stringify(report),/versão oficial/);
 assert.match(monthlyReport(s,'2099-12').scope,/OFICIAL FECHADO/);
 s=act(s,'managementReopen',{month:'2099-12',reason:'Correção solicitada pelo administrador'});
 s=act(s,'managementPartial',{month:'2099-12',grams:'1000',gross:'2500'});
 assert.ok(JSON.stringify(partialMonthlyReport(s,'2099-12',actor,date)).includes('2.500,00'));
 assert.match(monthlyReport(s,'2099-12').scope,/HISTÓRICO/);
 s=act(s,'managementClose',{...input,month:'2099-12',gross:'2500',cost:'1000'});
 assert.equal(s.managementMonths[0].version,2);
});
test('PDF parcial sem dados salvos é recusado',()=>assert.throws(()=>partialMonthlyReport(initial(),'2026-12',actor),/Salve/));
