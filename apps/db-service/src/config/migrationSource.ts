// src/config/migrationSource.ts
import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';

export class TsRecursiveMigrationSource implements Knex.MigrationSource<unknown> {
  constructor(private baseDir: string) {}

  getMigrations(): Promise<string[]> {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|js)$/.test(entry.name)) files.push(full);
      }
    };
    walk(this.baseDir);
    // Sort for deterministic order
    files.sort();
    return Promise.resolve(files);
  }

  getMigrationName(migration: string): string {
    return path.relative(this.baseDir, migration);
  }

  getMigration(migration: string): Promise<Knex.Migration> {
    return import(migration) as unknown as Promise<Knex.Migration>;
  }
}