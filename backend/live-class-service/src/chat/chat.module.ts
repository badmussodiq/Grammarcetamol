import {Module} from '@nestjs/common';
import {EnrollmentsModule} from '@/enrollments/enrollments.module';
import {ChatGateway} from './chat.gateway';
import {ChatService} from './chat.service';

@Module({
  imports: [EnrollmentsModule],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
