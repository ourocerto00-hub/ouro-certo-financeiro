export const runtime='nodejs';
import {env} from '../../../server/runtime';
import {requireRole} from '../../auth';
import {detectAllowedFileType, safeAttachmentName, validObjectKey, MAX_UPLOAD_BYTES} from '../../upload-validation.mjs';

async function authorize(){
  const u=await requireRole();
  if(!u?.email)throw Error('Acesso negado.');
  const row=await env.DB.prepare('SELECT state FROM revisions ORDER BY revision DESC LIMIT 1').first();
  // An uninitialized installation must not make the first uploader an administrator.
  if(!row)throw Error('Sistema ainda não inicializado.');
  if(!JSON.parse(String(row.state)).users.some((x:{active:boolean,email:string})=>x.active&&x.email.toLowerCase()===u.email.toLowerCase()))throw Error('Acesso negado.');
  return u;
}
function requireSameOrigin(req:Request){
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)throw Error('Origem inválida.');
}
export async function POST(req:Request){
  try{
    await authorize();requireSameOrigin(req);
    const sizeHeader=req.headers.get('content-length');
    if(sizeHeader&&Number(sizeHeader)>MAX_UPLOAD_BYTES+1024*1024)throw Error('Requisição muito grande.');
    const f=(await req.formData()).get('file');
    if(!f||typeof f.arrayBuffer!=='function'||f.size===0||f.size>MAX_UPLOAD_BYTES)throw Error('Envie um arquivo de até 5 MB.');
    const bytes=new Uint8Array(await f.arrayBuffer());
    const contentType=detectAllowedFileType(bytes);
    if(!contentType||contentType!==f.type)throw Error('Conteúdo do arquivo inválido ou incompatível com o tipo declarado.');
    const key=crypto.randomUUID();const name=safeAttachmentName(f.name);
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType},customMetadata:{name}});
    return Response.json({key,name},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Erro inesperado'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
export async function GET(req:Request){
  try{
    await authorize();
    const key=new URL(req.url).searchParams.get('key');
    if(!key||!validObjectKey(key))return new Response('Identificador inválido',{status:400});
    const obj=await env.BUCKET.get(key);
    if(!obj)return new Response('Não encontrado',{status:404});
    const name=safeAttachmentName(obj.customMetadata?.name||'comprovante');
    return new Response(obj.body,{headers:{
      'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream',
      'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
    }});
  }catch{return new Response('Acesso negado',{status:403});}
}
