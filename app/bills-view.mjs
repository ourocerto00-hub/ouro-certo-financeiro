import {active,billPaid,today} from './engine.mjs';

export function reportPeriod({month,from='',to=''}={}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw Error('Informe uma competência válida.');
 const start=from||month+'-01';
 const end=to||new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(start)||!valid(end)||start>end)throw Error('Informe um período válido; a data inicial deve ser anterior à final.');
 return {start,end};
}

export function billStatus(s,b,asOf=today()){
 if(!active(b))return 'Cancelada';
 const paid=billPaid(s,b);
 return paid>=b.amount?'Paga':paid>0?'Parcialmente paga':b.date<asOf?'Vencida':'Pendente';
}

// The table and its PDF use this same read-only selector, including settled/cancelled records.
export function selectBills(s,{unit='all',category='all',search='',...period}={}){
 const {start,end}=reportPeriod(period),query=String(search).trim().toLocaleLowerCase('pt-BR');
 const name=(table,id)=>s[table].find(x=>x.id===id)?.name||'';
 return s.bills.filter(b=>b.date>=start&&b.date<=end&&(unit==='all'||b.unit===unit)&&(category==='all'||b.category===category)&&(!query||[JSON.stringify(b),name('units',b.unit),name('categories',b.category)].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
}

export function billTotals(s,bills){
 return bills.reduce((totals,b)=>{
  if(!active(b)){totals.cancelled+=b.amount;return totals;}
  const paid=billPaid(s,b);
  totals.amount+=b.amount;totals.paid+=paid;totals.pending+=Math.max(0,b.amount-paid);return totals;
 },{amount:0,paid:0,pending:0,cancelled:0});
}
