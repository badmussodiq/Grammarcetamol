import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createTransport, type Transporter} from 'nodemailer';
import type {SenderIdentity} from '@/sender/sender-identity';
import type {EmailProvider, SendEmailInput, SendEmailResult} from './email-provider.interface';

interface FromConfig {
  address: string;
  name: string;
}

/**
 * Real SMTP delivery via nodemailer — activated by setting EMAIL_PROVIDER=smtp (see
 * EmailProviderRegistry). Works with any standard SMTP host, not just Gmail; only the .env
 * values change to switch providers later (SendGrid/SES/Mailgun all offer SMTP endpoints too),
 * same zero-call-site-change guarantee as PaymentProvider/StorageProvider always had.
 *
 * ONE real authenticated connection (SMTP_HOST/PORT/USERNAME/PASSWORD) sends every email —
 * the mailbox host only allows one real account on this plan. What varies per sender
 * identity ('default', 'billing') is just the "From" address/display name, using
 * domain-level aliases (billing@grammarcetamol.com etc.) configured on the mail host to
 * deliver into the one real inbox. Unlike Gmail, most cPanel/Exim-style hosts accept any
 * "From" address that belongs to the authenticated account's own domain, even if it isn't
 * the literal login — so this doesn't need (and can't have) a separate credential per
 * identity. Each identity's SMTP_<IDENTITY>_FROM_ADDRESS/FROM_NAME is optional; unset falls
 * back to the default identity's own SMTP_FROM_ADDRESS/FROM_NAME (or SMTP_USERNAME if that's
 * unset too), so a deployment that hasn't configured a billing alias yet keeps working
 * exactly as before — every email just goes out under the one default address.
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

    try {
      await this.getTransporter().verify();
      this.logger.log(`SMTP connection verified (${this.config.get<string>('SMTP_HOST')})`);
    } catch (err) {
      this.logger.error(`SMTP connection could not be verified: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private fromConfig(identity: SenderIdentity): FromConfig {
    const prefix = identity === 'default' ? 'SMTP' : `SMTP_${identity.toUpperCase()}`;
    // '' counts as unset here, not a real value — docker-compose.yml's ${VAR:-} defaulting
    // produces an empty string (not undefined) for any identity var nobody configured, and
    // that empty string must still fall back to the shared default, not blank out the From address.
    const str = (key: string, fallback: string) => this.config.get<string>(key) || fallback;
    return {
      address: str(`${prefix}_FROM_ADDRESS`, str('SMTP_FROM_ADDRESS', str('SMTP_USERNAME', ''))),
      name: str(`${prefix}_FROM_NAME`, str('SMTP_FROM_NAME', 'Grammarcetamol')),
    };
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST', '');
    const port = this.config.get<number>('SMTP_PORT', 587);
    this.transporter = createTransport({
      host,
      port,
      // 587 is STARTTLS (secure:false, upgraded after connect); 465 is implicit TLS
      // (secure:true). Deriving this from the port avoids a separate SMTP_SECURE env var that
      // could be set inconsistently with the port.
      secure: port === 465,
      auth: {
        user: this.config.get<string>('SMTP_USERNAME', ''),
        pass: this.config.get<string>('SMTP_PASSWORD', ''),
      },
    });
    return this.transporter;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const transporter = this.getTransporter();
    const { address, name } = this.fromConfig(input.senderIdentity);

    try {
      const info = await transporter.sendMail({
        from: `"${name}" <${address}>`,
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
