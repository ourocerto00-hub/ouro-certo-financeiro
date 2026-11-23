export const runtime='nodejs';
import {requireRole} from '../../../auth';
import {env} from '../../../../server/runtime';
import {monthlyReport} from '../../../management.mjs';
import {buildPDF} from '../../../pdf-v13.mjs';

export async function GET(req:Request){
 try{
  await requireRole();
  const params=new URL(req.url).searchParams,month=params.get('month')||'',raw=params.get('version');
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||raw!==null&&!/^[1-9]\d*$/.test(raw))throw Error('Período ou versão inválidos.');
  const row=await env.DB.prepare('SELECT state FROM revisions ORDER BY revision DESC LIMIT 1').first();
  const report=monthlyReport(row?JSON.parse(String(row.state)):{},month,raw===null?undefined:Number(raw));
  return new Response(new Uint8Array(buildPDF('Fechamento mensal',report)),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Ouro_Certo_Fechamento_${month}_v${raw||'atual'}.pdf"`,'Cache-Control':'no-store'}});
 }catch(e){
  const message=e instanceof Error?e.message:'Erro ao gerar PDF';
  return Response.json({error:message},{status:message==='AUTH'?401:message==='FORBIDDEN'?403:400,headers:{'Cache-Control':'no-store'}});
 }
}
