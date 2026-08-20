import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Db, MongoClient} from 'mongodb';

export const MONGO_DB = 'MONGO_DB';
export const MONGO_CLIENT = 'MONGO_CLIENT';

/**
 * Second MongoDB consumer in this codebase — reuses notification-service's (Task 31)
 * DatabaseModule shape exactly: official `mongodb` driver, no Mongoose, no migration runner,
 * idempotent index creation on each collection's own `onModuleInit`/`onApplicationBootstrap`.
 * Connects to the same dedicated `grammarcetamol-mongo` instance (port 9015) — `liveclass_db`
 * is just a second database on that instance alongside `notification_db`.
 */
@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const host = config.get<string>('MONGO_HOST', 'localhost');
        const port = config.get<number>('MONGO_PORT', 9015);
        const username = config.get<string>('MONGO_USERNAME', 'platform');
        const password = config.get<string>('MONGO_PASSWORD', 'platform12345');
        const uri = `mongodb://${username}:${password}@${host}:${port}/?authSource=admin`;
        const client = new MongoClient(uri);
        await client.connect();
        return client;
      },
    },
    {
      provide: MONGO_DB,
      inject: [MONGO_CLIENT, ConfigService],
      useFactory: (client: MongoClient, config: ConfigService): Db => {
        return client.db(config.get<string>('MONGO_DB_NAME', 'liveclass_db'));
      },
    },
  ],
  exports: [MONGO_CLIENT, MONGO_DB],
})
export class DatabaseModule {}
