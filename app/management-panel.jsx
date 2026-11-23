'use client';
import {useRef,useState} from 'react';
import {today,money,cents} from './engine.mjs';
import {managementView,managementSeries,partialEntries,accumulatedEntries,milligrams,gramsLabel,signedMoney,logisticsCents} from './management.mjs';

const stamp=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'});
const inputGrams=value=>value===null||value===undefined?'':String(value/1000).replace('.',',');
const inputMoney=value=>value===null||value===undefined?'':(value/100).toFixed(2);
export default function ManagementPanel({state,month,role,mutate,busy,isDemo}){
 const view=managementView(state,month),r=view.record;
 const series=managementSeries(state),legacy=accumulatedEntries(state);
 const entries=(state.managementMonths||[]).flatMap(record=>partialEntries(record).map(entry=>({...entry,locked:record.status==='closed',latest:partialEntries(record).at(-1)?.id===entry.id}))).sort((a,b)=>b.at.localeCompare(a.at));
 const accumulated=series.reduce((total,item)=>total+item.grams,0);
 const [editor,setEditor]=useState(null),[error,setError]=useState(''),[values,setValues]=useState({});
 const lock=useRef(false),admin=role==='admin'||isDemo;
 const change=e=>setValues(v=>({...v,[e.target.name]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
 function open(mode,entry){
  setError('');setEditor(mode);
  setValues({month:entry?.month||month,entryId:entry?.id,grams:inputGrams(entry?.grams??r?.grams),gross:inputMoney(entry?.gross??r?.gross),asOf:entry?.asOf||today(),cost:inputMoney(r?.cost??view.source.total),reason:'',adjustment:'',reviewed:false});
 }
 let preview=null;
 try{
  const cost=editor==='close'?cents(values.cost):managementView(state,values.month||month).source.total,mg=milligrams(values.grams),gross=cents(values.gross);
  preview={cost,net:gross-cost,rate:logisticsCents(cost,mg)};
 }catch{}
 async function submit(e){
  e.preventDefault();if(lock.current||busy)return;lock.current=true;setError('');
  try{
   const op={partial:'managementPartial',edit:'managementEditPartial',delete:'managementDeletePartial',editLegacy:'managementEditAccumulated',deleteLegacy:'managementDeleteAccumulated',close:'managementClose',reopen:'managementReopen'}[editor];
   const result=await mutate(op,values,false,setError);
   if(result)setEditor(null);
  }finally{lock.current=false;}
 }
 const metric=(title,value,detail,color='')=><div><span>{title}</span><strong className={color}>{value}</strong><small>{detail}</small></div>;
 const deletion=editor==='delete'||editor==='deleteLegacy';
 return <>
 <section className="panel management" aria-label="Fecha Real">
  <div className="panel-head"><div><h2>Fecha Real</h2><p>Todas as unidades · competência {month} · independente do filtro de unidade</p></div><span className="badge">{r?.status==='closed'?'Oficial fechado':r?.status==='reopened'?'Reaberto para revisão':'Parcial do mês'}</span></div>
  <p>Escolha a competência de referência. Você pode lançar em novembro os valores destinados ao fechamento de dezembro. O lucro bruto vem do outro sistema, já descontada a compra do ouro; aqui são deduzidas apenas as contas da competência escolhida.</p>
  <div className="mini-metrics">
   {metric('Ouro acumulado informado',series.length?gramsLabel(accumulated):'Não informado','Soma do último valor de cada competência; atualizações do mesmo mês não são somadas novamente.')}
   {metric('Ouro comprado · competência',gramsLabel(view.grams),'Último valor informado para a competência selecionada.')}
   {metric('Lucro bruto faturado',view.gross===null?'Não informado':money(view.gross),'Resultado externo informado para a competência selecionada.')}
   {metric(r?.status==='closed'?'Contas exatas do fechamento':'Contas da competência · previstas',money(view.cost),r?.status==='closed'?'Valor oficial conferido; contas originais preservadas.':'Obrigações da competência; inclui contas ainda não pagas.')}
   {metric('Custo logístico por grama',view.logistics===null?'Não calculável':money(view.logistics)+' / g','Contas / gramas da mesma competência.')}
   {metric('Lucro líquido',view.net===null?'Não informado':signedMoney(view.net),view.net===null?'Informe o lucro bruto.':view.net>0?'Resultado positivo':view.net<0?'Resultado negativo':'Equilíbrio',view.net>0?'result-positive':view.net<0?'result-negative':'')}
  </div>
  <p>Pagamentos realizados por data na competência: <b>{money(view.source.paid)}</b> (consulta separada; não são deduzidos outra vez). Folhas não conferidas: <b>{view.source.unconfirmedPayroll}</b>.</p>
  {r?.status==='closed'&&r.source.total!==view.source.total&&<p className="result-negative" role="status">As obrigações do sistema mudaram após o fechamento ({money(view.source.total)} atualmente). O resultado oficial foi preservado; revise e reabra se necessário.</p>}
  <div className="toolbar"><div>
   {r?.status!=='closed'&&<button type="button" className="primary" disabled={busy} onClick={()=>open('partial')}>Atualizar parcial do mês</button>}
   {admin&&r?.status!=='closed'&&<button type="button" className="button" disabled={busy} onClick={()=>open('close')}>Fechamento mensal oficial</button>}
   {admin&&r?.status==='closed'&&<button type="button" className="button" disabled={busy} onClick={()=>open('reopen')}>Reabrir com justificativa</button>}
   {r?.gross!==null&&r?.gross!==undefined&&r?.grams!==null&&r?.grams!==undefined&&!isDemo&&<a className="button" href={`/api/management/pdf?month=${month}&mode=partial`} target="_blank" rel="noreferrer">Baixar PDF parcial</a>}
   {r?.status==='closed'&&!isDemo&&<a className="button" href={`/api/management/pdf?month=${month}&version=${r.version}`} target="_blank" rel="noreferrer">Baixar PDF oficial</a>}
  </div></div>
  <p>Você decide quando confirmar o fechamento oficial, em qualquer dia e horário. Os PDFs usam os valores já salvos: parcial para acompanhamento e oficial após a confirmação.</p>
  {editor&&<form onSubmit={submit} className="management-editor">
   <h3>{({partial:'Atualizar parcial do mês',edit:'Editar lançamento',delete:'Apagar lançamento',editLegacy:'Editar acumulado anterior',deleteLegacy:'Apagar acumulado anterior',close:'Revisar valores exatos e fechar mês',reopen:'Reabrir fechamento oficial'})[editor]} · {values.month}</h3>
   {deletion?<p>Apagar este registro de {gramsLabel(values.grams?milligrams(values.grams):0)}{editor==='delete'?' / '+money(cents(values.gross)):''}? Se for o último lançamento da competência, o anterior voltará a ser considerado. A exclusão permanece registrada na auditoria.</p>:<div className="form-grid">
    {editor!=='reopen'&&<label><span>Gramas compradas (g)</span><input required name="grams" inputMode="decimal" value={values.grams} onChange={change} placeholder="Ex.: 1000,125"/><small>Sem separador de milhar. Ex.: 1000,125 g.</small></label>}
    {['partial','edit','close'].includes(editor)&&<label><span>Lucro bruto faturado (R$)</span><input required inputMode="decimal" name="gross" value={values.gross} onChange={change}/></label>}
    {editor==='editLegacy'&&<label><span>Data de referência</span><input required type="date" name="asOf" max={today()} value={values.asOf} onChange={change}/></label>}
    {editor==='close'&&<><label><span>Contas exatas da competência (R$)</span><input required inputMode="decimal" name="cost" value={values.cost} onChange={change}/></label><label><span>Explicação do ajuste, se diferente do sistema</span><textarea name="adjustment" maxLength={500} value={values.adjustment} onChange={change}/></label></>}
    {['close','reopen'].includes(editor)&&<label className="full"><span>Justificativa / origem dos valores</span><textarea required name="reason" minLength={5} maxLength={500} value={values.reason} onChange={change}/></label>}
   </div>}
   {preview&&['partial','edit','close'].includes(editor)&&<p aria-live="polite">Contas {money(preview.cost)} · logística {preview.rate===null?'não calculável (0 g)':money(preview.rate)+' / g'} · líquido <b className={preview.net>0?'result-positive':preview.net<0?'result-negative':''}>{signedMoney(preview.net)}</b></p>}
   {editor==='close'&&<label className="management-review"><input required type="checkbox" name="reviewed" checked={values.reviewed} onChange={change}/> Conferi a competência {month}, as gramas, o lucro bruto externo e os custos exatos. A compra do ouro já foi descontada no lucro bruto, sem duplicar pagamentos ou vales.</label>}
   {editor==='reopen'&&<p>O PDF anterior ficará no histórico. Após a correção será necessária uma nova confirmação de fechamento.</p>}
   {error&&<p role="alert" className="result-negative">{error}</p>}
   <div className="modal-footer"><button className="button" type="button" disabled={busy} onClick={()=>setEditor(null)}>Cancelar</button><button className="primary" type="submit" disabled={busy}>{busy?'Salvando…':deletion?'Confirmar exclusão':editor==='close'?'Confirmar fechamento oficial':'Salvar'}</button></div>
  </form>}
  <details><summary>Histórico acumulado de lançamentos ({entries.length})</summary>
   <p>Cada atualização aparece no histórico. O painel e o gráfico usam somente o último valor ativo de cada competência. Editar um registro antigo não cria um segundo resultado mensal.</p>
   <div className="table-wrap"><table><thead><tr><th>Competência / registro</th><th>Gramas</th><th>Lucro bruto</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>{entries.map(e=><tr key={e.id}><td>{e.month}{e.latest?' · último':''}<small>{stamp(e.at)}{e.editedAt?' · editado '+stamp(e.editedAt):''}</small></td><td>{gramsLabel(e.grams)}</td><td>{money(e.gross)}</td><td>{e.actor}</td><td><div className="row-actions"><button className="small-button" type="button" disabled={busy||e.locked} onClick={()=>open('edit',e)}>Editar</button><button className="small-button" type="button" disabled={busy||e.locked} onClick={()=>open('delete',e)}>Apagar</button></div>{e.locked&&<small>Reabra o mês para alterar.</small>}</td></tr>)}</tbody></table></div>
   {!entries.length&&<p>Nenhum lançamento salvo.</p>}
   {!!legacy.length&&<><h3>Acumulados anteriores</h3><p>Valores históricos preservados, sem somar aos novos totais por competência para evitar duplicidade.</p><div className="table-wrap"><table><thead><tr><th>Referência</th><th>Gramas</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>{legacy.map(e=><tr key={e.id}><td>{e.asOf}</td><td>{gramsLabel(e.grams)}</td><td>{e.actor}</td><td><div className="row-actions"><button type="button" className="small-button" disabled={busy} onClick={()=>open('editLegacy',e)}>Editar</button><button type="button" className="small-button" disabled={busy} onClick={()=>open('deleteLegacy',e)}>Apagar</button></div></td></tr>)}</tbody></table></div></>}
  </details>
  {!!r?.history.length&&<details><summary>Fechamentos oficiais, PDFs e auditoria</summary><div className="table-wrap"><table><thead><tr><th>Data / hora (Cuiabá)</th><th>Responsável</th><th>Estado / ação</th><th>Registro</th><th>PDF</th></tr></thead><tbody>{r.history.map((e,i)=><tr key={e.id||i}><td>{stamp(e.at)}</td><td>{e.actor}</td><td>{e.operation==='managementClose'?`Fechado v${e.version}${r.status==='closed'&&r.version===e.version?' · oficial':' · histórico'}`:({managementReopen:'Reaberto',managementPartial:'Parcial atualizado',managementEditPartial:'Parcial editado',managementDeletePartial:'Parcial apagado'})[e.operation]}</td><td className="management-reason">{e.reason}</td><td>{e.operation==='managementClose'&&!isDemo&&<a className="text-button" href={`/api/management/pdf?month=${month}&version=${e.version}`} target="_blank" rel="noreferrer">Baixar PDF v{e.version}</a>}</td></tr>)}</tbody></table></div></details>}
 </section>
 <section className="panel management" aria-label="Gráfico de lucro líquido por competência">
  <div className="panel-head"><div><h2>Lucro líquido real mês a mês</h2><p>Um resultado por competência: último parcial salvo ou fechamento oficial. As contas previstas do parcial podem mudar; valores oficiais permanecem fixos.</p></div></div>
  {!series.length?<p>Salve um parcial para começar a acompanhar o resultado mensal.</p>:<div className="profit-chart-scroll"><div className="profit-chart" style={{gridTemplateColumns:`repeat(${series.length},minmax(110px,1fr))`}}>{series.map(item=>{
   const max=Math.max(1,...series.map(x=>Math.abs(x.net))),height=item.net?Math.max(2,Math.abs(item.net)/max*100):0;
   return <div className="profit-column" key={item.month} aria-label={`${item.month}: ${signedMoney(item.net)}, ${item.status==='closed'?'oficial':'parcial'}`}><strong className={item.net<0?'result-negative':'result-positive'}>{signedMoney(item.net)}</strong><div className="profit-positive-track">{item.net>=0&&<div className="profit-bar positive" style={{height:height+'%'}}/>}</div><div className="profit-zero"/><div className="profit-negative-track">{item.net<0&&<div className="profit-bar negative" style={{height:height+'%'}}/>}</div><span>{item.month}<small>{item.status==='closed'?'Oficial':'Parcial'}</small></span></div>;
  })}</div></div>}
 </section>
 </>;
}
