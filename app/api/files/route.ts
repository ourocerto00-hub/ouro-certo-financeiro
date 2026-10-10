
export const runtime = 'nodejs';

import { env } from '../../../server/runtime';
import { requireRole, checkOrigin } from '../../auth';

import {
  detectAllowedFileType,
  safeAttachmentName,
  validObjectKey,
  MAX_UPLOAD_BYTES,
} from '../../upload-validation.mjs';

// Verifica se o usuário está autorizado.
async function authorize() {
  const user = await requireRole();

  if (!user?.email) {
    throw new Error('Acesso negado.');
  }

  const row = await env.DB.prepare(
    'SELECT state FROM revisions ORDER BY revision DESC LIMIT 1'
  ).first();

  if (!row) {
    throw new Error('Sistema ainda não inicializado.');
  }

  const state = JSON.parse(String(row.state));

  const authorized =
    Array.isArray(state.users) &&
    state.users.some(
      (entry: { active: boolean; email: string }) =>
        entry.active &&
        typeof entry.email === 'string' &&
        entry.email.toLowerCase() === user.email.toLowerCase()
    );

  if (!authorized) {
    throw new Error('Acesso negado.');
  }

  return user;
}

// Envia um comprovante.
export async function POST(req: Request) {
  try {
    await authorize();

    // Usa a proteção de origem centralizada do Railway.
    checkOrigin(req);

    const sizeHeader = req.headers.get('content-length');

    if (
      sizeHeader &&
      Number(sizeHeader) > MAX_UPLOAD_BYTES + 1024 * 1024
    ) {
      throw new Error('Requisição muito grande.');
    }

    const formData = await req.formData();
    const file = formData.get('file');

    // Garante que o conteúdo recebido seja um arquivo.
    if (!(file instanceof File)) {
      throw new Error('Selecione um arquivo válido.');
    }

    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Envie um arquivo de até 5 MB.');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Identifica o formato real do arquivo.
    const contentType = detectAllowedFileType(bytes);

    if (!contentType || contentType !== file.type) {
      throw new Error(
        'Conteúdo do arquivo inválido ou incompatível com o tipo declarado.'
      );
    }

    const key = crypto.randomUUID();
    const name = safeAttachmentName(file.name);

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
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado',
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

// Baixa um comprovante.
export async function GET(req: Request) {
  try {
    await authorize();

    const key = new URL(req.url).searchParams.get('key');

    if (!key || !validObjectKey(key)) {
      return new Response('Identificador inválido', {
        status: 400,
      });
    }

    const object = await env.BUCKET.get(key);

    if (!object) {
      return new Response('Não encontrado', {
        status: 404,
      });
    }

    const name = safeAttachmentName(
      object.customMetadata?.name || 'comprovante'
    );

    return new Response(object.body, {
      headers: {
        'Content-Type':
          object.httpMetadata?.contentType ||
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
