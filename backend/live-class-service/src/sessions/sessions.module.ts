import {Module} from '@nestjs/common';
import {EnrollmentsModule} from '@/enrollments/enrollments.module';
import {ProvidersModule} from '@/providers/providers.module';
import {InstructorsController} from './instructors.controller';
import {SessionsController} from './sessions.controller';
import {SessionsService} from './sessions.service';

@Module({
  imports: [ProvidersModule, EnrollmentsModule],
  controllers: [SessionsController, InstructorsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
