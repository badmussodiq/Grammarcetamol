import {Injectable} from '@nestjs/common';
import {JitsiProvider} from './jitsi.provider';
import type {VideoProvider} from './video-provider.interface';

@Injectable()
export class VideoProviderRegistry {
  private readonly providers = new Map<string, VideoProvider>();

  constructor(jitsiProvider: JitsiProvider) {
    this.providers.set(jitsiProvider.name, jitsiProvider);
    // Add ZoomProvider/LoomProvider here (constructor param + a .set(...) call) when those
    // are actually built — see video-provider.interface.ts.
  }

  get(name: string): VideoProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`No video provider registered for "${name}"`);
    }
    return provider;
  }
}
