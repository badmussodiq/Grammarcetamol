import {Module} from '@nestjs/common';
import {EnrollmentsModule} from '@/enrollments/enrollments.module';
import {LiveClassConsumerService} from './live-class-consumer.service';

@Module({
  imports: [EnrollmentsModule],
  providers: [LiveClassConsumerService],
})
export class ConsumerModule {}
