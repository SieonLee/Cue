declare module "sql.js/dist/sql-asm.js" {
  type InitSqlJs = () => Promise<{
    Database: new () => {
      run(sql: string, params?: any[]): void;
      exec(sql: string): unknown;
      prepare(sql: string): {
        bind(params?: any[]): void;
        step(): boolean;
        getAsObject(): Record<string, any>;
        free(): void;
      };
    };
  }>;

  const initSqlJs: InitSqlJs;
  export default initSqlJs;
}
