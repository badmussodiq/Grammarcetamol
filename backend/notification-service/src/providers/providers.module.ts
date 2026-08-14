import {Module} from '@nestjs/common';
import {EmailProviderRegistry} from './email-provider.registry';
import {LogEmailProvider} from './log-email.provider';
import {SmtpEmailProvider} from './smtp-email.provider';

@Module({
  providers: [LogEmailProvider, SmtpEmailProvider, EmailProviderRegistry],
  exports: [EmailProviderRegistry],
})
export class ProvidersModule {}
