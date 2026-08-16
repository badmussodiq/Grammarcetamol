import {Module} from '@nestjs/common';
import {SenderModule} from '@/sender/sender.module';
import {SupportController} from './support.controller';
import {SupportService} from './support.service';

@Module({
  imports: [SenderModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
