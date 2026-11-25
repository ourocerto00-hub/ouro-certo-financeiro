import {paidRecords} from './engine.mjs';
import {reportPeriod} from './bills-view.mjs';

export const paymentLabel=p=>p.source==='external'?'Paga (externamente)':p.kind==='advance'?'Vale pago':p.kind==='salary'?'Salário pago':'Pago';
export const paymentOrigin=(s,p)=>p.source==='external'?'Origem externa'+(p.origin?' / '+p.origin:''):(s.accounts.find(a=>a.id===p.account)?.name||'Sem vínculo');
// Same filters for Contas Pagas, its totals, cancellation history and PDF.
export function selectPaid(s,{unit='all',category='all',source='all',search='',includeCancelled=false,...period}={}){
 const {start,end}=reportPeriod(period),query=String(search).trim().toLocaleLowerCase('pt-BR');
 const name=(table,id)=>s[table].find(x=>x.id===id)?.name||'';
 return paidRecords(s,{includeCancelled}).filter(p=>p.date>=start&&p.date<=end&&(unit==='all'||p.unit===unit)&&(category==='all'||p.category===category)&&(source==='all'||p.source===source)&&(!query||[p.description,p.billName,p.origin,p.actor,name('units',p.unit),name('categories',p.category),name('employees',p.employee),paymentLabel(p),paymentOrigin(s,p)].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
}
