import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createTransport, type Transporter} from 'nodemailer';
import type {EmailProvider, SendEmailInput, SendEmailResult} from './email-provider.interface';

/**
 * Real SMTP delivery via nodemailer — activated by setting EMAIL_PROVIDER=smtp (see
 * EmailProviderRegistry). Works with any standard SMTP host, not just Gmail; only the .env
 * values change to switch providers later (SendGrid/SES/Mailgun all offer SMTP endpoints too),
 * same zero-call-site-change guarantee as PaymentProvider/StorageProvider always had.
 */
@Injectable()
export class SmtpEmailProvider implements EmailProvider, OnApplicationBootstrap {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Verifies the connection once at boot rather than on every send — a bad credential should
   * surface immediately in the logs, not silently on the first real email someone tries to
   * trigger. Doesn't crash the service if verification fails (SMTP might be transiently down);
   * send() below still tries per-message and logs its own failure into notification_logs. */
  async onApplicationBootstrap(): Promise<void> {
    // Only actually connect if this provider is the active one — no point holding an SMTP
    // connection open (or failing startup on bad creds) when EMAIL_PROVIDER=log is what's
    // configured; the registry still constructs every registered provider regardless of which
    // one is active, so this guard is what keeps an inactive provider inert.
    if (this.config.get<string>('EMAIL_PROVIDER', 'log') !== this.name) return;

    this.transporter = this.buildTransporter();
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP connection verified (${this.config.get<string>('SMTP_HOST')})`);
    } catch (err) {
      this.logger.error(`SMTP connection could not be verified: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private buildTransporter(): Transporter {
    const port = this.config.get<number>('SMTP_PORT', 587);
    return createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      // 587 is STARTTLS (secure:false, upgraded after connect); 465 is implicit TLS
      // (secure:true). Deriving this from the port avoids a separate SMTP_SECURE env var that
      // could be set inconsistently with the port.
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USERNAME'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    // Lazily build if onApplicationBootstrap's guard skipped construction (e.g. EMAIL_PROVIDER
    // was 'log' at boot but this method somehow still got called) — send() should work
    // correctly regardless of the bootstrap optimization above, not depend on it for correctness.
    const transporter = this.transporter ?? this.buildTransporter();

    try {
      const fromName = this.config.get<string>('SMTP_FROM_NAME', 'Grammarcetamol');
      const fromAddress = this.config.get<string>('SMTP_USERNAME');
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: `"${input.toName}" <${input.to}>`,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { success: true, messageId: info.messageId, raw: info };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
