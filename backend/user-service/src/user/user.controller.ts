import {
  Controller, Get, Patch, Param, Body,
  Query, UseGuards, Headers,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InternalTokenGuard } from './guards/internal-token.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserId } from './decorators/user-id.decorator';

@Controller('users')
@UseGuards(InternalTokenGuard)
export class UserController {

  constructor(private readonly userService: UserService) {}

  /** GET /api/users/me */
  @Get('me')
  async getMyProfile(@UserId() userId: string) {
    return this.userService.getMyProfile(userId);
  }

  /** PATCH /api/users/me */
  @Patch('me')
  async updateMyProfile(
    @UserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateMyProfile(userId, dto);
  }

  /** GET /api/users — admin/moderator only */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'moderator')
  async getAllUsers(
    @Query('q') query: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.userService.getAllUsers(query, Number(page), Number(limit));
  }

  /** GET /api/users/:id — admin only */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'moderator')
  async getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  /** PATCH /api/users/:id/status — super_admin only */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.userService.updateUserStatus(id, status);
  }
}
