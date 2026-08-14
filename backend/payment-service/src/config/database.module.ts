import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {join} from 'path';
import {Pool} from 'pg';
import {runMigrations} from './migration-runner';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<Pool> => {
        const pool = new Pool({
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 9009),
          database: 'payment_db',
          user: config.get<string>('DB_USERNAME', 'platform'),
          password: config.get<string>('DB_PASSWORD', 'platform'),
          max: 10,
        });
        // process.cwd() (not __dirname) so this resolves to the same source-tree db/migration/
        // folder whether running via ts-node in dev or compiled JS in dist/ — no asset-copy step.
        await runMigrations(pool, join(process.cwd(), 'db', 'migration'));
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
