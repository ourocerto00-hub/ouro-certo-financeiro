export const runtime='nodejs';
import {env} from '../../../../server/runtime';
import {hashPassword,checkOrigin,authError,createSession} from '../../../auth';
export async function POST(req:Request){try{
 checkOrigin(req);
 const {email,name,password,secret}=await req.json() as Record<string, any>;
 if(!(env as any).BOOTSTRAP_SECRET||typeof secret!=='string'||secret!==(env as any).BOOTSTRAP_SECRET)throw Error('Configuração de instalação inválida');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)throw Error('Informe e-mail e senha de 12 a 128 caracteres');
 const count=await env.DB.prepare('SELECT count(*) AS n FROM auth_users').first();if(Number(count?.n)>0)throw Error('Administrador inicial já criado');
 const id=crypto.randomUUID(),salt=crypto.randomUUID();const inserted=await env.DB.prepare('INSERT INTO auth_users(id,email,name,role,salt,password_hash,active) SELECT ?,?,?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM auth_users)').bind(id,email.toLowerCase(),name||email,'admin',salt,await hashPassword(password,salt)).run();if(!inserted.meta.changes)throw Error('Administrador inicial já criado');
 await createSession(id);return Response.json({ok:true});
 }catch(e){return authError(e);}}
