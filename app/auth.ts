
import { env } from '../server/runtime';
import { cookies } from 'next/headers';

const encoder = new TextEncoder();

const COOKIE = 'ouro_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

// Criptografia das senhas com PBKDF2.
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const raw = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 210000,
      hash: 'SHA-256',
    },
    key,
    256
  );

  return Array.from(new Uint8Array(raw))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

// Comparação segura de valores sensíveis.
export function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// Recupera o usuário autenticado.
export async function currentUser() {
  const cookie = (await cookies()).get(COOKIE)?.value;

  if (!cookie || !/^[0-9a-f-]{36}$/i.test(cookie)) {
    return null;
  }

  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role
     FROM auth_sessions s
     JOIN auth_users u ON u.id = s.user_id
     WHERE s.id = ?
       AND s.expires_at > ?
       AND u.active = 1`
  )
    .bind(cookie, Date.now())
    .first();

  if (!row) return null;

  return {
    userId: String(row.id),
    email: String(row.email),
    displayName: String(row.name),
    role: String(row.role),
  };
}

// Cria a sessão do usuário.
export async function createSession(
  userId: string
): Promise<void> {
  const token = crypto.randomUUID();
  const expires = Date.now() + SESSION_DURATION;

  await env.DB.prepare(
    `INSERT INTO auth_sessions
     (id, user_id, expires_at)
     VALUES (?, ?, ?)`
  )
    .bind(token, userId, expires)
    .run();

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION / 1000,
  });
}

// Encerra a sessão.
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (token) {
    await env.DB.prepare(
      'DELETE FROM auth_sessions WHERE id = ?'
    )
      .bind(token)
      .run();
  }

  cookieStore.delete(COOKIE);
}

// Verifica autenticação e permissões.
export async function requireRole(role?: string) {
  const user = await currentUser();

  if (!user) {
    throw new Error('AUTH');
  }

  if (role && user.role !== role) {
    throw new Error('FORBIDDEN');
  }

  return user;
}

// Verificação de origem para Railway.
export function checkOrigin(req: Request): void {
  const origin = req.headers.get('origin');

  if (!origin) {
    throw new Error('Origem não informada.');
  }

  let receivedOrigin: string;

  try {
    receivedOrigin = new URL(origin).origin;
  } catch {
    throw new Error('Origem inválida.');
  }

  // Lê a variável diretamente do ambiente em execução.
  const runtimeEnv: NodeJS.ProcessEnv = process.env;

  const configuredUrl =
    runtimeEnv['APP_URL'] ||
    (
      runtimeEnv['RAILWAY_PUBLIC_DOMAIN']
        ? `https://${runtimeEnv['RAILWAY_PUBLIC_DOMAIN']}`
        : undefined
    );

  if (!configuredUrl) {
    throw new Error('APP_URL não configurada no servidor.');
  }

  let allowedOrigin: string;

  try {
    const url = new URL(configuredUrl);

    if (
      process.env.NODE_ENV === 'production' &&
      url.protocol !== 'https:'
    ) {
      throw new Error(
        'APP_URL deve utilizar HTTPS em produção.'
      );
    }

    allowedOrigin = url.origin;
  } catch {
    throw new Error('APP_URL inválida.');
  }

  if (receivedOrigin !== allowedOrigin) {
    throw new Error('Origem inválida.');
  }
}

// Tratamento dos erros de autenticação.
export function authError(error: unknown): Response {
  const message =
    error instanceof Error
      ? error.message
      : 'Erro inesperado.';

  const status =
    message === 'AUTH'
      ? 401
      : message === 'FORBIDDEN'
        ? 403
        : 400;

  return Response.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
