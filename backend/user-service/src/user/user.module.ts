import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfileEntity } from './entities/user-profile.entity';
import { RoleEntity } from './entities/role.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserEventsConsumer } from './messaging/user-events.consumer';
import { InternalTokenGuard } from './guards/internal-token.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfileEntity, RoleEntity]),
  ],
  providers: [
    UserService,
    UserEventsConsumer,
    InternalTokenGuard,
    RolesGuard,
  ],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
