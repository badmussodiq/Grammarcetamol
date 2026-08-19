import {Module} from '@nestjs/common';
import {ChatModule} from '@/chat/chat.module';
import {EnrollmentsModule} from '@/enrollments/enrollments.module';
import {MaterialsModule} from '@/materials/materials.module';
import {SessionsModule} from '@/sessions/sessions.module';
import {ClassesController} from './classes.controller';
import {ClassesService} from './classes.service';

@Module({
  imports: [SessionsModule, EnrollmentsModule, MaterialsModule, ChatModule],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
