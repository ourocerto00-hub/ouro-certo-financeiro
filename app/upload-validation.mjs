export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export function detectAllowedFileType(data){
  if(!(data instanceof Uint8Array))return null;
  if(data.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v))return 'image/png';
  if(data.length>=4 && data[0]===255 && data[1]===216 && data[2]===255 && data[data.length-2]===255 && data[data.length-1]===217)return 'image/jpeg';
  if(data.length>=6 && [37,80,68,70,45].every((v,i)=>data[i]===v) && data.slice(0,1024).includes(10))return 'application/pdf';
  return null;
}
export function safeAttachmentName(name){
  const value=String(name||'comprovante').split(/[\\/]/).pop().replace(/[\r\n\u0000-\u001f\u007f]/g,'').slice(0,120).trim();
  return value||'comprovante';
}
export function validObjectKey(key){return typeof key==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);}
