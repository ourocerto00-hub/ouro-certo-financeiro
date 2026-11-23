import {active} from './engine.mjs';

// Salary competence is independent from the cash payment date.
export function selectAdvances(s,{month,fromMonth=month,toMonth=month,unit='all',search='',includeCancelled=true,category='all'}={}){
 const valid=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
 if(!valid(fromMonth)||!valid(toMonth)||fromMonth>toMonth)throw Error('Competência inválida.');
 const query=search.trim().toLocaleLowerCase('pt-BR');
 return s.advances.filter(a=>a.month>=fromMonth&&a.month<=toMonth&&(includeCancelled||active(a))&&(unit==='all'||a.unit===unit)&&(category==='all'||a.category===category)&&(!query||(JSON.stringify(a)+' '+(s.employees.find(e=>e.id===a.employee)?.name||'')).toLocaleLowerCase('pt-BR').includes(query)));
}
export const advancesTotal=advances=>advances.filter(active).reduce((sum,a)=>sum+a.amount,0);
