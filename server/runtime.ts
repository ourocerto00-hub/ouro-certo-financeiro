
/**
 * Ouro Certo - Railway / Node.js
 * Banco SQLite persistente e armazenamento de comprovantes.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const base = resolve(process.env.DATA_DIR || './data');

let database: DatabaseSync | null = null;

function getDatabase(): DatabaseSync {
  if (database) return database;

  mkdirSync(base, { recursive: true });

  const db = new DatabaseSync(join(base, 'ouro-certo.sqlite'));

  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
  `);

  try {
    initializeDatabase(db);
    database = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function tableExists(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
    ).get(name)
  );
}

function initializeDatabase(db: DatabaseSync): void {
  const requiredTables = [
    'revisions',
    'auth_users',
    'auth_sessions',
  ];

  const missingTables = requiredTables.filter(
    (name) => !tableExists(db, name)
  );

  if (missingTables.length === 0) return;

  const migration = resolve(
    process.cwd(),
    'drizzle',
    '0000_watery_sage.sql'
  );

  if (!existsSync(migration)) {
    throw new Error(
      'Arquivo de migração não encontrado: ' + migration
    );
  }

  const sql = readFileSync(migration, 'utf8');

  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  // Verifica a migração antes de executar.
  const missingDefinitions = missingTables.filter(
    (table) =>
      !statements.some((statement) =>
        new RegExp(
          `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["\`]?${table}["\`]?`,
          'i'
        ).test(statement)
      )
  );

  if (missingDefinitions.length > 0) {
    throw new Error(
      'Migração não contém as tabelas: ' +
      missingDefinitions.join(', ')
    );
  }

  // Executa somente CREATE TABLE das tabelas ausentes.
  // Não recria tabelas que já contêm informações.
  const commands = statements.filter((statement) => {
    const match = statement.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z_]+)["`]?/i
    );

    return match && missingTables.includes(match[1]);
  });

  db.exec('BEGIN IMMEDIATE');

  try {
    for (const command of commands) {
      db.exec(command);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

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
    const db = getDatabase();
    return db.prepare(this.sql).get(...this.args) ?? null;
  }

  async all() {
    const db = getDatabase();
    return {
      results: db.prepare(this.sql).all(...this.args),
    };
  }

  async run() {
    const db = getDatabase();
    const info = db.prepare(this.sql).run(...this.args);

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

function getStorage() {
  const storage = join(base, 'uploads');
  mkdirSync(storage, { recursive: true });
  return storage;
}

const BUCKET = {
  async put(key: string, bytes: Uint8Array, opts: any) {
    if (!/^[0-9a-f-]{36}$/i.test(key)) {
      throw new Error('Invalid attachment key');
    }

    const storage = getStorage();

    writeFileSync(join(storage, key), bytes, {
      flag: 'wx',
    });

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
    if (!/^[0-9a-f-]{36}$/i.test(key)) {
      return null;
    }

    const storage = getStorage();
    const path = join(storage, key);

    if (!existsSync(path)) {
      return null;
    }

    const metadata = JSON.parse(
      readFileSync(join(storage, key + '.json'), 'utf8')
    );

    return {
      ...metadata,
      body: new Uint8Array(readFileSync(path)),
    };
  },
};

export const env = {
  DB,
  BUCKET,

  get BOOTSTRAP_SECRET() {
    return process.env.BOOTSTRAP_SECRET || '';
  },
};
