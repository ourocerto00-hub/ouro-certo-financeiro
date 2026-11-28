import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,summary,apply,balance} from './engine.mjs';
import {selectAdvances,advancesTotal} from './advances-view.mjs';
import {createReport} from './reports.mjs';
import {buildPDF} from './pdf-v13.mjs';
const fixture=()=>{
 const s=initial();s.employees=[{id:'e',name:'Ana Teste'}];
 s.advances=[{id:'a',employee:'e',unit:'u0',month:'2026-12',date:'2026-11-22',amount:10000,description:'Vale de dezembro'},
 {id:'b',employee:'e',unit:'u1',month:'2026-11',date:'2026-12-02',amount:20000,description:'Vale de novembro'},
 {id:'c',employee:'e',unit:'u0',month:'2027-01',date:'2026-12-20',amount:30000,description:'Vale de janeiro'},
 {id:'d',employee:'e',unit:'u0',month:'2026-12',date:'2026-11-25',amount:40000,cancelled:true}];s.movements=s.advances.map(a=>({id:'m-'+a.id,advance:a.id,kind:'advance',date:a.date,unit:a.unit,amount:-a.amount,cancelled:a.cancelled}));return s;
};
test('seleção usa competência, não data do pagamento; cancelados não compõem total',()=>{
 const s=fixture(),rows=selectAdvances(s,{month:'2026-12'});
 assert.deepEqual(rows.map(a=>a.id),['a','d']);assert.equal(advancesTotal(rows),10000);
 assert.deepEqual(selectAdvances(s,{month:'2026-11'}).map(a=>a.id),['b']);
 assert.deepEqual(selectAdvances(s,{month:'2027-01'}).map(a=>a.id),['c']);
 assert.equal(summary(s,'2026-11').advances,20000);
 assert.equal(summary(s,'2026-12').advances,10000); // dashboard follows salary reference; cash still follows real payment date
});
test('regra funciona em todos os meses e na virada de ano, com unidade e busca',()=>{
 const s=fixture();for(let month=1;month<=12;month++){
  const key=`2028-${String(month).padStart(2,'0')}`;
  s.advances.push({id:key,employee:'e',unit:'u0',month:key,date:'2027-12-01',amount:1});
  assert.deepEqual(selectAdvances(s,{month:key}).map(a=>a.id),[key]);
 }
 assert.equal(selectAdvances(s,{month:'2026-12',unit:'u1'}).length,0);
 assert.equal(selectAdvances(s,{month:'2026-12',search:'ana teste',includeCancelled:false}).length,1);
 assert.deepEqual(selectAdvances(s,{fromMonth:'2026-12',toMonth:'2027-01',includeCancelled:false}).map(a=>a.id),['a','c']);
 assert.throws(()=>selectAdvances(s,{month:'2026-13'}));
});
test('PDF de vales usa competência e não repete cancelados nem altera dados',()=>{
 const s=fixture(),before=structuredClone(s),report=createReport(s,4,{month:'2026-12'});
 assert.match(report.subtitle,/Competências salariais/);
 const pdf=Buffer.from(buildPDF('Vales e Adiantamentos',report)).toString('latin1');
 assert.ok(pdf.includes('Vale de dezembro'));assert.ok(!pdf.includes('Vale de novembro'));assert.ok(!pdf.includes('Vale de janeiro'));assert.ok(pdf.includes('TOTAL: R$ 100,00'));
 assert.deepEqual(s,before);
});
test('vale de dezembro pago em novembro reduz apenas a folha de dezembro e uma saída no caixa',()=>{
 let s=initial();s.accounts.forEach(a=>{a.date='2026-01-01';a.opening=100000;});
 s=apply(s,'employee',{name:'Teste',role:'Comprador',unit:'u0',salary:'1000',compensationType:'fixed',admission:'2026-01-01',month:'2026-12'},'teste');
 s=apply(s,'advance',{employee:s.employees[0].id,month:'2026-12',date:'2026-11-22',amount:'100',account:'pay',description:'Vale antecipado'},'teste');
 assert.equal(selectAdvances(s,{month:'2026-12'}).length,1);assert.equal(selectAdvances(s,{month:'2026-11'}).length,0);
 assert.equal(balance(s,'pay'),90000);assert.equal(s.movements.filter(m=>m.kind==='advance').length,1);
 assert.equal(summary(s,'2026-12').total,100000);
});
