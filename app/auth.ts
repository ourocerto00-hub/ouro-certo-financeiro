// Independent D1-backed authentication; never trust client-supplied roles.
import {env} from '../server/runtime';
import {cookies} from 'next/headers';
const encoder=new TextEncoder();
const COOKIE='ouro_session';
export async function hashPassword(password:string,salt:string){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const raw=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:210000,hash:'SHA-256'},key,256);
 return Array.from(new Uint8Array(raw)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function same(a:string,b:string){if(a.length!==b.length)return false;let r=0;for(let i=0;i<a.length;i++)r|=a.charCodeAt(i)^b.charCodeAt(i);return r===0;}
export async function currentUser(){
 const cookie=(await cookies()).get(COOKIE)?.value;
 if(!cookie||!/^[0-9a-f-]{36}$/i.test(cookie))return null;
 const row=await env.DB.prepare('SELECT u.id,u.email,u.name,u.role FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>? AND u.active=1').bind(cookie,Date.now()).first();
 return row?{userId:String(row.id),email:String(row.email),displayName:String(row.name),role:String(row.role)}:null;
}
export async function createSession(userId:string){
 const token=crypto.randomUUID();const expires=Date.now()+8*60*60*1000;
 await env.DB.prepare('INSERT INTO auth_sessions(id,user_id,expires_at) VALUES(?,?,?)').bind(token,userId,expires).run();
 (await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*60*60});
}
export async function clearSession(){const cookie=(await cookies()).get(COOKIE)?.value;if(cookie)await env.DB.prepare('DELETE FROM auth_sessions WHERE id=?').bind(cookie).run();(await cookies()).delete(COOKIE);}
export async function requireRole(role?:string){const u=await currentUser();if(!u)throw Error('AUTH');if(role&&u.role!==role)throw Error('FORBIDDEN');return u;}
export function checkOrigin(req:Request){
 const origin=req.headers.get('origin');
 if(!origin)throw Error('Origem não informada.');
 let received:string;
 try{received=new URL(origin).origin;}catch{throw Error('Origem inválida.');}
 const environment:NodeJS.ProcessEnv=process.env;
 const configured=environment['APP_URL'] || (environment['RAILWAY_PUBLIC_DOMAIN']?`https://${environment['RAILWAY_PUBLIC_DOMAIN']}`:undefined);
 if(!configured)throw Error('APP_URL não configurada no servidor.');
 let allowed:string;
 try{const url=new URL(configured);if(process.env.NODE_ENV==='production'&&url.protocol!=='https:')throw Error();allowed=url.origin;}catch{throw Error('APP_URL inválida.');}
 if(received!==allowed)throw Error('Origem inválida.');
}
export function authError(e:any){const msg=String(e?.message||e);return Response.json({error:msg},{status:msg==='AUTH'?401:msg==='FORBIDDEN'?403:400,headers:{'Cache-Control':'no-store'}});}
