'use client';
import {useRef,useState} from 'react';
import {today,money,cents} from './engine.mjs';
import {managementView,monthEnd,milligrams,gramsLabel,signedMoney,logisticsCents} from './management.mjs';

export default function ManagementPanel({state,month,role,mutate,busy,isDemo}){
 const view=managementView(state,month),r=view.record,acc=state.managementAccumulated;
 const [editor,setEditor]=useState(null),[error,setError]=useState('');
 const lock=useRef(false);
 const [values,setValues]=useState({});
 const change=e=>setValues(v=>({...v,[e.target.name]:e.target.type==='checkbox'?e.target.checked:e.target.value}));
 const admin=role==='admin'||isDemo;
 function open(mode){
  setError('');setEditor(mode);
  setValues(mode==='accumulated'?{grams:acc?String(acc.grams/1000):'',asOf:acc?.asOf||today(),reason:''}:{grams:r?.grams===undefined?'':String(r.grams/1000),gross:r?.gross===undefined?'':(r.gross/100).toFixed(2),cost:((r?.cost??view.source.total)/100).toFixed(2),reason:'',adjustment:'',reviewed:false});
 }
 let preview=null;
 try{const cost=editor==='close'?cents(values.cost):view.source.total,mg=milligrams(values.grams),gross=cents(values.gross);preview={cost,net:gross-cost,rate:logisticsCents(cost,mg)};}catch{}
 async function submit(e){
  e.preventDefault();if(lock.current||busy)return;lock.current=true;setError('');
  try{
   const op={accumulated:'managementAccumulated',partial:'managementPartial',close:'managementClose',reopen:'managementReopen'}[editor];
   const result=await mutate(op,{...values,month},false);
   if(result)setEditor(null);else setError('Não foi possível salvar. Confira a mensagem do sistema e recarregue em caso de conflito.');
  }finally{lock.current=false;}
 }
 const metric=(title,value,detail,color='')=><div><span>{title}</span><strong className={color}>{value}</strong><small>{detail}</small></div>;
 return <section className="panel management" aria-label="Painel gerencial">
  <div className="panel-head"><div><h2>Painel gerencial</h2><p>Todas as unidades · competência {month} · independente do filtro de unidade</p></div><span className="badge">{r?.status==='closed'?'Oficial fechado':r?.status==='reopened'?'Reaberto para revisão':'Parcial do mês'}</span></div>
  <p>O lucro bruto faturado vem do fechamento do lote matriz em outro sistema, já descontada a compra do ouro. Aqui são deduzidas apenas as contas da competência: obrigações, remuneração e despesas diárias, sem somar pagamentos ou vales novamente.</p>
  <div className="mini-metrics">
   {metric('Ouro comprado acumulado',gramsLabel(acc?.grams),acc?`Total histórico informado até ${acc.asOf}; atualizado por ${acc.actor}. Não usado no R$/g mensal.`:'Total histórico manual; separado do mês selecionado.')}
   {metric('Ouro comprado no mês',gramsLabel(view.grams),'Total manual do mês; não usa produção salarial como fonte.')}
   {metric('Lucro bruto faturado no mês',view.gross===null?'Não informado':money(view.gross),'Resultado externo informado, antes das contas operacionais.')}
   {metric(r?.status==='closed'?'Contas exatas do fechamento':'Contas mensais previstas',money(view.cost),r?.status==='closed'?'Valor oficial conferido; contas originais preservadas.':'Obrigações da competência; inclui contas ainda não pagas.')}
   {metric('Custo logístico mensal',view.logistics===null?'Não calculável':money(view.logistics)+' / g','Contas do mês / gramas compradas no mesmo mês.')}
   {metric('Lucro líquido do mês',view.net===null?'Não informado':signedMoney(view.net),view.net===null?'Informe o lucro bruto.':view.net>0?'Resultado positivo':view.net<0?'Resultado negativo':'Equilíbrio',view.net>0?'result-positive':view.net<0?'result-negative':'')}
  </div>
  <p>Folhas ainda não conferidas: <b>{view.source.unconfirmedPayroll}</b> · gramas salariais pendentes: <b>{view.source.pendingGrams}</b>. Confira as obrigações antes de fechar. O custo exato exige conciliação justificada quando houver folhas pendentes.</p>
  <p>Pagamentos realizados por data no mês: <b>{money(view.source.paid)}</b> (consulta separada; não são subtraídos outra vez). Gramas acumuladas nunca são o denominador do custo mensal.</p>
  {r?.status==='closed'&&r.source.total!==view.source.total&&<p className="result-negative" role="status">As obrigações do sistema mudaram após o fechamento ({money(view.source.total)} atualmente). O resultado oficial permanece preservado; revise e reabra se necessário.</p>}
  {acc&&<details><summary>Histórico do acumulado</summary><ul>{acc.history.map((e,i)=><li key={i}>{e.asOf} · {gramsLabel(e.grams)} · {e.actor} · {e.reason}</li>)}</ul></details>}
  <div className="toolbar"><div>
   <button type="button" className="button" disabled={busy} onClick={()=>open('accumulated')}>Atualizar acumulado histórico</button>
   {r?.status!=='closed'&&<button type="button" className="button" disabled={busy} onClick={()=>open('partial')}>Atualizar parcial do mês</button>}
   {admin&&r?.status!=='closed'&&<button type="button" className="primary" disabled={busy||today()<monthEnd(month)} onClick={()=>open('close')}>Fechamento mensal</button>}
   {admin&&r?.status==='closed'&&<button type="button" className="button" disabled={busy} onClick={()=>open('reopen')}>Reabrir com justificativa</button>}
  </div></div>
  {r?.status!=='closed'&&<p>O fechamento oficial exige revisão de um administrador e fica disponível a partir de {monthEnd(month)} (America/Cuiaba). Não é automático.</p>}
  {editor&&<form onSubmit={submit} className="management-editor">
   <h3>{({partial:'Atualizar parcial do mês',accumulated:'Atualizar acumulado histórico',close:'Revisar valores exatos e fechar mês',reopen:'Reabrir fechamento oficial'})[editor]}</h3>
   <div className="form-grid">
    {editor!=='reopen'&&<label><span>{editor==='accumulated'?'Gramas acumuladas históricas':'Gramas compradas somente neste mês'} (g)</span><input required name="grams" inputMode="decimal" value={values.grams} onChange={change} placeholder="Ex.: 1234,567"/></label>}
    {editor==='accumulated'&&<label><span>Data de referência do acumulado</span><input required type="date" name="asOf" max={today()} value={values.asOf} onChange={change}/></label>}
    {['partial','close'].includes(editor)&&<label><span>Lucro bruto faturado somente neste mês (R$)</span><input required inputMode="decimal" name="gross" value={values.gross} onChange={change}/></label>}
    {editor==='close'&&<><label><span>Contas exatas da competência (R$)</span><input required inputMode="decimal" name="cost" value={values.cost} onChange={change}/></label><label><span>Explicação do ajuste, se diferente do sistema</span><textarea name="adjustment" maxLength={500} value={values.adjustment} onChange={change}/></label></>}
    <label className="full"><span>Justificativa / origem dos valores</span><textarea required name="reason" minLength={5} maxLength={500} value={values.reason} onChange={change}/></label>
   </div>
   {preview&&['partial','close'].includes(editor)&&<p aria-live="polite">Revisão: contas {money(preview.cost)} · logística {preview.rate===null?'não calculável (0 g)':money(preview.rate)+' / g'} · líquido <b className={preview.net>0?'result-positive':preview.net<0?'result-negative':''}>{signedMoney(preview.net)}</b></p>}
   {editor==='close'&&<label className="management-review"><input required type="checkbox" name="reviewed" checked={values.reviewed} onChange={change}/> Conferi o mês {month}, as gramas, o lucro bruto externo e os custos exatos da competência. Confirmo que a compra do ouro já está descontada no lucro bruto e que não dupliquei pagamentos ou vales.</label>}
   {editor==='reopen'&&<p>O PDF anterior ficará identificado como histórico. Os valores e os responsáveis permanecem na auditoria. Após a correção será necessária uma nova confirmação de fechamento.</p>}
   {error&&<p role="alert" className="result-negative">{error}</p>}
   <div className="modal-footer"><button className="button" type="button" disabled={busy} onClick={()=>setEditor(null)}>Cancelar</button><button className="primary" type="submit" disabled={busy}>{busy?'Salvando…':editor==='close'?'Confirmar fechamento oficial':'Salvar'}</button></div>
  </form>}
  {!!r?.history.length&&<details><summary>Fechamentos, PDFs e auditoria ({r.history.length})</summary><div className="table-wrap"><table><thead><tr><th>Data / hora (Cuiabá)</th><th>Responsável</th><th>Estado / versão</th><th>Justificativa</th><th>PDF</th></tr></thead><tbody>{r.history.map((e,i)=><tr key={i}><td>{new Date(e.at).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})}</td><td>{e.actor}</td><td>{e.operation==='managementClose'?`Fechado v${e.version}${r.status==='closed'&&r.version===e.version?' · oficial':' · histórico'}`:e.operation==='managementReopen'?'Reaberto':'Parcial atualizado'}</td><td className="management-reason">{e.reason}</td><td>{e.operation==='managementClose'&&!isDemo&&<a className="text-button" href={`/api/management/pdf?month=${month}&version=${e.version}`} target="_blank" rel="noreferrer">Baixar PDF v{e.version}</a>}</td></tr>)}</tbody></table></div></details>}
 </section>;
}
