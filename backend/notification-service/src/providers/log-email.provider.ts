import {Injectable, Logger} from '@nestjs/common';
import {randomUUID} from 'crypto';
import type {EmailProvider, SendEmailInput, SendEmailResult} from './email-provider.interface';

/**
 * Default/only provider until real SMTP/SendGrid/SES credentials exist. Logs what would have
 * been sent (recipient + subject, not the full HTML — that's noisy) and always reports success,
 * so the rest of the pipeline (notification_logs, retry-on-failure semantics) behaves exactly
 * as it will once a real provider is swapped in — no code path here is a stub that skips logic
 * a real provider would exercise.
 */
@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';
  private readonly logger = new Logger(LogEmailProvider.name);

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const messageId = `log_${randomUUID()}`;
    this.logger.log(
      `[would send] from=${input.senderIdentity} to=${input.to} <${input.toName}> subject="${input.subject}" (messageId=${messageId})`,
    );
    return { success: true, messageId, raw: { provider: 'log' } };
  }
}
