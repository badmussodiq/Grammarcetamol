import {Module} from '@nestjs/common';
import {CourseServiceClient} from '@/course-client/course-service.client';
import {UploadsController} from './uploads.controller';
import {UploadsService} from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, CourseServiceClient],
})
export class UploadsModule {}
