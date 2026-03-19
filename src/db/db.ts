import { Platform } from "react-native";
import { SCHEMA, MIGRATIONS } from "./schema";

/** Small wrapper matching the expo-sqlite sync API used by the app. */
export interface DbLike {
  execSync(sql: string): void;
  runSync(sql: string, params?: any[]): void;
  getFirstSync<T>(sql: string, params?: any[]): T | undefined;
  getAllSync<T>(sql: string, params?: any[]): T[];
}

type SqlJsStatement = {
  bind(params?: any[]): void;
  step(): boolean;
  getAsObject(): Record<string, any>;
  free(): void;
};

type SqlJsDatabase = {
  run(sql: string, params?: any[]): void;
  exec(sql: string): unknown;
  prepare(sql: string): SqlJsStatement;
};

let currentDb: DbLike | null = null;
let initPromise: Promise<void> | null = null;

function requireDb(): DbLike {
  if (!currentDb) {
    throw new Error("Database not initialized yet.");
  }
  return currentDb;
}

export const db: DbLike = {
  execSync(sql: string) {
    requireDb().execSync(sql);
  },
  runSync(sql: string, params?: any[]) {
    requireDb().runSync(sql, params);
  },
  getFirstSync<T>(sql: string, params?: any[]) {
    return requireDb().getFirstSync<T>(sql, params);
  },
  getAllSync<T>(sql: string, params?: any[]) {
    return requireDb().getAllSync<T>(sql, params);
  },
};

function createNativeDb(): DbLike {
  const SQLite = require("expo-sqlite");
  return SQLite.openDatabaseSync("couple_coach.db") as DbLike;
}

async function createWebDb(): Promise<DbLike> {
  const initSqlJs = (await import("sql.js/dist/sql-asm.js")).default;
  const SQL = await initSqlJs();
  const webDb = new SQL.Database() as SqlJsDatabase;

  return {
    execSync(sql: string) {
      webDb.exec(sql);
    },
    runSync(sql: string, params?: any[]) {
      webDb.run(sql, params ?? []);
    },
    getFirstSync<T>(sql: string, params?: any[]) {
      const stmt = webDb.prepare(sql);
      try {
        stmt.bind(params ?? []);
        if (!stmt.step()) return undefined;
        return stmt.getAsObject() as T;
      } finally {
        stmt.free();
      }
    },
    getAllSync<T>(sql: string, params?: any[]) {
      const stmt = webDb.prepare(sql);
      const rows: T[] = [];
      try {
        stmt.bind(params ?? []);
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as T);
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
  };
}

export async function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      currentDb = Platform.OS === "web" ? await createWebDb() : createNativeDb();
      currentDb.execSync(SCHEMA);
      runMigrations(currentDb);
    } catch (error) {
      currentDb = null;
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

function runMigrations(database: DbLike) {
  database.execSync(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);`);

  const currentRow = database.getFirstSync<{ version: number | null }>(
    "SELECT MAX(version) as version FROM schema_version"
  );
  // Treat schema creation as version 1 so migrations can start from version 2.
  const current = currentRow?.version ?? 1;

  for (const m of MIGRATIONS) {
    if (m.version > current) {
      try {
        database.execSync(m.sql);
        database.runSync("INSERT INTO schema_version(version) VALUES(?)", [m.version]);
      } catch (e: any) {
        if (e?.message?.includes("duplicate column") || e?.message?.includes("already exists")) {
          database.runSync("INSERT INTO schema_version(version) VALUES(?)", [m.version]);
        } else {
          throw e;
        }
      }
    }
  }
}
