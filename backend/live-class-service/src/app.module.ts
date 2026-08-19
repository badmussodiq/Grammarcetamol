import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {ScheduleModule} from '@nestjs/schedule';
import {ClassesModule} from './classes/classes.module';
import {ConsumerModule} from './consumer/consumer.module';
import {DatabaseModule} from './config/database.module';
import {RabbitMQModule} from './config/rabbitmq.module';
import {HealthController} from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RabbitMQModule,
    ClassesModule,
    ConsumerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
