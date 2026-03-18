import { Platform } from "react-native";
import { SCHEMA, MIGRATIONS } from "./schema";

/** Small wrapper matching the expo-sqlite sync API used by the app. */
export interface DbLike {
  execSync(sql: string): void;
  runSync(sql: string, params?: any[]): void;
  getFirstSync<T>(sql: string, params?: any[]): T | undefined;
  getAllSync<T>(sql: string, params?: any[]): T[];
}

// Web fallback used for preview and screenshots.
let _db: DbLike;

if (Platform.OS === "web") {
  // Simple in-memory table store: { tableName: [ { col1: val, ... }, ... ] }
  const _tables: Record<string, Record<string, any>[]> = {};

  function parseCreateTable(sql: string) {
    const m = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]+)\)/i);
    if (!m) return;
    const table = m[1];
    if (!_tables[table]) _tables[table] = [];
  }

  function parseInsert(sql: string, params?: any[]) {
    const m = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES/i);
    if (!m || !params) return;
    const table = m[1];
    const cols = m[2].split(",").map(c => c.trim());
    if (!_tables[table]) _tables[table] = [];
    const row: Record<string, any> = {};
    cols.forEach((col, i) => { row[col] = params[i] ?? null; });
    _tables[table].push(row);
  }

  function parseUpdate(sql: string, params?: any[]) {
    const m = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!m || !params) return;
    const table = m[1];
    if (!_tables[table]) return;
    const setClauses = m[2].split(",").map(s => s.trim().split(/\s*=\s*\?/)[0].trim());
    const whereClause = m[3];
    const setCount = setClauses.length;
    const setValues = params.slice(0, setCount);
    const whereValues = params.slice(setCount);
    _tables[table].forEach(row => {
      if (whereClause && whereValues.length > 0) {
        const whereCol = whereClause.replace(/\s*=\s*\?.*/, "").trim();
        if (row[whereCol] !== whereValues[0]) return;
      }
      setClauses.forEach((col, i) => { row[col] = setValues[i]; });
    });
  }

  function parseDelete(sql: string, params?: any[]) {
    const m = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(\w+)\s*=\s*\?)?/i);
    if (!m) return;
    const table = m[1];
    if (!_tables[table]) return;
    if (m[2] && params?.[0] !== undefined) {
      _tables[table] = _tables[table].filter(r => r[m[2]] !== params![0]);
    } else {
      _tables[table] = [];
    }
  }

  // Supports the SELECT patterns used by the app screens.
  function parseSelect(sql: string, params?: any[]): Record<string, any>[] {
    const m = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (!m) return [];
    const table = m[2];
    const rows = _tables[table] || [];
    if (rows.length === 0) return [];

    let result = [...rows];
    if (m[3] && params && params.length > 0) {
      const conditions = m[3].split(/\s+AND\s+/i);
      let paramIdx = 0;
      for (const cond of conditions) {
        const cm = cond.trim().match(/(\w+)\s*=\s*\?/);
        if (cm && paramIdx < params.length) {
          const col = cm[1];
          const val = params[paramIdx++];
          result = result.filter(r => r[col] === val);
        }
      }
    }

    const colStr = m[1].trim();
    if (colStr !== "*") {
      const selectCols = colStr.split(",").map(c => {
        const aggMatch = c.trim().match(/(?:MAX|MIN|COUNT|SUM|AVG)\((\w+)\)\s+as\s+(\w+)/i);
        if (aggMatch) return { src: aggMatch[1], alias: aggMatch[2], agg: true };
        const aliasMatch = c.trim().match(/(\w+)\s+as\s+(\w+)/i);
        if (aliasMatch) return { src: aliasMatch[1], alias: aliasMatch[2], agg: false };
        return { src: c.trim(), alias: c.trim(), agg: false };
      });
      result = result.map(r => {
        const out: Record<string, any> = {};
        selectCols.forEach(({ src, alias }) => { out[alias] = r[src]; });
        return out;
      });
    }

    if (m[5]) result = result.slice(0, parseInt(m[5]));

    return result;
  }

  _db = {
    execSync(sql: string) {
      // Handle multiple CREATE TABLE statements
      const statements = sql.split(";").filter(s => s.trim());
      for (const stmt of statements) {
        parseCreateTable(stmt.trim());
      }
    },
    runSync(sql: string, params?: any[]) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith("INSERT")) parseInsert(sql, params);
      else if (trimmed.startsWith("UPDATE")) parseUpdate(sql, params);
      else if (trimmed.startsWith("DELETE")) parseDelete(sql, params);
      else if (trimmed.startsWith("CREATE")) parseCreateTable(sql);
    },
    getFirstSync<T>(sql: string, params?: any[]): T | undefined {
      const rows = parseSelect(sql, params);
      return (rows[0] as T) ?? undefined;
    },
    getAllSync<T>(sql: string, params?: any[]): T[] {
      return parseSelect(sql, params) as T[];
    },
  };
} else {
  const SQLite = require("expo-sqlite");
  _db = SQLite.openDatabaseSync("couple_coach.db") as DbLike;
}

export const db: DbLike = _db;

export function initDb() {
  db.execSync(SCHEMA);
  if (Platform.OS !== "web") {
    runMigrations();
  }
}

function runMigrations() {
  db.execSync(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);`);

  const currentRow = db.getFirstSync<{ version: number }>(
    "SELECT MAX(version) as version FROM schema_version"
  );
  const current = currentRow?.version ?? 1;

  for (const m of MIGRATIONS) {
    if (m.version > current) {
      try {
        db.execSync(m.sql);
        db.runSync("INSERT INTO schema_version(version) VALUES(?)", [m.version]);
      } catch (e: any) {
        // If column already exists, skip silently
        if (e?.message?.includes("duplicate column") || e?.message?.includes("already exists")) {
          db.runSync("INSERT INTO schema_version(version) VALUES(?)", [m.version]);
        }
      }
    }
  }
}
