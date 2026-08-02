import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable,
} from 'typeorm';
import { RoleEntity } from './role.entity';

@Entity('user_profiles')
export class UserProfileEntity {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auth_user_id', type: 'uuid', unique: true })
  authUserId: string;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ name: 'learning_goals', type: 'text', array: true, nullable: true })
  learningGoals: string[];

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any>;

  @ManyToMany(() => RoleEntity, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn:        { name: 'user_id',   referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id',   referencedColumnName: 'id' },
  })
  roles: RoleEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
