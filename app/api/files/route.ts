
export const runtime = 'nodejs';

import { env } from '../../../server/runtime';
import { requireRole } from '../../auth';
import {
  detectAllowedFileType,
  safeAttachmentName,
  validObjectKey,
  MAX_UPLOAD_BYTES,
} from '../../upload-validation.mjs';

async function authorize() {
  const u = await requireRole();

  if (!u?.email) {
    throw new Error('Acesso negado.');
  }

  const row = await env.DB.prepare(
    'SELECT state FROM revisions ORDER BY revision DESC LIMIT 1'
  ).first();

  // Impede uploads antes da inicialização do sistema.
  if (!row) {
    throw new Error('Sistema ainda não inicializado.');
  }

  const state = JSON.parse(String(row.state));

  const authorized = Array.isArray(state.users) &&
    state.users.some(
      (x: { active: boolean; email: string }) =>
        x.active &&
        typeof x.email === 'string' &&
        x.email.toLowerCase() === u.email.toLowerCase()
    );

  if (!authorized) {
    throw new Error('Acesso negado.');
  }

  return u;
}

function requireSameOrigin(req: Request) {
  const origin = req.headers.get('origin');

  if (origin && origin !== new URL(req.url).origin) {
    throw new Error('Origem inválida.');
  }
}

export async function POST(req: Request) {
  try {
    await authorize();
    requireSameOrigin(req);

    const sizeHeader = req.headers.get('content-length');

    if (
      sizeHeader &&
      Number(sizeHeader) > MAX_UPLOAD_BYTES + 1024 * 1024
    ) {
      throw new Error('Requisição muito grande.');
    }

    const formData = await req.formData();
    const f = formData.get('file');

    // Correção TypeScript:
    // Garante que o valor recebido seja um arquivo.
    if (!(f instanceof File)) {
      throw new Error('Selecione um arquivo válido.');
    }

    // Verifica o tamanho do arquivo.
    if (f.size === 0 || f.size > MAX_UPLOAD_BYTES) {
      throw new Error('Envie um arquivo de até 5 MB.');
    }

    // Converte o arquivo para bytes.
    const bytes = new Uint8Array(await f.arrayBuffer());

    // Detecta o tipo real pelo conteúdo.
    const contentType = detectAllowedFileType(bytes);

    if (!contentType || contentType !== f.type) {
      throw new Error(
        'Conteúdo do arquivo inválido ou incompatível com o tipo declarado.'
      );
    }

    // Identificador e nome seguros.
    const key = crypto.randomUUID();
    const name = safeAttachmentName(f.name);

    // Armazena o comprovante.
    await env.BUCKET.put(key, bytes, {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        name,
      },
    });

    return Response.json(
      { key, name },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : 'Erro inesperado',
      },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

export async function GET(req: Request) {
  try {
    await authorize();

    const key = new URL(req.url).searchParams.get('key');

    if (!key || !validObjectKey(key)) {
      return new Response('Identificador inválido', {
        status: 400,
      });
    }

    const obj = await env.BUCKET.get(key);

    if (!obj) {
      return new Response('Não encontrado', {
        status: 404,
      });
    }

    const name = safeAttachmentName(
      obj.customMetadata?.name || 'comprovante'
    );

    return new Response(obj.body, {
      headers: {
        'Content-Type':
          obj.httpMetadata?.contentType ||
          'application/octet-stream',

        'Content-Disposition':
          `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,

        'Cache-Control': 'private, no-store',

        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch {
    return new Response('Acesso negado', {
      status: 403,
    });
  }
}
