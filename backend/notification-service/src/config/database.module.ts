import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Db, MongoClient} from 'mongodb';

export const MONGO_DB = 'MONGO_DB';
export const MONGO_CLIENT = 'MONGO_CLIENT';

/**
 * First MongoDB consumer in this codebase — official `mongodb` driver, no Mongoose, matching
 * the "no ORM" convention already established twice for Postgres (payment-service/upload-service)
 * and the same no-Mongoose call made for Live Class Service's future work. Connects to the
 * dedicated `grammarcetamol-mongo` instance (docker-compose port 9015) — a completely separate
 * container from the pre-existing standalone `platform-mongo` (default 27017, unrelated
 * `notifications` database, never touched by this project). `notification_db` is just a second
 * database on that same dedicated instance alongside Live Class Service's future `liveclass_db`.
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
        return client.db(config.get<string>('MONGO_DB_NAME', 'notification_db'));
      },
    },
  ],
  exports: [MONGO_CLIENT, MONGO_DB],
})
export class DatabaseModule {}
