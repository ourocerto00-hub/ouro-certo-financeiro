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
 return {...summary(s,month,'all'),calculationBasis:'reference-month-v1',pendingGrams:s.payroll.filter(p=>p.month===month&&!commissionReady(p)).length,unconfirmedPayroll:s.payroll.filter(p=>p.month===month&&!p.confirmed).length};
}
export function managementView(s,month){
 monthEnd(month);
 const record=(s.managementMonths||[]).find(r=>r.month===month);
 const source=managementSource(s,month);
 const cost=record?.status==='closed'?record.cost:source.total;
 const grams=record?.grams??null,gross=record?.gross??null;
 return {record,source,cost,grams,gross,logistics:logisticsCents(cost,grams),net:gross===null?null:gross-cost};
}
// Saved updates are totals for a competence, never quantities to add together.
export function partialEntries(record){
 const entries=[];
 for(const [index,event] of (record?.history||[]).entries()){
  if(event.operation==='managementPartial')entries.push({...event,id:event.id||`${record.month}-${index}`,month:record.month});
  if(event.operation==='managementEditPartial'){
   const entry=entries.find(e=>e.id===event.targetId);
   if(entry)Object.assign(entry,{grams:event.grams,gross:event.gross,editedAt:event.at,editedBy:event.actor});
  }
  if(event.operation==='managementDeletePartial'){
   const entry=entries.find(e=>e.id===event.targetId);if(entry)entry.deleted=true;
  }
 }
 return entries.filter(e=>!e.deleted);
}
export function managementSeries(s){
 return (s.managementMonths||[]).map(r=>{
  const v=managementView(s,r.month);
  return {month:r.month,grams:v.grams,gross:v.gross,cost:v.cost,net:v.net,status:r.status};
 }).filter(r=>r.gross!==null&&r.grams!==null).sort((a,b)=>a.month.localeCompare(b.month));
}
export function accumulatedEntries(s){
 const entries=[];
 for(const [index,event] of (s.managementAccumulated?.history||[]).entries()){
  if(!event.operation||event.operation==='managementAccumulated')entries.push({...event,id:event.id||`accumulated-${index}`});
  if(event.operation==='managementEditAccumulated'){
   const entry=entries.find(e=>e.id===event.targetId);if(entry)Object.assign(entry,{grams:event.grams,asOf:event.asOf});
  }
  if(event.operation==='managementDeleteAccumulated'){
   const entry=entries.find(e=>e.id===event.targetId);if(entry)entry.deleted=true;
  }
 }
 return entries.filter(e=>!e.deleted);
}
const reason=value=>{const v=String(value??'').trim();check(v.length>=5&&v.length<=500,'Informe uma justificativa de 5 a 500 caracteres.');return v;};
export function applyManagement(s,op,v,actor,now=new Date()){
 const timestamp=now.toISOString();
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(['managementAccumulated','managementEditAccumulated','managementDeleteAccumulated'].includes(op)){
  s.managementAccumulated??={history:[]};
  const entries=accumulatedEntries(s);
  if(op!=='managementAccumulated')check(entries.some(e=>e.id===v.entryId),'Registro acumulado não encontrado.');
  const event={id:crypto.randomUUID(),targetId:v.entryId,operation:op,actor,at:timestamp,reason:op==='managementAccumulated'?reason(v.reason):op==='managementEditAccumulated'?'Edição do registro acumulado':'Exclusão do registro acumulado'};
  if(op!=='managementDeleteAccumulated'){
   check(/^\d{4}-\d{2}-\d{2}$/.test(v.asOf)&&!isNaN(Date.parse(v.asOf))&&new Date(v.asOf).toISOString().slice(0,10)===v.asOf&&v.asOf<=day,'Data de referência inválida ou futura.');
   Object.assign(event,{grams:milligrams(v.grams),asOf:v.asOf});
  }
  s.managementAccumulated.history.push(event);
  const latest=accumulatedEntries(s).at(-1);
  Object.assign(s.managementAccumulated,{grams:latest?.grams??null,asOf:latest?.asOf??null,actor,at:timestamp});return s;
 }
 monthEnd(v.month);
 s.managementMonths??=[];
 let r=s.managementMonths.find(r=>r.month===v.month);
 if(!r){r={month:v.month,status:'draft',history:[]};s.managementMonths.push(r);}
 if(['managementEditPartial','managementDeletePartial'].includes(op)){
  check(r.status!=='closed','Reabra o fechamento com justificativa antes de alterar.');
  check(partialEntries(r).some(e=>e.id===v.entryId),'Lançamento não encontrado.');
  const event={id:crypto.randomUUID(),targetId:v.entryId,operation:op,actor,at:timestamp,status:r.status,reason:op==='managementEditPartial'?'Edição do lançamento parcial':'Exclusão do lançamento parcial'};
  if(op==='managementEditPartial'){
   event.grams=milligrams(v.grams);event.gross=cents(v.gross);logisticsCents(managementSource(s,v.month).total,event.grams);
  }
  r.history.push(event);
  const latest=partialEntries(r).at(-1);
  r.grams=latest?.grams??null;r.gross=latest?.gross??null;r.updatedAt=timestamp;r.updatedBy=actor;return s;
 }
 const justification=op==='managementPartial'?'Atualização parcial do mês':reason(v.reason);
 if(op==='managementReopen'){
  check(r.status==='closed','O mês não está fechado.');
  r.status='reopened';
 }else{
  check(r.status!=='closed','Reabra o fechamento com justificativa antes de alterar.');
  r.grams=milligrams(v.grams);r.gross=cents(v.gross);
  if(op==='managementClose'){
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
 history.push({...snapshot,id:crypto.randomUUID(),operation:op,reason:justification,at:timestamp,actor});
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
    ['Obrigações do sistema no fechamento',money(snapshot.source.total)],[snapshot.source.calculationBasis==='reference-month-v1'?'Pagamentos da referência (informativo)':'Pagamentos por data no mês (regra anterior)',money(snapshot.source.paid)],
    ['Folhas não conferidas / gramas pendentes',`${snapshot.source.unconfirmedPayroll} / ${snapshot.source.pendingGrams}`],['Ajuste do custo informado',snapshot.adjustment||'Sem ajuste'],['Justificativa',snapshot.reason]
   ]},
   {title:'Auditoria da competência',columns:['Data / estado','Responsável / ação','Justificativa'],widths:[1.2,1.4,1.6],rows:r.history.map(e=>[`${stamp(e.at)} / ${{draft:'Parcial',closed:'Fechado',reopened:'Reaberto'}[e.status]}`,`${e.actor} / ${{managementPartial:'Atualização parcial',managementClose:'Fechamento oficial',managementReopen:'Reabertura',managementEditPartial:'Edição do parcial',managementDeletePartial:'Exclusão do parcial'}[e.operation]}`,e.reason])}
  ]
 };
}

export function partialMonthlyReport(s,month,user,issuedAt=new Date()){
 monthEnd(month);
 const r=(s.managementMonths||[]).find(record=>record.month===month);
 const latest=partialEntries(r).at(-1);
 const grams=latest?.grams??r?.grams,gross=latest?.gross??r?.gross;
 check(grams!==null&&grams!==undefined&&gross!==null&&gross!==undefined,'Salve as gramas e o lucro bruto antes de baixar o parcial.');
 const source=managementSource(s,month),cost=source.total,rate=logisticsCents(cost,grams),net=gross-cost;
 const stamp=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'});
 return {
  subtitle:`Competência: ${month} | Período de referência: ${month}-01 a ${monthEnd(month)}`,
  scope:'PARCIAL - NÃO OFICIAL | Todas as unidades | Obrigações atuais da competência',
  issued:`Emitido por ${user} em ${stamp(issuedAt)} (America/Cuiaba). Último lançamento salvo: ${stamp(latest?.editedAt||latest?.at||r.updatedAt)}.`,
  note:'Acompanhamento parcial. Não confirma nem substitui um fechamento oficial. Gramas e lucro bruto são os últimos valores salvos para acompanhamento; custos são as obrigações atuais da competência, sem ajustes exclusivos do fechamento oficial. A compra do ouro já está descontada no lucro bruto externo.',
  stats:[{label:'Lucro bruto informado',value:money(gross)},{label:'Contas previstas',value:money(cost)},{label:'Lucro líquido parcial',value:signedMoney(net)}],
  sections:[{title:'Resultado parcial salvo',columns:['Indicador','Valor / critério'],widths:[1.3,2],rows:[
   ['Estado do documento','PARCIAL - NÃO OFICIAL'],['Gramas informadas',gramsLabel(grams)],['Custo por grama',rate===null?'Não calculável - nenhuma grama informada':money(rate)+' / g'],
   ['Fórmula logística','Contas da competência / gramas informadas para a mesma competência'],['Lucro líquido parcial',signedMoney(net)],['Fórmula do resultado','Lucro bruto externo - contas da competência'],
   ['Pagamentos da referência (informativo)',money(source.paid)],['Folhas não conferidas / gramas pendentes',`${source.unconfirmedPayroll} / ${source.pendingGrams}`],['Fechamento oficial da competência',r.status==='closed'?`Existe versão oficial ${r.version}; este documento continua parcial.`:r.status==='reopened'?'Reaberto para revisão':'Ainda não confirmado']
  ]}]
 };
}
