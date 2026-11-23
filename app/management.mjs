import {cents, summary, money, commissionReady} from './engine.mjs';

const check=(value,message)=>{if(!value)throw Error(message);};
export function monthEnd(month){
 check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&month>='2000-01'&&month<='9999-12','Competência inválida.');
 const [year,m]=month.split('-').map(Number);
 return `${month}-${new Date(Date.UTC(year,m,0)).getUTCDate()}`;
}
export function milligrams(value){
 const raw=String(value??'').trim().replace(',','.');
 check(/^\d+(\.\d{1,3})?$/.test(raw),'Informe gramas não negativas com até três casas decimais, sem separador de milhar.');
 const [whole,fraction='']=raw.split('.');
 const mg=Number(whole)*1000+Number(fraction.padEnd(3,'0'));
 check(Number.isSafeInteger(mg)&&mg<=1e12,'Quantidade fora do limite.');return mg;
}
export const gramsLabel=mg=>mg===null||mg===undefined?'Não informado':`${(mg/1000).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3})} g`;
export const signedMoney=value=>`${value>0?'+':value<0?'-':''}${money(Math.abs(value))}`;
// Exact integer division, rounding half up only at the displayed centavo / gram.
export function logisticsCents(cost,mg){
 if(mg===null||mg===undefined||mg===0)return null;
 check(Number.isSafeInteger(cost)&&cost>=0&&Number.isSafeInteger(mg)&&mg>0,'Valores inválidos.');
 const rate=Number((BigInt(cost)*1000n+BigInt(mg)/2n)/BigInt(mg));
 check(Number.isSafeInteger(rate),'Custo por grama fora do limite de precisão. Revise os valores.');return rate;
}
export function managementSource(s,month){
 return {...summary(s,month,'all'),pendingGrams:s.payroll.filter(p=>p.month===month&&!commissionReady(p)).length,unconfirmedPayroll:s.payroll.filter(p=>p.month===month&&!p.confirmed).length};
}
export function managementView(s,month){
 monthEnd(month);
 const record=(s.managementMonths||[]).find(r=>r.month===month);
 const source=managementSource(s,month);
 const cost=record?.status==='closed'?record.cost:source.total;
 const grams=record?.grams??null,gross=record?.gross??null;
 return {record,source,cost,grams,gross,logistics:logisticsCents(cost,grams),net:gross===null?null:gross-cost};
}
const reason=value=>{const v=String(value??'').trim();check(v.length>=5&&v.length<=500,'Informe uma justificativa de 5 a 500 caracteres.');return v;};
export function applyManagement(s,op,v,actor,now=new Date()){
 const timestamp=now.toISOString();
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(op==='managementAccumulated'){
  check(/^\d{4}-\d{2}-\d{2}$/.test(v.asOf)&&!isNaN(Date.parse(v.asOf))&&new Date(v.asOf).toISOString().slice(0,10)===v.asOf&&v.asOf<=day,'Data de referência inválida ou futura.');
  const entry={grams:milligrams(v.grams),asOf:v.asOf,actor,at:timestamp,reason:reason(v.reason)};
  s.managementAccumulated={...entry,history:[...(s.managementAccumulated?.history||[]),entry]};return s;
 }
 const end=monthEnd(v.month);check(v.month<=day.slice(0,7),'Não é permitido registrar competência futura.');
 s.managementMonths??=[];
 let r=s.managementMonths.find(r=>r.month===v.month);
 if(!r){r={month:v.month,status:'draft',history:[]};s.managementMonths.push(r);}
 const justification=reason(v.reason);
 if(op==='managementReopen'){
  check(r.status==='closed','O mês não está fechado.');
  r.status='reopened';
 }else{
  check(r.status!=='closed','Reabra o fechamento com justificativa antes de alterar.');
  r.grams=milligrams(v.grams);r.gross=cents(v.gross);
  if(op==='managementClose'){
   check(day>=end,'O fechamento oficial estará disponível no último dia do mês (America/Cuiaba).');
   check(v.reviewed===true,'Revise e confirme os valores exatos antes de fechar.');
   r.cost=cents(v.cost);logisticsCents(r.cost,r.grams);r.source=managementSource(s,v.month);
   check(r.cost===r.source.total&&!r.source.unconfirmedPayroll||String(v.adjustment||'').trim().length>=5,'Explique o ajuste do custo exato ou a conciliação das folhas ainda não conferidas.');
   check(String(v.adjustment||'').length<=500,'Ajuste deve ter até 500 caracteres.');
   r.adjustment=String(v.adjustment||'').trim();r.status='closed';
   r.version=(r.version||0)+1;r.closedAt=timestamp;r.closedBy=actor;
  }else {check(op==='managementPartial','Operação gerencial inválida.');logisticsCents(managementSource(s,v.month).total,r.grams);}
 }
 r.updatedAt=timestamp;r.updatedBy=actor;
 const {history,...snapshot}=r;
 history.push({...snapshot,operation:op,reason:justification,at:timestamp,actor});
 return s;
}
export function monthlyReport(s,month,version,issuedAt=new Date()){
 const r=(s.managementMonths||[]).find(r=>r.month===month);
 const closed=(r?.history||[]).filter(e=>e.operation==='managementClose');
 const snapshot=version===undefined?closed.at(-1):closed.find(e=>e.version===version);
 check(snapshot,'Fechamento não encontrado.');
 const current=r.status==='closed'&&r.version===snapshot.version;
 const cost=snapshot.cost,gross=snapshot.gross,mg=snapshot.grams,rate=logisticsCents(cost,mg);
 const stamp=d=>new Date(d).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'});
 return {
  subtitle:`Resultado real informado | ${month}-01 a ${monthEnd(month)} | Versão ${snapshot.version}`,
  scope:`Todas as unidades | ${current?'OFICIAL FECHADO':'HISTÓRICO - REABERTO OU SUBSTITUÍDO'} | Base: custos da competência`,
  issued:`Fechado por ${snapshot.closedBy} em ${stamp(snapshot.closedAt)} (America/Cuiaba). Emissão: ${stamp(issuedAt)}.`,
  note:'Valores exatos conferidos pelo responsável. Lucro bruto externo já desconta a compra do ouro; somente as contas abaixo são deduzidas aqui. Não representa saldo bancário.',
  stats:[{label:'Lucro bruto faturado',value:money(gross)},{label:'Contas da competência',value:money(cost)},{label:'Lucro líquido',value:signedMoney(gross-cost)}],
  sections:[
   {title:'Resultado do mês',columns:['Indicador','Valor / critério'],widths:[1.2,2],rows:[
    ['Ouro comprado no mês',gramsLabel(mg)],['Custo logístico por grama',rate===null?'Não calculável - nenhuma grama comprada':money(rate)+' / g'],
    ['Fórmula logística','Contas exatas do mês / gramas compradas no mesmo mês'],['Lucro líquido',`${signedMoney(gross-cost)} (${gross-cost>0?'positivo':gross-cost<0?'negativo':'equilíbrio'})`],
    ['Fórmula do resultado','Lucro bruto faturado - contas exatas da competência'],
    ['Obrigações do sistema no fechamento',money(snapshot.source.total)],['Pagamentos por data no mês (informativo)',money(snapshot.source.paid)],
    ['Folhas não conferidas / gramas pendentes',`${snapshot.source.unconfirmedPayroll} / ${snapshot.source.pendingGrams}`],['Ajuste do custo informado',snapshot.adjustment||'Sem ajuste'],['Justificativa',snapshot.reason]
   ]},
   {title:'Auditoria da competência',columns:['Data / estado','Responsável / ação','Justificativa'],widths:[1.2,1.4,1.6],rows:r.history.map(e=>[`${stamp(e.at)} / ${{draft:'Parcial',closed:'Fechado',reopened:'Reaberto'}[e.status]}`,`${e.actor} / ${{managementPartial:'Atualização parcial',managementClose:'Fechamento oficial',managementReopen:'Reabertura'}[e.operation]}`,e.reason])}
  ]
 };
}
