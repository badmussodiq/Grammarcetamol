import {Injectable} from '@nestjs/common';
import {LogEmailProvider} from './log-email.provider';
import {SmtpEmailProvider} from './smtp-email.provider';
import type {EmailProvider} from './email-provider.interface';

@Injectable()
export class EmailProviderRegistry {
  private readonly providers = new Map<string, EmailProvider>();

  constructor(logEmailProvider: LogEmailProvider, smtpEmailProvider: SmtpEmailProvider) {
    this.providers.set(logEmailProvider.name, logEmailProvider);
    this.providers.set(smtpEmailProvider.name, smtpEmailProvider);
    // Add SendGridProvider / SesProvider here (constructor param + a .set(...) call) if a
    // native API integration is ever wanted instead of SMTP — see email-provider.interface.ts.
  }

  get(name: string): EmailProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`No email provider registered for "${name}"`);
    }
    return provider;
  }
}
