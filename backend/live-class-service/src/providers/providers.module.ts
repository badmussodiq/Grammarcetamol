import {Module} from '@nestjs/common';
import {JitsiProvider} from './jitsi.provider';
import {VideoProviderRegistry} from './video-provider.registry';

@Module({
  providers: [JitsiProvider, VideoProviderRegistry],
  exports: [VideoProviderRegistry],
})
export class ProvidersModule {}
