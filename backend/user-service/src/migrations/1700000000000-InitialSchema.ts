import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255),
        is_system   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_user_id   UUID NOT NULL UNIQUE,
        full_name      VARCHAR(255),
        phone          VARCHAR(50),
        avatar_url     VARCHAR(500),
        country        VARCHAR(100),
        timezone       VARCHAR(100),
        bio            TEXT,
        learning_goals TEXT[],
        date_of_birth  DATE,
        preferences    JSONB,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles (auth_user_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id)`
    );

    // Seed default roles
    await queryRunner.query(`
      INSERT INTO roles (name, description, is_system) VALUES
        ('student',    'Default student role',    TRUE),
        ('moderator',  'Content moderator',       TRUE),
        ('super_admin','Super administrator',      TRUE)
      ON CONFLICT (name) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
  }
}
