
/**
 * Ouro Certo - Railway / Node.js
 * Banco SQLite persistente e armazenamento de comprovantes.
 *
 * O banco é inicializado apenas quando necessário.
 * As tabelas existentes e os dados financeiros são preservados.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const base = resolve(
  /* turbopackIgnore: true */
  process.env.DATA_DIR || './data'
);

let database: DatabaseSync | null = null;

// Inicialização segura do banco SQLite.
function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  mkdirSync(base, { recursive: true });

  const db = new DatabaseSync(
    join(base, 'ouro-certo.sqlite')
  );

  try {
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
    `);

    initializeDatabase(db);

    database = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

// Cria estruturas ausentes sem apagar dados existentes.
function initializeDatabase(db: DatabaseSync): void {
  const statements = [
    `CREATE TABLE IF NOT EXISTS revisions (
      revision INTEGER PRIMARY KEY NOT NULL,
      request_id TEXT NOT NULL,
      state TEXT NOT NULL,
      actor TEXT NOT NULL,
      operation TEXT NOT NULL,
      created_at TEXT NOT NULL,
      justification TEXT DEFAULT '' NOT NULL
    )`,

    `CREATE UNIQUE INDEX IF NOT EXISTS
      revisions_request_id_unique
      ON revisions(request_id)`,

    `CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL
        CHECK(role IN ('admin', 'financeiro')),
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`,

    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL
        REFERENCES auth_users(id),
      expires_at INTEGER NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS
      idx_auth_sessions_expiry
      ON auth_sessions(expires_at)`,
  ];

  db.exec('BEGIN IMMEDIATE');

  try {
    for (const statement of statements) {
      db.exec(statement);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Adaptador utilizado pelas APIs financeiras.
class Statement {
  private sql: string;
  private args: any[];

  constructor(sql: string, args: any[] = []) {
    this.sql = sql;
    this.args = args;
  }

  bind(...args: any[]) {
    return new Statement(this.sql, args);
  }

  async first() {
    return (
      getDatabase()
        .prepare(this.sql)
        .get(...this.args) ?? null
    );
  }

  async all() {
    return {
      results: getDatabase()
        .prepare(this.sql)
        .all(...this.args),
    };
  }

  async run() {
    const info = getDatabase()
      .prepare(this.sql)
      .run(...this.args);

    return {
      meta: {
        changes: Number(info.changes),
      },
    };
  }
}

const DB = {
  prepare(sql: string) {
    return new Statement(sql);
  },
};

// Diretório persistente dos comprovantes.
function getStorage(): string {
  const storage = join(base, 'uploads');

  mkdirSync(storage, { recursive: true });

  return storage;
}

function validKey(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    key
  );
}

// Armazenamento de arquivos no volume Railway.
const BUCKET = {
  async put(
    key: string,
    bytes: Uint8Array,
    opts: any
  ) {
    if (!validKey(key)) {
      throw new Error(
        'Identificador de comprovante inválido.'
      );
    }

    const storage = getStorage();

    writeFileSync(
      join(storage, key),
      bytes,
      { flag: 'wx' }
    );

    writeFileSync(
      join(storage, key + '.json'),
      JSON.stringify({
        httpMetadata: opts?.httpMetadata,
        customMetadata: opts?.customMetadata,
      }),
      { flag: 'wx' }
    );
  },

  async get(key: string) {
    if (!validKey(key)) {
      return null;
    }

    const storage = getStorage();
    const filePath = join(storage, key);
    const metadataPath = join(storage, key + '.json');

    if (
      !existsSync(filePath) ||
      !existsSync(metadataPath)
    ) {
      return null;
    }

    const metadata = JSON.parse(
      readFileSync(metadataPath, 'utf8')
    );

    return {
      ...metadata,
      body: new Uint8Array(
        readFileSync(filePath)
      ),
    };
  },
};

// Interface utilizada pelo sistema financeiro.
export const env = {
  DB,
  BUCKET,

  get BOOTSTRAP_SECRET() {
    return process.env.BOOTSTRAP_SECRET || '';
  },
};
