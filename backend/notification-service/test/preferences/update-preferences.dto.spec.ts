import 'reflect-metadata';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {UpdatePreferencesDto} from '@/preferences/dto/update-preferences.dto';

describe('UpdatePreferencesDto', () => {
  it('accepts a partial update naming only one preference type', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { announcement: { inApp: false, email: true } });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty body (no-op update)', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('still rejects a present-but-malformed channel preference', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { course: { inApp: 'not-a-boolean', email: true } });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
