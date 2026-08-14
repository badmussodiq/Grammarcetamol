import {Logger} from '@nestjs/common';
import {readdirSync, readFileSync} from 'fs';
import {join} from 'path';
import {Pool} from 'pg';

const logger = new Logger('MigrationRunner');

/**
 * Hand-rolled Flyway-equivalent — no ORM, no Java dependency, same versioned-SQL-file
 * convention as every Java service's db/migration/V<n>__<description>.sql. Applies files in
 * filename order inside a transaction, tracks applied versions in schema_migrations.
 */
export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedResult = await pool.query('SELECT version FROM schema_migrations');
  const applied = new Set<string>(appliedResult.rows.map((row: { version: string }) => row.version));

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.log(`Applied migration ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
