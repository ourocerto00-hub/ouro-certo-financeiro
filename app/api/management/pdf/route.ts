export const runtime='nodejs';
import {requireManagementUser} from '../../../auth';
import {env} from '../../../../server/runtime';
import {monthlyReport,partialMonthlyReport} from '../../../management.mjs';
import {buildPDF} from '../../../pdf-v13.mjs';

export async function GET(req:Request){
 try{
  const user=await requireManagementUser();
  const params=new URL(req.url).searchParams,month=params.get('month')||'',raw=params.get('version'),mode=params.get('mode')||'official';
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||raw!==null&&!/^[1-9]\d*$/.test(raw)||!['partial','official'].includes(mode)||mode==='partial'&&raw!==null)throw Error('Período, modo ou versão inválidos.');
  const row=await env.DB.prepare('SELECT state FROM revisions ORDER BY revision DESC LIMIT 1').first();
  const state=row?JSON.parse(String(row.state)):{};
  const report=mode==='partial'?partialMonthlyReport(state,month,user.email):monthlyReport(state,month,raw===null?undefined:Number(raw));
  const filename=mode==='partial'?`Ouro_Certo_Parcial_${month}.pdf`:`Ouro_Certo_Fechamento_${month}_v${raw||'atual'}.pdf`;
  return new Response(new Uint8Array(buildPDF(mode==='partial'?'Fecha Real - Parcial':'Fechamento mensal',report)),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'}});
 }catch(e){
  const message=e instanceof Error?e.message:'Erro ao gerar PDF';
  return Response.json({error:message},{status:message==='AUTH'?401:message==='FORBIDDEN'?403:400,headers:{'Cache-Control':'no-store'}});
 }
}
