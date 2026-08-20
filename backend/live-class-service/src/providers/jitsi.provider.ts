import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {randomBytes} from 'crypto';
import type {CreateRoomInput, CreateRoomResult, VideoProvider} from './video-provider.interface';

/**
 * Wraps the free public meet.jit.si server. Unlike Paystack/SMTP, there is no API call to
 * "create" a room — a Jitsi room is just a unique name the IFrame API joins; the room exists
 * implicitly from whoever joins first. This provider's whole job is generating a name with
 * real entropy (not a guessable slug from the class title alone), so access control is
 * entirely the room-reveal endpoint's job (who's allowed to learn this name), not Jitsi's.
 */
@Injectable()
export class JitsiProvider implements VideoProvider {
  readonly name = 'jitsi';

  constructor(private readonly config: ConfigService) {}

  createRoom(input: CreateRoomInput): CreateRoomResult {
    const slug = input.classTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const entropy = randomBytes(16).toString('hex');
    return {
      roomId: `grammarcetamol-${slug}-${entropy}`,
      domain: this.config.get<string>('JITSI_DOMAIN', 'meet.jit.si'),
    };
  }
}
