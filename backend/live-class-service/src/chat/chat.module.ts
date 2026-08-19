import {Module} from '@nestjs/common';
import {EnrollmentsModule} from '@/enrollments/enrollments.module';
import {ChatService} from './chat.service';

@Module({
  imports: [EnrollmentsModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
