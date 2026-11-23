export const runtime='nodejs';
import {env} from '../../../server/runtime';
import {requireRole,checkOrigin,canManageReal} from '../../auth';
import {initial,apply} from '../../engine.mjs';
import {isManagementOperation,visibleState} from '../../management-access.mjs';

const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function context(){
 const user=await requireRole();
 const row=await env.DB.prepare('SELECT * FROM revisions ORDER BY revision DESC LIMIT 1').first();
 const state=row?JSON.parse(String(row.state)):initial(user.email.toLowerCase());
 return {user,row,state};
}
export async function GET(req:Request){
 try{
  const {user,row,state}=await context(),allowed=canManageReal(user),url=new URL(req.url);
  if(url.searchParams.has('audit')){
   const query=allowed?'SELECT revision, actor, operation, created_at, justification FROM revisions ORDER BY revision DESC LIMIT 500':"SELECT revision, actor, operation, created_at, justification FROM revisions WHERE operation NOT LIKE 'management%' ORDER BY revision DESC LIMIT 500";
   const {results}=await env.DB.prepare(query).all();
   return response({events:results});
  }
  if(url.searchParams.has('revision')){
   const revision=Number(url.searchParams.get('revision'));
   const r=await env.DB.prepare('SELECT state FROM revisions WHERE revision=?').bind(revision).first();
   const prev=await env.DB.prepare('SELECT state FROM revisions WHERE revision=?').bind(revision-1).first();
   return response({before:visibleState(prev?JSON.parse(String(prev.state)):null,allowed),after:visibleState(r?JSON.parse(String(r.state)):null,allowed)});
  }
  return response({state:visibleState(state,allowed),revision:row?.revision||0,user:user.displayName,email:user.email,role:user.role,canManageReal:allowed});
 }catch(e){
  const msg=e instanceof Error?e.message:'Erro inesperado';
  return response({error:msg},msg==='AUTH'?401:403);
 }
}
export async function POST(req:Request){
 try{
  const {user,row,state}=await context();
  checkOrigin(req);
  const body=await req.json() as {requestId?:string;revision?:number;op:string;input:Record<string,unknown>};
  const allowed=canManageReal(user);
  if(isManagementOperation(body.op)&&!allowed)throw Error('FORBIDDEN');
  if(!body.requestId||typeof body.requestId!=='string'||body.requestId.length>100)throw Error('Identificador inválido.');
  const previous=await env.DB.prepare('SELECT revision FROM revisions WHERE request_id=?').bind(body.requestId).first();
  if(previous)return response({state:visibleState(state,allowed),revision:row?.revision??0});
  if(body.revision!==(row?.revision||0))return response({error:'Outro lançamento atualizou os dados. Recarregue e tente novamente.'},409);
  if(user.role!=='admin'&&['user','unit','category','rate','account'].includes(body.op))throw Error('FORBIDDEN');
  const next=apply(state,body.op,body.input,user.email),revision=Number(row?.revision??0)+1;
  const result=await env.DB.prepare('INSERT INTO revisions (revision,request_id,state,actor,operation,created_at,justification) SELECT ?,?,?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM revisions),0)=?')
   .bind(revision,body.requestId,JSON.stringify(next),user.email,body.op,new Date().toISOString(),typeof body.input.reason==='string'?body.input.reason:'',revision-1).run();
  if(!result.meta.changes)return response({error:'Conflito de atualização. Recarregue os dados.'},409);
  return response({state:visibleState(next,allowed),revision});
 }catch(e){
  const msg=e instanceof Error?e.message:'Erro inesperado';
  return response({error:msg},msg==='AUTH'?401:msg==='FORBIDDEN'?403:400);
 }
}
