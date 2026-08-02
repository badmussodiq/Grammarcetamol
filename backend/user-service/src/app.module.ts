import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get<string>('DB_HOST', 'localhost'),
        port:     parseInt(cfg.get('DB_PORT', '5433')),
        username: cfg.get<string>('DB_USERNAME', 'platform'),
        password: cfg.get<string>('DB_PASSWORD', 'platform'),
        database: cfg.get<string>('DB_NAME', 'user_db'),
        entities:   [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize:    false,
        migrationsRun:  true,
        logging: false,
      }),
    }),
    UserModule,
  ],
})
export class AppModule {}
