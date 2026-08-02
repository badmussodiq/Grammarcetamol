import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfileEntity } from './entities/user-profile.entity';
import { RoleEntity } from './entities/role.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {

  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly profileRepo: Repository<UserProfileEntity>,

    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async createProfileFromEvent(
    userId: string,
    email: string,
    fullName: string,
  ): Promise<void> {
    const existing = await this.profileRepo.findOne({ where: { authUserId: userId } });
    if (existing) {
      this.logger.warn(`Profile already exists for userId=${userId}`);
      return;
    }

    const studentRole = await this.roleRepo.findOne({ where: { name: 'student' } });
    const profile = this.profileRepo.create({
      authUserId: userId,
      fullName,
      roles: studentRole ? [studentRole] : [],
    });

    await this.profileRepo.save(profile);
    this.logger.log(`Created profile for userId=${userId} email=${email}`);
  }

  async getMyProfile(authUserId: string): Promise<UserProfileEntity> {
    const profile = await this.profileRepo.findOne({
      where: { authUserId },
      relations: ['roles'],
    });
    if (!profile) {
      throw new NotFoundException(`Profile not found for userId=${authUserId}`);
    }
    return profile;
  }

  async updateMyProfile(
    authUserId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileEntity> {
    const profile = await this.getMyProfile(authUserId);
    const allowed: (keyof UpdateProfileDto)[] = [
      'fullName', 'phone', 'country', 'timezone', 'bio', 'learningGoals',
    ];
    for (const key of allowed) {
      if (dto[key] !== undefined) {
        (profile as any)[key] = dto[key];
      }
    }
    return this.profileRepo.save(profile);
  }

  async getAllUsers(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: UserProfileEntity[]; total: number }> {
    const qb = this.profileRepo.createQueryBuilder('p').leftJoinAndSelect('p.roles', 'roles');
    if (query) {
      qb.where('p.fullName ILIKE :q OR p.authUserId::text ILIKE :q', { q: `%${query}%` });
    }
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async getUserById(id: string): Promise<UserProfileEntity> {
    const profile = await this.profileRepo.findOne({ where: { id }, relations: ['roles'] });
    if (!profile) throw new NotFoundException(`User profile ${id} not found`);
    return profile;
  }

  async updateUserStatus(id: string, status: string): Promise<UserProfileEntity> {
    const profile = await this.getUserById(id);
    (profile as any).status = status;
    return this.profileRepo.save(profile);
  }
}
