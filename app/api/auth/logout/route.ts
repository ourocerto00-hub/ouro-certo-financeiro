export const runtime='nodejs';
import {clearSession,checkOrigin,authError} from '../../../auth';
export async function POST(req:Request){try{checkOrigin(req);await clearSession();return Response.json({ok:true});}catch(e){return authError(e);}}
