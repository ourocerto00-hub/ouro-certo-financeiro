import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply} from './engine.mjs';
import {createReport} from './reports.mjs';
import {buildPDF} from './pdf-v13.mjs';
import {selectBills,billStatus,billTotals,reportPeriod} from './bills-view.mjs';

// Regression: the V13 table includes settled bills, but the old export dropped all of them.
test('Contas a Pagar: uma conta paga exibida na tabela precisa constar no PDF',()=>{
 let s=initial();s.accounts.forEach(a=>{a.date='2026-10-01';a.opening=1000000;});
 s=apply(s,'bill',{name:'Aluguel visível',description:'Locação da filial',unit:'u1',category:'c0',date:'2026-10-10',amount:'1000'},'Teste');
 s=apply(s,'paybill',{id:s.bills[0].id,date:'2026-10-10',account:'pay',amount:'1000'},'Teste');
 const table=s.bills.filter(b=>b.date.startsWith('2026-10')&&b.unit==='u1');
 assert.equal(table.length,1);
 const report=createReport(s,0,{month:'2026-10',unit:'u1'});
 assert.equal(report.sections[0].rows.length,table.length,'O relatório descartou uma conta que a tabela exibe.');
 const pdf=Buffer.from(buildPDF('Contas a Pagar',report)).toString('latin1');
 assert.ok(pdf.includes('Aluguel visível'),'A descrição da conta deve estar no conteúdo do PDF.');
 assert.ok(pdf.includes('Paga'),'A situação precisa estar no PDF.');
});

function fixture(){
 const s=initial();
 s.bills=[
  {id:'paid',name:'Aluguel pago',description:'Locação comercial',date:'2026-10-01',unit:'u1',category:'c0',amount:100000},
  {id:'partial',name:'Aluguel parcial',description:'Locação complementar',date:'2026-10-10',unit:'u1',category:'c0',amount:50000},
  {id:'pending',name:'Internet pendente',description:'Link empresarial',date:'2026-10-31',unit:'u1',category:'c2',amount:70000},
  {id:'cancelled',name:'Conta cancelada',date:'2026-10-20',unit:'u1',category:'c0',amount:30000,cancelled:true},
  {id:'other-unit',name:'Outra unidade',date:'2026-10-10',unit:'u0',category:'c0',amount:10000},
  {id:'previous-month',name:'Mês anterior',date:'2026-09-30',unit:'u1',category:'c0',amount:10000},
  {id:'next-month',name:'Mês seguinte',date:'2026-11-01',unit:'u1',category:'c0',amount:10000},
 ];
 s.movements=[{id:'m1',bill:'paid',amount:-100000},{id:'m2',bill:'partial',amount:-20000},{id:'m3',bill:'partial',amount:-15000,cancelled:true}];
 return s;
}

test('seleção compartilhada respeita mês, período inclusivo, unidade, categoria e busca',()=>{
 const s=fixture();
 const cases=[
  [{month:'2026-10',unit:'u1'},['paid','partial','pending','cancelled']],
  [{month:'2026-10',unit:'u0'},['other-unit']],
  [{month:'2026-10',unit:'u1',category:'c2'},['pending']],
  [{month:'2026-10',unit:'u1',from:'2026-10-10',to:'2026-10-20',category:'c0'},['partial','cancelled']],
  [{month:'2026-10',unit:'u1',search:'locação'},['paid','partial']],
  [{month:'2026-10',search:'Sorriso'},['paid','partial','pending','cancelled']],
  [{month:'2026-10',unit:'u1',from:'2026-09-30',to:'2026-11-01'},['paid','partial','pending','cancelled','previous-month','next-month']],
 ];
 for(const [filters,ids] of cases){
  const selected=selectBills(s,filters),report=createReport(s,0,filters);
  assert.deepEqual(selected.map(b=>b.id),ids);
  assert.equal(report.sections[0].rows.length,selected.length);
  for(const [i,b] of selected.entries())assert.ok(report.sections[0].rows[i][1].startsWith(b.name),b.id);
 }
});

test('PDF inclui descrição, vencimento, categoria, valor, situação e totais corretos',()=>{
 const s=fixture(),filters={month:'2026-10',unit:'u1',issuedAt:new Date('2026-10-15T12:00:00Z')};
 const report=createReport(s,0,filters),rows=report.sections[0].rows;
 assert.deepEqual(report.sections[0].columns,['Vencimento','Descrição / unidade','Categoria','Valor','Pago / saldo','Situação']);
 assert.deepEqual(rows[0],['01/10/2026','Aluguel pago / Locação comercial / Sorriso','Aluguel','R$\u00a01.000,00','R$\u00a01.000,00 / R$\u00a00,00','Paga']);
 assert.equal(rows[1][5],'Parcialmente paga');assert.equal(rows[2][5],'Pendente');assert.equal(rows[3][5],'Cancelada');
 assert.deepEqual(billTotals(s,selectBills(s,filters)),{amount:220000,paid:120000,pending:100000,cancelled:30000});
 assert.deepEqual(report.stats.map(x=>x.value),['R$\u00a02.200,00','R$\u00a01.200,00','R$\u00a01.000,00','R$\u00a0300,00']);
 assert.equal(report.sections[0].total,'TOTAL: R$\u00a02.200,00');
 assert.equal(billStatus(s,s.bills[2],'2026-11-01'),'Vencida');
});

test('datas impossíveis e período invertido são rejeitados tanto pela tabela quanto pelo PDF',()=>{
 for(const filters of [{month:'2026-10',from:'2026-02-30'},{month:'2026-10',from:'2026-10-31',to:'2026-10-01'}]){
  assert.throws(()=>selectBills(fixture(),filters),/período válido/);
  assert.throws(()=>createReport(fixture(),0,filters),/período válido/);
 }
 assert.deepEqual(reportPeriod({month:'2024-02'}),{start:'2024-02-01',end:'2024-02-29'});
});

test('consulta e geração do PDF não alteram o estado financeiro',()=>{
 const s=fixture(),before=structuredClone(s);
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}};freeze(s);
 buildPDF('Contas a Pagar',createReport(s,0,{month:'2026-10',unit:'u1'}));
 assert.deepEqual(s,before);
});

test('entrada antiga de linhas não produz somente cabeçalho e rodapé',()=>{
 const pdf=Buffer.from(buildPDF('Contas a Pagar',['Aluguel legado - R$ 500,00'])).toString('latin1');
 assert.ok(pdf.includes('Aluguel legado - R$ 500,00'));
 assert.throws(()=>buildPDF('Contas a Pagar',{lines:['Aluguel']}),/Conteúdo do relatório inválido/);
});

test('filtros sem resultados geram mensagem visível e totais zerados',()=>{
 const report=createReport(fixture(),0,{month:'2026-10',unit:'u6'});
 assert.equal(report.sections[0].rows.length,0);assert.ok(report.stats.every(x=>x.value==='R$\u00a00,00'));
 const pdf=Buffer.from(buildPDF('Contas a Pagar',report)).toString('latin1');
 assert.ok(pdf.includes('Nenhuma conta ou registro corresponde aos filtros selecionados.'));
 assert.ok(pdf.includes('0.06 0.06 0.06 rg'));
});

test('paginação mantém todas as contas e texto dentro da área útil, incluindo a última',()=>{
 const s=fixture();s.bills=Array.from({length:90},(_,i)=>({id:'b'+i,name:'Conta '+String(i).padStart(3,'0'),description:('Descrição longa '+i+' ').repeat(i===40?90:8),date:'2026-10-10',unit:'u1',category:'c0',amount:10000}));s.movements=[];
 const pdf=Buffer.from(buildPDF('Contas a Pagar',createReport(s,0,{month:'2026-10'}))).toString('latin1');
 assert.ok(Number(pdf.match(/\/Count (\d+)/)[1])>1);
 for(let i=0;i<90;i++)assert.ok(pdf.includes('Conta '+String(i).padStart(3,'0')),String(i));
 for(const match of pdf.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)){
  assert.ok(Number(match[1])>=36&&Number(match[1])<559,match[0]);
  assert.ok(Number(match[2])>=30&&Number(match[2])<=806,match[0]);
 }
 assert.ok(pdf.includes('TOTAL: R$ 9.000,00'));
});
