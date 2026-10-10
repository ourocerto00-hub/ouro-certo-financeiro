import {active,balance,billPaid,salaryDue,remuneration,advancePaid,salaryPaid,money,paidMovements,cashSummary} from './engine.mjs';
export const REPORTS=['Contas a Pagar','Contas Pagas','Fechamento Caixa Ouro','Fechamento Caixa Pagamentos','Vales e Adiantamentos','Custos por Filial','Custos da Matriz','Salários e Comissões','Despesas Diárias por Unidade','Resumo Financeiro Geral','Fechamentos Consolidados'];
const fmt=d=>d.split('-').reverse().join('/');
export function createReport(s,index,{month,from='',to='',unit='all',category='all',account='',user='',isDemo=false,issuedAt=new Date()}={}){
 if(!REPORTS[index])throw Error('Relatório inválido.');
 const start=from||month+'-01',end=to||new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Error('Informe um período válido; a data inicial deve ser anterior à final.');
 const name=(table,id)=>s[table].find(x=>x.id===id)?.name||'Sem vínculo';
 const range=d=>d>=start&&d<=end;
 const payRange=p=>p.month>=start.slice(0,7)&&p.month<=end.slice(0,7);
 const filter=x=>active(x)&&(unit==='all'||x.unit===unit)&&(category==='all'||x.category===category);
 const cash=[2,3,10].includes(index);
 const report={subtitle:`Período: ${fmt(start)} a ${fmt(end)}`,scope:cash?'Saldos centralizados da conta; movimentos completos, sem filtro de unidade ou categoria.':`Unidade: ${unit==='all'?'Todas':name('units',unit)} | Categoria: ${category==='all'?'Todas':name('categories',category)}`,issued:`Responsável: ${user} | Emissão: ${issuedAt.toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})}`,note:isDemo?'DEMONSTRAÇÃO - DADOS FICTÍCIOS':'Valores em reais. Cancelamentos excluídos dos totais.',sections:[]};
 const add=(title,columns,rows,widths,total)=>report.sections.push({title,columns,rows,widths,total:total===undefined?undefined:'TOTAL: '+money(total)});
 if(cash){
  const accounts=s.accounts.filter(a=>(!account||a.id===account)&&(index===10||a.purpose===(index===2?'gold':'pay')));
  const sums=accounts.map(a=>cashSummary(s,a.id,start,end));
  report.stats=['Saldo inicial','Entradas','Saídas','Saldo esperado'].map((label,i)=>({label,value:money(sums.reduce((n,c)=>n+c[['opening','entries','exits','expected'][i]],0))}));
  accounts.forEach((a,i)=>{const c=sums[i];
   add(a.name+' / Resumo',['Saldo inicial','Entradas','Saídas','Saldo esperado'],[[money(c.opening),money(c.entries),money(c.exits),money(c.expected)]],[1,1,1,1]);
   add('Movimentações / '+a.name,['Data','Descrição / tipo','Responsável','Valor'],s.movements.filter(m=>m.account===a.id&&range(m.date)&&active(m)).sort((a,b)=>a.date.localeCompare(b.date)).map(m=>[fmt(m.date),`${m.description} / ${m.kind==='advance'?'Vale pago':m.kind==='transfer'?'Transferência':m.amount>0?'Entrada':'Saída'} / ${name('units',m.unit)}`,m.actor||'-',money(m.amount)]),[.85,2.65,1.4,1.1]);
   add('Conferências / '+a.name,['Data / status','Esperado / real','Diferença','Justificativa'],s.closings.filter(c=>c.account===a.id&&range(c.date)).map(c=>[fmt(c.date)+(c.reopened?' / Reaberto':' / Fechado'),`${money(c.expected)} / ${money(c.real)}`,money(c.difference),`${c.reason||'Sem divergência'}${c.reopened?' / '+c.reopenReason:''} / ${c.actor}`]),[1.1,1.5,1,2.4]);
  });
 }else if(index===0){
  const rows=s.bills.filter(b=>range(b.date)&&filter(b)&&billPaid(s,b)<b.amount).map(b=>[fmt(b.date),b.name,name('units',b.unit),money(b.amount-billPaid(s,b))]);
  let total=s.bills.filter(b=>range(b.date)&&filter(b)).reduce((n,b)=>n+Math.max(0,b.amount-billPaid(s,b)),0);
  s.payroll.filter(p=>payRange(p)&&(unit==='all'||p.unit===unit)&&category==='all'&&salaryDue(s,p)>0).forEach(p=>{rows.push([p.month,'Salário / '+name('employees',p.employee),name('units',p.unit),money(salaryDue(s,p))]);total+=salaryDue(s,p);});
  add('Obrigações pendentes na emissão',['Vencimento','Descrição','Unidade','Pendente'],rows,[1,2.3,1.5,1.2],total);
 }else if(index===1||index===8){
  const ms=paidMovements(s).filter(m=>range(m.date)&&filter(m)&&(index!==8||m.kind==='expense'));
  add(index===1?'Pagamentos realizados (um registro por saída)':'Despesas diárias',['Data','Descrição / funcionário','Unidade','Pago'],ms.map(m=>[fmt(m.date),`${m.kind==='advance'?'Vale / ':''}${m.description}${m.employee?' / '+name('employees',m.employee):''}`,name('units',m.unit),money(-m.amount)]),[.9,2.6,1.4,1.1],ms.reduce((n,m)=>n-m.amount,0));
 }else if(index===4){
  const as=s.advances.filter(a=>range(a.date)&&filter(a));add('Vales pagos / dedução salarial',['Data / competência','Funcionário / descrição','Unidade','Valor'],as.map(a=>[`${fmt(a.date)} / ${a.month}`,`${name('employees',a.employee)} / ${a.description}`,name('units',a.unit),money(a.amount)]),[1.2,2.3,1.4,1.1],as.reduce((n,a)=>n+a.amount,0));
 }else if(index===7){
  s.payroll.filter(p=>payRange(p)&&(unit==='all'||p.unit===unit)).forEach(p=>{add(name('employees',p.employee)+' / '+p.month,['Componente','Detalhes','Valor'],[
   ['Unidade',name('units',p.unit),''],['Salário fixo','',money(p.salary)],['Comissão',`${p.grams===null?'Gramas não informadas':(p.grams/1000).toLocaleString('pt-BR')+' g'} x ${money(p.rate)} / g`,p.grams===null?'A calcular':money(remuneration(p)-p.salary)],['Remuneração bruta',p.confirmed?'Conferida':'Conferência pendente',money(remuneration(p))],['Vales pagos','Deduzidos uma vez',money(advancePaid(s,p))],['Salário pago','',money(salaryPaid(s,p))],['Saldo a pagar','',money(salaryDue(s,p))]],[1.4,2.8,1.3]);});
 }else{
  let total=0;
  s.units.filter(u=>(unit==='all'||u.id===unit)&&(index!==6||u.type==='Matriz')&&(index!==5||u.type==='Filial')).forEach(u=>{
   const rows=[];let subtotal=0;
   s.bills.filter(b=>b.unit===u.id&&range(b.date)&&active(b)&&(category==='all'||b.category===category)).forEach(b=>{subtotal+=b.amount;rows.push([b.name,name('categories',b.category),money(b.amount),money(billPaid(s,b))]);});
   s.movements.filter(m=>m.unit===u.id&&range(m.date)&&active(m)&&m.kind==='expense'&&(category==='all'||m.category===category)).forEach(m=>{subtotal-=m.amount;rows.push([m.description,name('categories',m.category),money(-m.amount),money(-m.amount)]);});
   if(category==='all')s.payroll.filter(p=>p.unit===u.id&&payRange(p)).forEach(p=>{subtotal+=remuneration(p);rows.push([name('employees',p.employee),'Remuneração / '+p.month,money(remuneration(p)),money(salaryPaid(s,p)+advancePaid(s,p))]);});total+=subtotal;
   add(u.name,['Descrição','Categoria','Previsto','Pago acumulado'],rows,[2,1.5,1.2,1.3],subtotal);
  });
  report.stats=[{label:'Custo previsto',value:money(total)}];
  if(index===9)add('Saldos centralizados na data final',['Conta','Saldo esperado'],s.accounts.map(a=>[a.name,money(balance(s,a.id,end))]),[3,1]);
 }
 if(!report.sections.length)add('Registros',['Descrição'],[]);
 return report;
}
