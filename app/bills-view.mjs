import {active,billPaid,billExternalPaid,externalPayments,today,referenceMonth} from './engine.mjs';

export function reportPeriod({month,from='',to=''}={}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw Error('Informe uma competência válida.');
 const start=from||month+'-01';
 const end=to||new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!valid(start)||!valid(end)||start>end)throw Error('Informe um período válido; a data inicial deve ser anterior à final.');
 return {start,end};
}

// Blank date filters include every item of the reference month, even when its
// due/payment date falls in another month. Explicit dates narrow the real date.
export function referencePeriodFilter(options){
 const {start,end}=reportPeriod(options),{from='',to=''}=options;
 return record=>referenceMonth(record)>=start.slice(0,7)&&referenceMonth(record)<=end.slice(0,7)&&(!from||record.date>=from)&&(!to||record.date<=to);
}

export function billStatus(s,b,asOf=today()){
 if(!active(b))return 'Cancelada';
 const paid=billPaid(s,b);
 const external=billExternalPaid(s,b),suffix=external?(external===paid?' (externamente)':' (mista)'):'';
 return paid>=b.amount?'Paga'+suffix:paid>0?'Parcialmente paga'+suffix:b.date<asOf?'Vencida':'Pendente';
}

// The table and its PDF use this same read-only selector, including settled/cancelled records.
export function selectBills(s,{unit='all',category='all',search='',...period}={}){
 const inPeriod=referencePeriodFilter(period),query=String(search).trim().toLocaleLowerCase('pt-BR');
 const name=(table,id)=>s[table].find(x=>x.id===id)?.name||'';
 return s.bills.filter(b=>inPeriod(b)&&(unit==='all'||b.unit===unit)&&(category==='all'||b.category===category)&&(!query||[JSON.stringify(b),name('units',b.unit),name('categories',b.category),billStatus(s,b),...externalPayments(s).filter(p=>p.bill===b.id&&active(p)).map(p=>p.origin)].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
}

export function billTotals(s,bills){
 return bills.reduce((totals,b)=>{
  if(!active(b)){totals.cancelled+=b.amount;return totals;}
  const paid=billPaid(s,b);
  totals.amount+=b.amount;totals.paid+=paid;totals.pending+=Math.max(0,b.amount-paid);return totals;
 },{amount:0,paid:0,pending:0,cancelled:0});
}
